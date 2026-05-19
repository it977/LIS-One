const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://erueurkqzmtdefszqons.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Frontend should use the API proxy for all writes. Keep the direct client disabled
// so the browser cannot mutate Supabase directly with the anon key.
export const supabase = null

function readSessionUser() {
  try {
    return JSON.parse(sessionStorage.getItem('lis_user') || 'null');
  } catch {
    return null;
  }
}

function decodeTokenPayload(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  try {
    const body = token.split('.')[0];
    const padded = body.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (body.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function hasValidAuthToken(skewSeconds = 30) {
  const token = readSessionUser()?.token;
  const payload = decodeTokenPayload(token);
  if (!token || !payload?.exp) return false;
  return payload.exp * 1000 > Date.now() + (skewSeconds * 1000);
}

function authHeaders() {
  const token = readSessionUser()?.token || null;
  const h = { 'Content-Type': 'application/json' };
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
    h['X-Lis-Token'] = token;
  }
  return h;
}

function handleAuthFailure(message) {
  if (typeof window !== 'undefined' && typeof window.handleAuthExpired === 'function') {
    window.handleAuthExpired(message);
    return;
  }
  if (typeof Swal !== 'undefined') {
    Swal.fire('Authentication required', message || 'Please login again.', 'error');
  }
}

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchProxy(table, options = {}) {
  try {
    const res = await fetchWithTimeout('/api/data', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ table, ...options })
    });
    if (!res.ok) return { success: false, data: [], error: await res.text() };
    const json = await res.json();
    return { success: json.success, data: Array.isArray(json.data) ? json.data : [], error: json.error };
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn(`[API] Fetch timeout for ${table}`);
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Request timeout',
          toast: true,
          position: 'top-end',
          timer: 2200,
          showConfirmButton: false
        });
      }
    } else {
      console.error('API Fetch Error:', e);
    }
    return { success: false, data: [] };
  }
}

async function mutateProxy(action, table, payload, match, functionName) {
  try {
    if (action !== 'select' && !hasValidAuthToken()) {
      const msg = 'Session ໝົດອາຍຸ ຫຼື ບໍ່ມີ token. ກະລຸນາ login ໃໝ່ແລ້ວລອງບັນທຶກອີກຄັ້ງ.';
      handleAuthFailure(msg);
      return { success: false, error: msg, status: 401 };
    }
    const res = await fetchWithTimeout('/api/data', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action, table, payload, match, functionName })
    });
    let json = {};
    try { json = await res.json(); } catch {}
    if (res.status === 401) {
      handleAuthFailure(json.error || 'Session expired. Please login again.');
      return { success: false, error: json.error || 'Authentication required', status: res.status };
    }
    if (res.status === 403) {
      if (typeof Swal !== 'undefined') {
        Swal.fire('Access denied', json.error || 'ບໍ່ມີສິດດຳເນີນການນີ້', 'error');
      }
      return { success: false, error: json.error || 'Forbidden', status: res.status };
    }
    return { success: res.ok && json.success !== false, ...json };
  } catch (e) { 
    if (e.name === 'AbortError') return { success: false, error: 'Timeout' };
    return { success: false, error: e.message }; 
  }
}

export async function loginUser(username, password) {
  try {
    const res = await fetchWithTimeout('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const json = await res.json().catch(() => ({}));
    return { success: res.ok && json.success === true, ...json };
  } catch (e) { return { success: false, message: e.name === 'AbortError' ? 'Timeout' : e.message }; }
}

export async function getDashboardData(sDate, eDate) {
  let filterStr = "";
  if (sDate) filterStr += `order_datetime=gte.${sDate}T00:00:00`;
  if (eDate) filterStr += `&order_datetime=lte.${eDate}T23:59:59`;
  
  const res = await fetchProxy('lis_one_test_orders', { filter: filterStr });
  const orders = res.data;
  
  return { 
    success: true, 
    orders,
    kpis: {
      totalPatients: new Set(orders.map(o => o.patient_id)).size,
      totalRevenue: orders.reduce((s, o) => s + (Number(o.total_price) || 0), 0),
      inlabRev: orders.filter(o => o.lab_dest === 'In-house').reduce((s, o) => s + (Number(o.total_price) || 0), 0),
      outlabRev: orders.filter(o => o.lab_dest !== 'In-house').reduce((s, o) => s + (Number(o.total_price) || 0), 0)
    }
  };
}

export async function getRecentOrders() { const res = await fetchProxy('lis_one_test_orders', { order: 'order_datetime.desc', limit: 200 }); return res.data; }
export async function getSettings() { const res = await fetchProxy('lis_one_settings', { order: 'id.asc' }); return res.data; }
export async function getStockMaster() { const res = await fetchProxy('lis_one_stock_master', { order: 'name.asc' }); return res.data; }
export async function getInventoryLots() { const res = await fetchProxy('lis_one_inventory_lots', { order: 'exp_date.asc' }); return res.data; }
export async function getTestMaster() { const res = await fetchProxy('lis_one_test_master', { order: 'name.asc' }); return res.data; }
export async function getAllTestPackages() { const res = await fetchProxy('lis_one_test_packages'); return res.data; }
export async function getTestReagentMapping() { const res = await fetchProxy('lis_one_test_reagent_mapping', { order: 'test_name.asc' }); return res.data; }
export async function getTestResults() { const res = await fetchProxy('lis_one_test_results', { order: 'order_id.asc', limit: 10000 }); return res.data; }

export async function updateOrder(orderId, changes) {
  return mutateProxy('update', 'lis_one_test_orders', changes, `order_id=eq.${encodeURIComponent(orderId)}`);
}

export async function deleteOrder(orderId) {
  return mutateProxy('delete', 'lis_one_test_orders', null, `order_id=eq.${encodeURIComponent(orderId)}`);
}

export async function saveOrder(orderData, items) {
  // Schema: one row per test. Strip cart-only fields and fan out.
  const base = { ...orderData };
  delete base.test_items;

  const rows = (items || []).map(it => ({
    ...base,
    test_name: it.name || it.test_name,
    price: Number(it.price) || 0,
    category: it.category || base.category || 'Other',
    test_type: it.test_type || base.test_type || 'Normal',
  }));
  if (!rows.length) return { success: false, error: 'ບໍ່ມີລາຍການກວດ' };

  const orderRes = await mutateProxy('insert', 'lis_one_test_orders', rows);
  if (!orderRes.success) return orderRes;

  return { success: true, message: 'ລົງທະບຽນສັ່ງກວດສຳເລັດ', order_id: orderData.order_id };
}

/* ============= GENERIC CRUD HELPERS ============= */
export async function genericInsert(table, payload) {
  return mutateProxy('insert', table, Array.isArray(payload) ? payload : [payload]);
}
export async function genericUpdate(table, id, payload, idCol = 'id') {
  return mutateProxy('update', table, payload, `${idCol}=eq.${encodeURIComponent(id)}`);
}
export async function genericDelete(table, id, idCol = 'id') {
  return mutateProxy('delete', table, null, `${idCol}=eq.${encodeURIComponent(id)}`);
}
export async function genericFetch(table, opts = {}) {
  const res = await fetchProxy(table, opts);
  return res.data || [];
}

export async function callRpc(functionName, payload = {}) {
  return mutateProxy('rpc', null, payload, null, functionName);
}

/* ============= TEST PARAMETERS ============= */
export async function getTestParameters() {
  const res = await fetchProxy('lis_one_test_parameters', { order: 'test_name.asc' });
  return res.data;
}

/* ============= STOCK TRANSACTIONS ============= */
export async function getStockTransactions(filterStr = '') {
  const opts = { order: 'created_at.desc', limit: 5000 };
  if (filterStr) opts.filter = filterStr;
  const res = await fetchProxy('lis_one_stock_transactions', opts);
  return res.data;
}

/* ============= MAINTENANCE ============= */
export async function getMaintenanceLogs() {
  const res = await fetchProxy('lis_one_maintenance_log', { order: 'log_date.desc', limit: 500 });
  return res.data;
}

/* ============= AUDIT LOG ============= */
export async function getAuditLogs(opts = {}) {
  const params = { order: 'created_at.desc', limit: opts.limit || 1000 };
  if (opts.filter) params.filter = opts.filter;
  const res = await fetchProxy('lis_one_audit_log', params);
  return res.data;
}
export async function writeAudit(user_name, action, target, details) {
  return mutateProxy('insert', 'lis_one_audit_log', [{
    user_name: user_name || 'system',
    action: String(action || ''),
    target: String(target || ''),
    details: details == null ? null : (typeof details === 'string' ? details : JSON.stringify(details))
  }]);
}

/* ============= RESULT ENTRY ============= */
export async function getResultsForOrder(order_id) {
  const res = await fetchProxy('lis_one_test_results', {
    filter: `order_id=eq.${encodeURIComponent(order_id)}`,
    order: 'test_name.asc'
  });
  return res.data;
}
export async function getOrderById(order_id) {
  const res = await fetchProxy('lis_one_test_orders', {
    filter: `order_id=eq.${encodeURIComponent(order_id)}`
  });
  return res.data;
}
export async function deleteResultsForOrder(order_id) {
  return mutateProxy('delete', 'lis_one_test_results', null,
    `order_id=eq.${encodeURIComponent(order_id)}`);
}
export async function bulkInsertResults(rows) {
  return mutateProxy('insert', 'lis_one_test_results', rows);
}
export async function setOrderStatus(order_id, status) {
  const payload = { status };
  if (status === 'Completed') payload.completed_at = new Date().toISOString();
  return mutateProxy('update', 'lis_one_test_orders', payload,
    `order_id=eq.${encodeURIComponent(order_id)}`);
}

/* ============= AUTO DEDUCT HELPERS ============= */
export async function getMappingsForTests(testNames) {
  if (!testNames?.length) return [];
  const list = testNames.map(n => `"${String(n).replace(/"/g,'\\"')}"`).join(',');
  const res = await fetchProxy('lis_one_test_reagent_mapping', {
    filter: `test_name=in.(${list})`
  });
  return res.data;
}
export async function getLotsForReagent(reagent_id) {
  const res = await fetchProxy('lis_one_inventory_lots', {
    filter: `reagent_id=eq.${reagent_id}&qty_remaining=gt.0`,
    order: 'exp_date.asc,id.asc'
  });
  return res.data;
}
export async function updateLotRemaining(lotId, qty_remaining) {
  return mutateProxy('update', 'lis_one_inventory_lots',
    { qty_remaining }, `id=eq.${lotId}`);
}
