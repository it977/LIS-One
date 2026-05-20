/* ============================================================
 * LIS-One - AUTO DEDUCT REAGENT
 *
 * Checks mapped reagent components before saving an order, then uses the
 * Supabase RPC lis_one_deduct_reagents_for_order to deduct FIFO in one
 * database transaction. This prevents R1 from being deducted when R2/R3 is
 * short.
 * ============================================================ */
import * as api from './api.js';

const currentUser = () => {
  try { return JSON.parse(sessionStorage.getItem('lis_user') || '{}').username || 'admin'; }
  catch { return 'admin'; }
};

const normalizeComponent = (value) => {
  const v = String(value || 'Single').trim();
  if (!v || /^full$/i.test(v)) return 'Single';
  if (/^(all|all_components|r1\/r2|r1r2)$/i.test(v)) return 'ALL_COMPONENTS';
  if (/^r[123]$/i.test(v)) return v.toUpperCase();
  return v;
};

const lotRemaining = (lot) => Number(lot.remaining_tests ?? lot.qty_remaining ?? lot.qty ?? 0) || 0;
const lotComponent = (lot) => normalizeComponent(lot.component_type);

/**
 * Returns { ok, required, available, shortages: [{reagent_name, component_type, need, have, short}] }
 */
window.checkReagentAvailability = async function(testNames) {
  const unique = [...new Set((testNames || []).filter(Boolean))];
  const required = {};
  if (!unique.length) return { ok: true, required, shortages: [] };

  const mappings = await api.getMappingsForTests(unique);
  mappings.forEach(m => {
    if (!m.reagent_id) return;
    const component = normalizeComponent(m.component_type);
    const key = `${m.reagent_id}::${component}`;
    if (!required[key]) {
      required[key] = {
        reagent_id: m.reagent_id,
        reagent_name: m.reagent_name,
        component_type: component,
        qty: 0
      };
    }
    required[key].qty += Number(m.qty) || 0;
  });

  const requiredRows = Object.values(required);
  if (!requiredRows.length) return { ok: true, required, shortages: [] };

  const available = {};
  const shortages = [];
  await Promise.all(requiredRows.map(async (req) => {
    const lots = await api.getLotsForReagent(req.reagent_id);
    const components = req.component_type === 'ALL_COMPONENTS'
      ? [...new Set(lots.map(lotComponent).filter(c => ['R1', 'R2', 'R3'].includes(c)))]
      : [req.component_type];
    const checkComponents = components.length ? components : ['Single'];
    const totals = checkComponents.map(component => ({
      component,
      total: lots
        .filter(l => component === 'Single'
          ? ['Single', 'FULL'].includes(lotComponent(l))
          : lotComponent(l) === component)
        .reduce((s, l) => s + lotRemaining(l), 0)
    }));
    available[`${req.reagent_id}::${req.component_type}`] = { lots, totals };
    totals.filter(t => t.total < req.qty).forEach(t => shortages.push({
      reagent_id: Number(req.reagent_id),
      reagent_name: req.reagent_name,
      component_type: t.component,
      need: req.qty,
      have: t.total,
      short: req.qty - t.total
    }));
  }));

  return { ok: shortages.length === 0, required, available, shortages };
};

/**
 * Deduct reagents FIFO through RPC. Returns { success, deducted, errors }
 */
window.deductReagentsForOrder = async function(testNames, order_id) {
  const unique = [...new Set((testNames || []).filter(Boolean))];
  if (!unique.length) return { success: true, deducted: [], errors: [] };

  const check = await window.checkReagentAvailability(unique);
  if (!check.ok) {
    return {
      success: false,
      deducted: [],
      errors: check.shortages.map(s =>
        `${s.reagent_name} ${s.component_type || ''}: ຕ້ອງການ ${s.need}, ມີ ${s.have}, ຂາດ ${s.short}`)
    };
  }

  const user = currentUser();
  const rpc = await api.callRpc('lis_one_deduct_reagents_for_order', {
    p_order_id: order_id,
    p_test_names: unique,
    p_user_name: user
  });
  const payload = rpc.data?.[0] || rpc.data || {};

  if (rpc.success && payload.ok !== false) {
    const deducted = payload.deducted || [];
    api.writeAudit(user, 'DEDUCT', 'stock_transactions', { order_id, deducted, method: 'rpc' });
    return { success: true, deducted, errors: [] };
  }

  const shortages = payload.shortages || check.shortages || [];
  const errors = shortages.length
    ? shortages.map(s => `${s.reagent_name} ${s.component_type || ''}: ຕ້ອງການ ${s.need}, ມີ ${s.have}, ຂາດ ${s.short}`)
    : [rpc.error?.message || rpc.error || 'Auto deduct failed'];
  api.writeAudit(user, 'DEDUCT_FAILED', 'stock_transactions', { order_id, errors });
  return { success: false, deducted: [], errors };
};

console.log('[auto_deduct.js] loaded');
