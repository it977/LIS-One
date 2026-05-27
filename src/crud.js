/* ============================================================
 * LIS-One CRUD MODULE
 * Implements all CRUD operations for Inventory, Maintenance,
 * Test Master, Mapping, Packages, Settings.
 * Wires up the previously stubbed window.* functions.
 * ============================================================ */
import * as api from './api.js';

/* ---------- tiny helpers ---------- */
const $ = (id) => document.getElementById(id);
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const fmtKip = (v) => `₭ ${Math.round(Number(v) || 0).toLocaleString()}`;
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? esc(v) : d.toLocaleDateString();
};
const toast = (icon, title) => {
  if (typeof Swal === 'undefined') { console.log(icon, title); return; }
  Swal.fire({ icon, title, toast: true, position: 'top-end', timer: 1800, showConfirmButton: false });
};
const confirmDelete = async (msg = 'ຕ້ອງການລຶບລາຍການນີ້ບໍ?') => {
  if (typeof Swal === 'undefined') return confirm(msg);
  const r = await Swal.fire({ title: msg, icon: 'warning', showCancelButton: true,
    confirmButtonText: 'ລຶບ', cancelButtonText: 'ຍົກເລີກ', confirmButtonColor: '#dc2626' });
  return r.isConfirmed;
};
const currentUser = () => {
  try { return JSON.parse(sessionStorage.getItem('lis_user') || '{}').username || 'admin'; }
  catch { return 'admin'; }
};
const LAB_CATEGORIES = [
  'Chemistry',
  'Hematology',
  'Serology',
  'Immunology',
  'Blood Bank',
  'Urinalysis',
  'Electrolyte',
  'Hormone',
  'Microbiology',
  'Consumables',
  'Controls & Calibrators',
  'Other',
];
const INVENTORY_EXCEL_ORDER = [
  ['H001', 'Diluent'],
  ['H002', 'Lyse solution'],
  ['H003', 'Probe cleanser'],
  ['H004', 'Anti A'],
  ['H005', 'Anti B'],
  ['H006', 'Anti D'],
  ['C001', 'Glucose', 'Glu'],
  ['C002', 'Urea/BUN', 'BUN', 'Urea'],
  ['C003', 'Creatinine'],
  ['C004', 'Cholesterol'],
  ['C005', 'Triglyceride'],
  ['C006', 'AST/GOT', 'AST', 'GOT'],
  ['C007', 'ALT/GPT', 'ALT', 'GPT'],
  ['C008', 'HDL'],
  ['C009', 'LDL'],
  ['C010', 'Total Protein'],
  ['C011', 'Bilirubin Total', 'Total Bilirubin'],
  ['C012', 'Bilirubin Direct', 'Direct Bilirubin'],
  ['C013', 'Alkaline Phosphatase', 'ALP'],
  ['C014', 'Uric Acid'],
  ['C015', 'Calcium'],
  ['C016', 'Albumin'],
  ['C017', 'GGT'],
  ['S001', 'HBS Ag', 'HBsAg'],
  ['S002', 'HBS Ab', 'HBsAb'],
  ['S003', 'HCV Ab'],
  ['S004', 'HIV'],
  ['S005', 'Typhoid'],
  ['S006', 'VDRL'],
  ['S007', 'Rikettsia'],
  ['S008', 'Infeuza,RSV,Covid19', 'Influenza RSV Covid19'],
  ['S009', 'H.Pyloric', 'H Pylori', 'H.Pylori'],
  ['S010', 'HAV'],
  ['S011', 'DengueNS1gMgG', 'Dengue NS1 IgM IgG'],
  ['S012', 'Tuberculosis(TB)', 'TB', 'Tuberculosis'],
  ['S013', 'CEA'],
  ['S014', 'AFP'],
  ['S015', 'PSA'],
  ['S016', 'HbA1C', 'HbA1c'],
  ['S017', 'T3'],
  ['S018', 'T4'],
  ['S019', 'TSH'],
  ['U001', 'Urine Test'],
  ['U002', 'Occult Blood'],
  ['U003'],
  ['U004'],
  ['U005'],
  ['U006'],
  ['C018', 'Wash concentreate', 'Wash concentrate'],
  ['M001', 'Gram stain'],
  ['H007'],
  ['H008'],
  ['S020', 'Amphetamine'],
  ['H009', 'Ts Tc', 'TS/TC'],
  ['S021', 'Gonorrhea'],
  ['S022', 'Chlamydia'],
];
const INVENTORY_CODE_ORDER = new Map();
const INVENTORY_NAME_ORDER = new Map();
const INVENTORY_ORDER_CODE = new Map();
INVENTORY_EXCEL_ORDER.forEach((entry, index) => {
  const [code, ...names] = entry;
  if (code) {
    INVENTORY_CODE_ORDER.set(String(code).toUpperCase(), index + 1);
    INVENTORY_ORDER_CODE.set(index + 1, String(code).toUpperCase());
  }
  names.forEach(name => {
    const key = normalizeInventoryName(name);
    if (key && !INVENTORY_NAME_ORDER.has(key)) INVENTORY_NAME_ORDER.set(key, index + 1);
  });
});
const inventoryCollapsedCategories = new Set(JSON.parse(localStorage.getItem('lis_inventory_collapsed_categories') || '[]'));
const saveInventoryCollapsedCategories = () => {
  localStorage.setItem('lis_inventory_collapsed_categories', JSON.stringify([...inventoryCollapsedCategories]));
};
const showModal = (id) => {
  const el = $(id); if (!el) return;
  if (window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(el).show();
  else el.style.display = 'block';
};
const hideModal = (id) => {
  const el = $(id); if (!el) return;
  if (window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(el).hide();
  else el.style.display = 'none';
};

/* ---------- shared cached lists ---------- */
const cache = window.__lisCache || (window.__lisCache = {});
for (const key of ['reagents', 'inventory', 'stockTransactions', 'testMaster', 'packages', 'settings']) {
  if (!Array.isArray(cache[key])) cache[key] = [];
}
if (!cache.__tableColumns || typeof cache.__tableColumns !== 'object') cache.__tableColumns = {};

const REAGENT_CATEGORY_SETTING_PREFIX = 'ReagentCategory:';
const FALLBACK_TABLE_COLUMNS = {
  lis_one_stock_master: new Set(['id','name','unit','created_at','reagent_id','reagent_name','low_threshold','default_unit_type','default_tests_per_unit','default_low_threshold_tests']),
  lis_one_inventory_lots: new Set(['id','lot_id','reagent_id','reagent_name','lot_no','supplier','location','receive_date','exp_date','qty','qty_remaining','created_at','current_qty','initial_qty','storage_location','lot_number','component_type','unit_type','unit_qty','tests_per_unit','total_tests','used_tests','remaining_tests','low_threshold_tests','status']),
  lis_one_stock_transactions: new Set(['id','reagent_id','reagent_name','type','qty','note','user_name','created_at','component_type','transaction_type','qty_tests','qty_unit','reference_type','reference_id','created_by','lot_no','movement_date'])
};

function knownColumnsForTable(table) {
  if (Array.isArray(cache.__tableColumns[table])) return new Set(cache.__tableColumns[table]);
  const source = table === 'lis_one_stock_master' ? cache.reagents
    : table === 'lis_one_inventory_lots' ? cache.inventory
    : table === 'lis_one_stock_transactions' ? cache.stockTransactions
    : null;
  const sample = Array.isArray(source) ? source.find(row => row && typeof row === 'object') : null;
  return sample ? new Set(Object.keys(sample)) : FALLBACK_TABLE_COLUMNS[table] || null;
}

function rememberTableColumns(table, rows = []) {
  const sample = Array.isArray(rows) ? rows.find(row => row && typeof row === 'object') : null;
  if (sample) cache.__tableColumns[table] = Object.keys(sample);
}

function tableSupportsColumn(table, column) {
  const columns = knownColumnsForTable(table);
  return !columns || columns.has(column);
}

function payloadForTable(table, payload = {}) {
  const columns = knownColumnsForTable(table);
  if (!columns) return payload;
  return Object.fromEntries(Object.entries(payload).filter(([key]) => columns.has(key)));
}

async function loadReagentCategorySettings(force = false) {
  if (force || !Array.isArray(cache.settings) || !cache.settings.length) {
    cache.settings = await api.getSettings();
  }
  return (cache.settings || []).filter(s => String(s.type || '').startsWith(REAGENT_CATEGORY_SETTING_PREFIX));
}

async function applyStoredReagentCategories(rows = []) {
  const settings = await loadReagentCategorySettings().catch(() => []);
  const byId = new Map(settings.map(s => [String(s.type).slice(REAGENT_CATEGORY_SETTING_PREFIX.length), s.value]));
  return rows.map(row => {
    const stored = byId.get(String(row.id));
    return stored ? { ...row, category: normalizeCategory(stored) } : row;
  });
}

async function saveStoredReagentCategory(id, category) {
  const type = `${REAGENT_CATEGORY_SETTING_PREFIX}${id}`;
  const value = normalizeCategory(category || 'Other');
  const settings = await loadReagentCategorySettings(true).catch(() => []);
  const existing = settings.find(s => String(s.type) === type);
  const res = existing
    ? await api.genericUpdate('lis_one_settings', existing.id, { value })
    : await api.genericInsert('lis_one_settings', { type, value });
  if (res.success) {
    cache.settings = await api.getSettings().catch(() => cache.settings);
  }
  return res;
}

async function refreshReagentCache() {
  const rows = await api.getStockMaster();
  rememberTableColumns('lis_one_stock_master', rows);
  cache.reagents = await applyStoredReagentCategories(rows);
  return cache.reagents;
}

/* ============================================================
 * SETUP TABS
 * ============================================================ */
window.setSetupTab = function(tab) {
  document.querySelectorAll('.setup-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.setupTab === tab);
  });
  document.querySelectorAll('.setup-tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.setupPanel === tab);
  });
  if (tab === 'tests')     window.loadTestMasterTable();
  if (tab === 'mapping')   window.loadMappingData();
  if (tab === 'packages')  window.loadPackagesTable();
  if (tab === 'dropdowns') window.loadSettings();
};

/* ============================================================
 * LOGOUT + SIDEBAR
 * ============================================================ */
window.performLogout = function() {
  sessionStorage.removeItem('lis_user');
  localStorage.removeItem('lis_user');
  document.body.classList.remove('lis-authenticated');
  const main = $('mainApp');
  if (main) {
    main.classList.remove('auth-visible');
    main.style.setProperty('display', 'none', 'important');
    main.style.removeProperty('visibility');
    main.style.removeProperty('opacity');
    main.style.removeProperty('pointer-events');
    main.style.removeProperty('z-index');
  }
  const login = $('loginScreen');
  if (login) {
    login.classList.remove('auth-hidden');
    login.removeAttribute('aria-hidden');
    login.style.setProperty('display', 'flex', 'important');
    login.style.setProperty('visibility', 'visible', 'important');
    login.style.setProperty('opacity', '1', 'important');
    login.style.setProperty('pointer-events', 'auto', 'important');
    login.style.setProperty('z-index', '9999', 'important');
  }
};

window.toggleSidebar = function() {
  const sb = document.querySelector('.sidebar');
  const ov = document.querySelector('.sidebar-overlay');
  if (!sb) return;
  if (window.innerWidth <= 768) {
    sb.classList.toggle('mobile-open');
    if (ov) ov.classList.toggle('active');
  } else {
    sb.classList.toggle('collapsed');
  }
};

function hardenSidebarNavigation() {
  document.querySelectorAll('.sidebar, .sidebar *, .mobile-header, .mobile-header *').forEach(el => {
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('draggable', 'false');
  });
  document.querySelectorAll('.sidebar a.nav-link, .sidebar .toggle-btn, .mobile-header button').forEach(el => {
    el.addEventListener('focus', () => el.blur());
    el.addEventListener('dragstart', event => event.preventDefault());
  });
}

/* ============================================================
 * INVENTORY
 * ============================================================ */
function lotQty(lot) {
  return Number(lot.remaining_tests ?? lot.qty_remaining ?? lot.qty ?? 0) || 0;
}

function lotQtyIn(lot) {
  return Number(lot.total_tests ?? lot.qty ?? lot.qty_remaining ?? 0) || 0;
}

function lotQtyOut(lot) {
  return Math.max(0, lotQtyIn(lot) - lotQty(lot));
}

function lotDaysLeft(lot) {
  if (!lot.exp_date) return null;
  const exp = new Date(lot.exp_date);
  if (Number.isNaN(exp.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp - today) / 86400000);
}

function lotStatusCode(lot) {
  const qty = usableTests(lot);
  const days = lotDaysLeft(lot);
  if (qty <= 0) return 'empty';
  if (days !== null && days < 0) return 'expired';
  if (days !== null && days <= 30) return 'expiring';
  if (qty <= lowThresholdTests(lot)) return 'low';
  return 'ok';
}

function inventoryStatus(lot) {
  const code = lotStatusCode(lot);
  const days = lotDaysLeft(lot);
  const map = {
    empty: '<span class="badge rounded-pill bg-danger">ໝົດ Stock</span>',
    expired: '<span class="badge rounded-pill bg-danger">ໝົດອາຍຸ</span>',
    expiring: `<span class="badge rounded-pill bg-warning text-dark">ໃກ້ໝົດ ${days} ມື້</span>`,
    low: '<span class="badge rounded-pill bg-warning text-dark">Stock ຕ່ຳ</span>',
    ok: '<span class="badge rounded-pill bg-success">ພ້ອມໃຊ້</span>'
  };
  return map[code] || map.ok;
}

function masterForLot(lot) {
  return cache.reagents.find(r => Number(r.id) === Number(lot.reagent_id))
    || cache.reagents.find(r => String(r.name || '').trim().toLowerCase() === String(lot.reagent_name || '').trim().toLowerCase())
    || {};
}

function itemCode(row) {
  return row.item_code || row.item_id || masterForLot(row).item_code || '';
}

function normalizeInventoryName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function inventoryOrderValue(row) {
  const code = String(itemCode(row) || row.item_code || row.item_id || '').trim().toUpperCase();
  if (code && INVENTORY_CODE_ORDER.has(code)) return INVENTORY_CODE_ORDER.get(code);
  const master = masterForLot(row);
  const candidates = [
    row.reagent_name,
    row.name,
    row.test_name,
    master.name,
    row.item,
  ];
  for (const value of candidates) {
    const key = normalizeInventoryName(value);
    if (key && INVENTORY_NAME_ORDER.has(key)) return INVENTORY_NAME_ORDER.get(key);
    for (const [knownName, order] of INVENTORY_NAME_ORDER.entries()) {
      if (key && knownName && (key.startsWith(knownName) || knownName.startsWith(key))) return order;
    }
  }
  const storedOrder = Number(row.sort_order ?? master.sort_order ?? 0);
  return storedOrder > 0 ? storedOrder : 9999;
}

function inventoryExcelComparator(a, b) {
  const orderDiff = inventoryOrderValue(a) - inventoryOrderValue(b);
  if (orderDiff) return orderDiff;
  const codeDiff = String(itemCode(a) || '').localeCompare(String(itemCode(b) || ''), undefined, { numeric: true });
  if (codeDiff) return codeDiff;
  const nameDiff = String(a.reagent_name || a.name || '').localeCompare(String(b.reagent_name || b.name || ''), undefined, { numeric: true });
  if (nameDiff) return nameDiff;
  return String(a.lot_no || '').localeCompare(String(b.lot_no || ''), undefined, { numeric: true });
}

function inventoryDisplayCode(row) {
  const explicit = itemCode(row);
  if (explicit) return explicit;
  return INVENTORY_ORDER_CODE.get(inventoryOrderValue(row)) || '';
}

function itemDetails(row) {
  return row.details || row.pack_size || masterForLot(row).details || '';
}

function itemCategory(row) {
  return row.category || masterForLot(row).category || 'Other';
}

function normalizeCategory(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Other';
  const exact = LAB_CATEGORIES.find(c => c.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  if (/clinical\s*chem|chem|biochem|albumin|alp|amylase|bilirubin|bun|calcium|cholesterol|creatinine|glucose|lipid|protein|sgot|sgpt|triglyceride|uric/i.test(raw)) return 'Chemistry';
  if (/immun/i.test(raw)) return 'Immunology';
  if (/sero/i.test(raw)) return 'Serology';
  if (/blood/i.test(raw) && /bank/i.test(raw)) return 'Blood Bank';
  if (/urine|urinal/i.test(raw)) return 'Urinalysis';
  if (/electro/i.test(raw)) return 'Electrolyte';
  if (/hormone/i.test(raw)) return 'Hormone';
  if (/micro|culture|bacteria/i.test(raw)) return 'Microbiology';
  if (/control|calibrator|qc|standard/i.test(raw)) return 'Controls & Calibrators';
  if (/consumable|tube|tip|cup|needle|syringe|glove|swab/i.test(raw)) return 'Consumables';
  if (/tumou?r|marker|afp|ca-|cea|psa|ft3|ft4|tsh/i.test(raw)) return 'Immunology';
  if (/rapid|vdrl|hbs|hcv|hiv|dengue|typhoid/i.test(raw)) return 'Serology';
  if (/hema/i.test(raw)) return 'Hematology';
  return 'Other';
}

function categoryBadge(category) {
  const c = normalizeCategory(category);
  const colors = {
    Chemistry: 'lab-cat-chemistry',
    Hematology: 'lab-cat-hematology',
    Serology: 'lab-cat-serology',
    Immunology: 'lab-cat-immunology',
    'Blood Bank': 'lab-cat-bloodbank',
    Urinalysis: 'lab-cat-urinalysis',
    Electrolyte: 'lab-cat-electrolyte',
    Hormone: 'lab-cat-hormone',
    Microbiology: 'lab-cat-microbiology',
    Consumables: 'lab-cat-consumables',
    'Controls & Calibrators': 'lab-cat-controls',
    Other: 'lab-cat-other',
  };
  return `<span class="badge rounded-pill border lab-category-badge ${colors[c] || colors.Other}">${esc(c)}</span>`;
}

function componentType(row) {
  const explicit = row.component_type || row.component || '';
  if (explicit) return String(explicit).toUpperCase() === 'FULL' ? 'Single' : explicit;
  const details = itemDetails(row);
  const hasR1 = /\bR1\b/i.test(details);
  const hasR2 = /\bR2\b/i.test(details);
  if (hasR1 && hasR2) return 'Single';
  if (hasR1) return 'R1';
  if (hasR2) return 'R2';
  return 'Single';
}

function unitType(row) {
  return row.unit_type || row.unit || masterForLot(row).default_unit_type || masterForLot(row).unit || 'test';
}

function testsPerUnit(row) {
  return Number(row.tests_per_unit ?? masterForLot(row).default_tests_per_unit ?? 1) || 1;
}

function lowThresholdTests(row) {
  return Number(row.low_threshold_tests ?? masterForLot(row).default_low_threshold_tests ?? masterForLot(row).low_threshold ?? 5) || 5;
}

function groupKey(row) {
  return `${row.reagent_id || row.reagent_name || ''}::${row.lot_no || row.lot_id || ''}`;
}

function relatedLotComponents(row) {
  const related = cache.inventory.filter(l => groupKey(l) === groupKey(row));
  return related.length ? related : [row];
}

function componentRemaining(row, component) {
  return relatedLotComponents(row)
    .filter(l => String(componentType(l)).toUpperCase() === component)
    .reduce((sum, l) => sum + lotQty(l), 0);
}

function usableTests(row) {
  const related = relatedLotComponents(row);
  const components = [...new Set(related.map(l => String(componentType(l)).toUpperCase()))]
    .filter(c => ['R1', 'R2', 'R3'].includes(c));
  if (components.length >= 2) return Math.min(...components.map(c => componentRemaining(row, c)));
  if (components.length === 1) return componentRemaining(row, components[0]);
  return related.reduce((sum, l) => sum + lotQty(l), 0);
}

function componentProfile(row) {
  const components = [...new Set(relatedLotComponents(row).map(l => String(componentType(l)).toUpperCase()))]
    .filter(c => ['R1', 'R2', 'R3'].includes(c))
    .sort();
  return components.length ? components.join('+') : 'SINGLE';
}

function componentStockBadges(row) {
  const profile = componentProfile(row);
  if (profile === 'SINGLE') {
    return `<span class="component-pill component-single">SINGLE: ${lotQty(row).toLocaleString()}</span>`;
  }
  return ['R1', 'R2', 'R3'].map(c => {
    const qty = componentRemaining(row, c);
    const cls = c === 'R1' ? 'component-r1' : c === 'R2' ? 'component-r2' : 'component-r3';
    return `<span class="component-pill ${cls}">${c}: ${qty ? qty.toLocaleString() : '-'}</span>`;
  }).join('');
}

function statusBadgeClass(status) {
  return status === 'Normal' || status === 'ok'
    ? 'bg-success'
    : status === 'Low Stock' || status === 'low'
      ? 'bg-warning text-dark'
      : status === 'Expiring Soon' || status === 'expiring'
        ? 'bg-orange text-dark'
        : 'bg-danger';
}

function txTypeBadge(type) {
  const t = String(type || '').toUpperCase();
  const icon = t === 'IN' ? 'bi-arrow-down-circle' : t === 'OUT' ? 'bi-arrow-up-circle' : t === 'ADJUST' ? 'bi-sliders' : t === 'WASTE' ? 'bi-trash3' : 'bi-dot';
  const cls = t === 'IN' ? 'movement-in' : t === 'OUT' ? 'movement-out' : t === 'ADJUST' ? 'movement-adjust' : t === 'EXPIRED' ? 'movement-expired' : 'movement-other';
  const laoLabel = t === 'IN' ? 'ຮັບເຂົ້າ'
    : t === 'OUT' ? 'ເບີກໃຊ້'
    : t === 'ADJUST' ? 'ປັບ stock'
    : t === 'EXPIRED' ? 'ໝົດອາຍຸ'
    : t === 'WASTE' ? 'ເສຍ'
    : t || '-';
  return `<span class="movement-type ${cls}"><i class="bi ${icon}"></i><span class="mt-lao">${esc(laoLabel)}</span><span class="mt-en">${esc(t || '')}</span></span>`;
}

function txSourceLabel(tx) {
  const source = String(tx.reference_type || tx.source || '').trim();
  if (/auto/i.test(source)) return 'Auto deduct (ຫັກອັດຕະໂນມັດ)';
  if (/adjust/i.test(source) || String(tx.transaction_type || '').toUpperCase() === 'ADJUST') return 'ປັບປ່ຽນ (Manual adjustment)';
  if (/order/i.test(source)) return 'ຈາກ Order';
  if (/manual/i.test(source)) return 'ມືບັນທຶກ (Manual)';
  return source || 'ມືບັນທຶກ (Manual)';
}

function txReferenceLink(tx) {
  const ref = tx.reference_id || tx.order_id || '';
  if (!ref) return esc(tx.note || '-');
  return `<span class="movement-order-link">${esc(ref)}</span>${tx.note ? `<div class="small text-muted">${esc(tx.note)}</div>` : ''}`;
}

function unitRemaining(row) {
  const perUnit = testsPerUnit(row);
  return perUnit ? lotQty(row) / perUnit : Number(row.unit_qty || 0);
}

function inventoryDateRange() {
  return { sd: $('invStartDate')?.value || '', ed: $('invEndDate')?.value || '' };
}

function txDate(tx) {
  return String(tx.movement_date || tx.created_at || tx.date || tx.transaction_date || '').slice(0, 10);
}

function transactionComponent(tx) {
  if (tx.component_type) return tx.component_type;
  const note = String(tx.note || '');
  const m = note.match(/\b(R1|R2|R3|Control|Calibrator)\b/i);
  if (m) return m[1].toUpperCase();
  const lot = cache.inventory.find(l => Number(l.reagent_id) === Number(tx.reagent_id) && (!tx.lot_no || l.lot_no === tx.lot_no));
  return lot ? componentType(lot) : 'FULL';
}

function txCategory(tx) {
  if (tx.category) return normalizeCategory(tx.category);
  const lot = cache.inventory.find(l =>
    (Number(l.reagent_id) === Number(tx.reagent_id) || String(l.reagent_name || '') === String(tx.reagent_name || '')) &&
    (!tx.lot_no || !l.lot_no || String(l.lot_no) === String(tx.lot_no))
  );
  if (lot) return normalizeCategory(itemCategory(lot));
  const master = cache.reagents.find(r => Number(r.id) === Number(tx.reagent_id) || String(r.name || '') === String(tx.reagent_name || ''));
  return normalizeCategory(master?.category || 'Other');
}

function filteredTransactions() {
  const { sd, ed } = inventoryDateRange();
  const categoryFilter = $('inventoryCategoryFilter')?.value || '';
  const movementTypeFilter = $('inventoryMovementTypeFilter')?.value || '';
  return (cache.stockTransactions || []).filter(tx => {
    const d = txDate(tx);
    const type = String(tx.type || tx.transaction_type || '').toUpperCase();
    if (sd && d && d < sd) return false;
    if (ed && d && d > ed) return false;
    if (categoryFilter && txCategory(tx) !== categoryFilter) return false;
    if (movementTypeFilter && type !== movementTypeFilter) return false;
    return true;
  });
}

function stockTotalByReagent(reagentId, reagentName) {
  return cache.inventory
    .filter(l => Number(l.reagent_id) === Number(reagentId) || String(l.reagent_name || '') === String(reagentName || ''))
    .reduce((sum, l) => sum + lotQty(l), 0);
}

function categoryList(rows = cache.inventory) {
  const seen = new Set();
  LAB_CATEGORIES.forEach(c => seen.add(c));
  rows.forEach(r => seen.add(normalizeCategory(itemCategory(r))));
  return [...seen].filter(Boolean);
}

function populateInventoryCategoryFilter() {
  const sel = $('inventoryCategoryFilter');
  if (!sel) return;
  const current = sel.value || '';
  // Show only categories that actually have inventory rows.
  // Avoids the "select Chemistry → empty" surprise when DB has no chemistry data.
  const present = new Set();
  cache.inventory.forEach(r => {
    const c = normalizeCategory(itemCategory(r));
    if (c) present.add(c);
  });
  const options = [...present].sort();
  sel.innerHTML = '<option value="">ທຸກໝວດ (All)</option>' +
    options.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (options.includes(current)) sel.value = current;
}

function categoryStats(rows = cache.inventory) {
  const map = new Map();
  const groupedLots = new Map();
  rows.forEach(r => {
    const key = groupKey(r);
    if (!groupedLots.has(key)) groupedLots.set(key, []);
    groupedLots.get(key).push(r);
  });
  groupedLots.forEach(group => {
    const first = group[0] || {};
    const category = normalizeCategory(itemCategory(first));
    if (!map.has(category)) map.set(category, { category, reagents: new Set(), low: 0, expiring: 0, usable: 0, used: 0 });
    const stat = map.get(category);
    stat.reagents.add(first.reagent_id || first.reagent_name);
    const status = lotStatusCode(first);
    if (status === 'low' || status === 'empty') stat.low += 1;
    if (status === 'expiring' || status === 'expired') stat.expiring += 1;
    stat.usable += usableTests(first);
  });
  filteredTransactions().forEach(tx => {
    const category = txCategory(tx);
    if (!map.has(category)) map.set(category, { category, reagents: new Set(), low: 0, expiring: 0, usable: 0, used: 0 });
    if (String(tx.type || tx.transaction_type).toUpperCase() === 'OUT') map.get(category).used += txQty(tx);
  });
  return [...map.values()].map(s => ({ ...s, total: s.reagents.size }));
}

function renderInventoryCategorySummary(rows = cache.inventory) {
  const box = $('inventoryCategorySummary');
  const stats = categoryStats(rows).filter(s => s.total || s.low || s.expiring);
  const html = stats.map(s => `
    <div class="col-6 col-md-3 col-xl-2">
      <div class="inventory-category-mini lab-category-card h-100">
        <div class="d-flex justify-content-between align-items-center mb-1">
          ${categoryBadge(s.category)}
          <span class="fw-bold">${s.total}</span>
        </div>
        <div class="small text-muted">Low: <b class="text-warning">${s.low}</b> | Usable: <b class="text-success">${Math.round(s.usable).toLocaleString()}</b></div>
      </div>
    </div>`).join('');
  if (box) box.innerHTML = html;
  const overviewBox = $('inventoryOverviewCategorySummary');
  if (overviewBox) overviewBox.innerHTML = html || '<div class="col-12 text-muted small">No reagent categories yet.</div>';
}

function groupedInventoryLotsFrom(rows = cache.inventory) {
  const map = new Map();
  rows.forEach(lot => {
    const key = groupKey(lot);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(lot);
  });
  return [...map.values()]
    .map(group => group.slice().sort(inventoryExcelComparator))
    .sort((a, b) => inventoryExcelComparator(a[0] || {}, b[0] || {}));
}

function inventoryAlertGroups(rows = cache.inventory) {
  const groups = groupedInventoryLotsFrom(rows);
  return {
    expiring7: groups.filter(g => {
      const days = lotDaysLeft(g[0] || {});
      return days !== null && days >= 0 && days <= 7;
    }),
    expiring: groups.filter(g => {
      const days = lotDaysLeft(g[0] || {});
      return days !== null && days >= 0 && days <= 30;
    }),
    low: groups.filter(g => lotStatusCode(g[0] || {}) === 'low'),
    out: groups.filter(g => lotStatusCode(g[0] || {}) === 'empty'),
    mismatch: groups.filter(g => {
      const totals = ['R1', 'R2', 'R3'].map(c => componentRemaining(g[0] || {}, c)).filter(v => v > 0);
      return totals.length >= 2 && Math.max(...totals) !== Math.min(...totals);
    }),
    stale: groups.filter(g => {
      const first = g[0] || {};
      const latest = (cache.stockTransactions || [])
        .filter(tx => String(tx.reagent_name || '') === String(first.reagent_name || '') || Number(tx.reagent_id) === Number(first.reagent_id))
        .map(tx => new Date(tx.created_at || tx.movement_date || tx.date || 0).getTime())
        .filter(Boolean)
        .sort((a, b) => b - a)[0];
      return latest ? ((Date.now() - latest) / 86400000) > 30 : true;
    })
  };
}

function renderInventoryAlertDetails(rows = cache.inventory) {
  const panel = $('inventoryAlertsPanel');
  if (!panel) return;
  const alertData = inventoryAlertGroups(rows);
  // [tone, laoTitle, enTitle, group, urgency, laoAction, icon]
  const sectionData = [
    ['red',    'ໃກ້ໝົດອາຍຸພາຍໃນ 7 ມື້',  'Expiring within 7 days',  alertData.expiring7, 'high', 'ໃຊ້ດ່ວນ ຫຼື ແຍກອອກຖ້າໝົດອາຍຸ',           'bi-alarm'],
    ['orange', 'ໃກ້ໝົດອາຍຸພາຍໃນ 30 ມື້', 'Expiring within 30 days', alertData.expiring,  'med',  'ໃຊ້ Lot ນີ້ກ່ອນ ແລະ ຢ່າສັ່ງເພີ່ມ',         'bi-calendar-x'],
    ['yellow', 'Stock ໃກ້ໝົດ',           'Low stock items',         alertData.low,       'high', 'ກຽມສັ່ງຊື້ ຫຼື ຮັບເຂົ້າສາງ',                  'bi-exclamation-triangle'],
    ['blue',   'ບໍ່ມີການເຄື່ອນໄຫວ > 30 ມື້','No movement > 30 days',  alertData.stale,     'low',  'ກວດສອບຄວາມຕ້ອງການ ແລະ ບ່ອນເກັບ',     'bi-pause-circle'],
    ['red',    'R2 ບໍ່ສົມດຸນ',            'R2 imbalance alerts',     alertData.mismatch,  'med',  'ກວດຄູ່ component ກ່ອນສັ່ງເພີ່ມ',          'bi-diagram-2'],
  ];
  const urgencyText = { high: 'ດ່ວນ', med: 'ປານກາງ', low: 'ຕິດຕາມ' };
  const itemHtml = (group, urgency, action) => {
    const row = group[0] || {};
    return `<div class="lab-alert-item">
      <div class="flex-grow-1">
        <div class="alert-reagent">
          ${esc(row.reagent_name || '-')}
          <span class="alert-urgency urgency-${urgency}">${urgencyText[urgency]}</span>
        </div>
        <div class="alert-meta">Lot ${esc(row.lot_no || '-')} · ${componentProfile(row)} · usable ${usableTests(row).toLocaleString()} tests</div>
        <div class="alert-action-cta"><i class="bi bi-arrow-right-circle"></i> ${esc(action)}</div>
      </div>
    </div>`;
  };
  panel.innerHTML = sectionData.map(([tone, laoTitle, enTitle, group, urgency, action, icon]) => `
    <div class="col-12 col-xl-6">
      <div class="lab-alert-section lab-alert-${tone}">
        <div class="lab-alert-heading">
          <span><i class="bi ${icon}"></i> ${laoTitle} <span class="text-muted small fw-normal" style="font-style:italic;margin-left:4px;">${enTitle}</span></span>
          <b>${group.length}</b>
        </div>
        <div class="lab-alert-list">
          ${group.slice(0, 6).map(g => itemHtml(g, urgency, action)).join('') || '<div class="text-muted small py-2">ບໍ່ມີລາຍການໃນໝວດນີ້.</div>'}
        </div>
      </div>
    </div>`).join('');
}

function renderInventoryOverview(rows = cache.inventory) {
  const cards = $('inventoryOverviewCards');
  const charts = $('inventoryOverviewCharts');
  const overviewAlerts = $('inventoryOverviewAlerts');
  const alertsPanel = $('inventoryAlertsPanel');
  const groups = groupedInventoryLotsFrom(rows);
  const statuses = groups.map(g => lotStatusCode(g[0] || {}));
  const usableTotal = groups.reduce((s, g) => s + usableTests(g[0] || {}), 0);
  const inventoryValue = groups.reduce((s, g) => {
    const row = g[0] || {};
    const cost = Number(row.unit_cost ?? row.cost ?? row.price ?? row.reagent_price ?? 0) || 0;
    return s + (cost * unitRemaining(row));
  }, 0);
  const report = reportRows();
  const stockoutSoon = report.filter(r => r.estimated_weeks_left !== null && r.estimated_weeks_left <= 2).length;
  const today = new Date().toISOString().slice(0, 10);
  const todayOut = (cache.stockTransactions || [])
    .filter(t => String(t.type || t.transaction_type).toUpperCase() === 'OUT' && txDate(t) === today)
    .reduce((s, t) => s + txQty(t), 0);
  const cardData = [
    ['ນ້ຳຢາທັງໝົດ', 'Total reagents', groups.length, 'bi-boxes', 'primary'],
    ['ໃກ້ໝົດອາຍຸ', 'Expiring soon', statuses.filter(s => s === 'expiring' || s === 'expired').length, 'bi-calendar-x', 'danger'],
    ['ໃກ້ໝົດ stock', 'Low / out of stock', statuses.filter(s => s === 'low' || s === 'empty').length, 'bi-exclamation-triangle', 'warning'],
    ['ເບີກໃຊ້ມື້ນີ້', 'Issued today', todayOut.toLocaleString(), 'bi-box-arrow-up', 'info'],
    ['Usable tests ທັງໝົດ', 'Usable tests total', Math.round(usableTotal).toLocaleString(), 'bi-check2-circle', 'success'],
  ];
  if (cards) cards.innerHTML = cardData.map(([lao, en, value, icon, color]) => `
    <div class="col-6 col-md-4 col-xl">
      <div class="inventory-overview-card">
        <div class="inventory-overview-icon text-${color}"><i class="bi ${icon}"></i></div>
        <div class="ovc-lao">${lao}</div>
        <div class="ovc-en">${en}</div>
        <div class="inventory-overview-value">${value}</div>
      </div>
    </div>`).join('');

  const tx = filteredTransactions();
  const outTotal = tx.filter(t => String(t.type || t.transaction_type).toUpperCase() === 'OUT').reduce((s, t) => s + txQty(t), 0);
  const inTotal = tx.filter(t => String(t.type || t.transaction_type).toUpperCase() === 'IN').reduce((s, t) => s + txQty(t), 0);
  const expiring = inventoryAlertGroups(rows).expiring.length;
  const max = Math.max(outTotal, inTotal, expiring, 1);
  if (charts) charts.innerHTML = [
    ['Usable ທັງໝົດ', usableTotal, 'bg-success'],
    ['ເບີກໃຊ້ (Used)', outTotal, 'bg-primary'],
    ['ຮັບເຂົ້າ (Received)', inTotal, 'bg-info'],
    ['ໃກ້ໝົດອາຍຸ', expiring, 'bg-warning']
  ].map(([label, value, color]) => `
    <div class="inventory-chart-row">
      <div class="d-flex justify-content-between small mb-1"><span>${label}</span><b>${Number(value).toLocaleString()}</b></div>
      <div class="inventory-chart-track"><span class="${color}" style="width:${Math.max(6, Math.min(100, (Number(value) / max) * 100))}%"></span></div>
    </div>`).join('');

  const alertData = inventoryAlertGroups(rows);
  const alertCards = [
    ['ໃກ້ໝົດອາຍຸໃນ 7 ມື້', alertData.expiring7.length, 'danger', 'bi-alarm'],
    ['ໃກ້ໝົດອາຍຸໃນ 30 ມື້', alertData.expiring.length, 'warning', 'bi-calendar-x'],
    ['Stock ຕ່ຳ', alertData.low.length, 'warning', 'bi-exclamation-triangle'],
    ['ໝົດ Stock', alertData.out.length, 'danger', 'bi-x-octagon'],
    ['R2 ບໍ່ສົມດຸນ', alertData.mismatch.length, 'info', 'bi-diagram-2'],
    ['ບໍ່ມີການເຄື່ອນໄຫວດົນ', alertData.stale.length, 'secondary', 'bi-pause-circle'],
  ].map(([label, value, color, icon]) => `
    <div class="col-6 col-lg">
      <div class="inventory-alert-card border-${color}">
        <i class="bi ${icon} text-${color}"></i>
        <div><div class="fw-bold">${value}</div><div class="small text-muted">${label}</div></div>
      </div>
    </div>`).join('');
  if (overviewAlerts) overviewAlerts.innerHTML = alertCards;
  renderInventoryAttention(rows);
  applyInventoryGuideState();
  renderInventoryAlertDetails(rows);
}

// Getting-started guide: persist collapsed/open state per browser
const INV_GUIDE_KEY = 'lis_inventory_guide_collapsed';
function applyInventoryGuideState() {
  const guide = document.getElementById('inventoryGuide');
  if (!guide) return;
  const collapsed = localStorage.getItem(INV_GUIDE_KEY) === '1';
  guide.classList.toggle('collapsed', collapsed);
  guide.querySelectorAll('[data-ig-show="open"]').forEach(el => el.hidden = collapsed);
  guide.querySelectorAll('[data-ig-show="closed"]').forEach(el => el.hidden = !collapsed);
}
window.toggleInventoryGuide = function() {
  const cur = localStorage.getItem(INV_GUIDE_KEY) === '1';
  localStorage.setItem(INV_GUIDE_KEY, cur ? '0' : '1');
  applyInventoryGuideState();
};

// "Today's attention" strip: shows the 1–2 most urgent items at the top
function renderInventoryAttention(rows = cache.inventory) {
  const box = document.getElementById('inventoryAttention');
  if (!box) return;
  const data = inventoryAlertGroups(rows);
  const lines = [];
  if (data.expiring7.length) {
    lines.push({
      kind: 'danger',
      icon: 'bi-alarm-fill',
      text: `ມີ <b>${data.expiring7.length}</b> ລາຍການຈະໝົດອາຍຸໃນ 7 ມື້ — ໃຊ້ດ່ວນ ຫຼື ແຍກອອກ`,
      cta: 'ເບິ່ງລາຍງານ',
      onclick: "setInventoryTab('report')"
    });
  }
  if (data.low.length || data.out.length) {
    const n = data.low.length + data.out.length;
    lines.push({
      kind: 'warn',
      icon: 'bi-exclamation-triangle-fill',
      text: `ມີ <b>${n}</b> ລາຍການ stock ຕ່ຳ/ໝົດ — ກຽມສັ່ງຊື້ ຫຼື ຮັບເຂົ້າສາງ`,
      cta: 'ຮັບເຂົ້າສາງ',
      onclick: 'openAddLotModal()'
    });
  }
  box.innerHTML = lines.map(l => `
    <div class="ia-row ${l.kind === 'danger' ? 'ia-danger' : ''}">
      <i class="bi ${l.icon}"></i>
      <span>${l.text}</span>
      <button type="button" class="ia-action" onclick="${l.onclick}">${l.cta} →</button>
    </div>`).join('');
}

window.setInventoryTab = function(tab) {
  const active = tab || 'report';
  document.querySelectorAll('.inventory-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.inventoryTab === active);
  });
  document.querySelectorAll('.inventory-tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `inventoryTab${active[0].toUpperCase()}${active.slice(1)}`);
  });
  if (active === 'report') {
    renderInventoryReport();
    renderStockMovementRows();
  }
  if (active === 'stock') {
    populateInventoryCategoryFilter();
    renderInventoryRows(cache.inventory);
    renderInventoryAttention(cache.inventory);
  }
  if (active === 'movements') {
    renderStockMovementRows();
  }
  if (active === 'settings') renderInventorySettingsPanel();
};

window.toggleInventoryCategoryGroup = function(key) {
  if (inventoryCollapsedCategories.has(key)) inventoryCollapsedCategories.delete(key);
  else inventoryCollapsedCategories.add(key);
  saveInventoryCollapsedCategories();
  const escaped = window.CSS?.escape ? CSS.escape(key) : String(key).replace(/"/g, '\\"');
  const collapsed = inventoryCollapsedCategories.has(key);
  document.querySelectorAll(`[data-inv-category-row="${escaped}"]`).forEach(row => row.classList.toggle('d-none', collapsed));
  const icon = document.querySelector(`[data-inv-category-icon="${escaped}"]`);
  if (icon) icon.classList.toggle('bi-chevron-right', collapsed);
  if (icon) icon.classList.toggle('bi-chevron-down', !collapsed);
};

async function insertWithSchemaFallback(table, fullPayload, fallbackPayload) {
  const res = await api.genericInsert(table, payloadForTable(table, fullPayload));
  if (res.success) return res;
  if (res.status === 401 || res.status === 403) return res;
  if (!fallbackPayload || !Object.keys(fallbackPayload).length) return res;
  console.warn(`[CRUD] ${table} full insert failed; retrying minimal payload`, res.error);
  return api.genericInsert(table, payloadForTable(table, fallbackPayload));
}

async function updateWithSchemaFallback(table, id, fullPayload, fallbackPayload, idCol = 'id') {
  const res = await api.genericUpdate(table, id, payloadForTable(table, fullPayload), idCol);
  if (res.success) return res;
  if (res.status === 401 || res.status === 403) return res;
  if (!fallbackPayload || !Object.keys(fallbackPayload).length) return res;
  console.warn(`[CRUD] ${table} full update failed; retrying minimal payload`, res.error);
  return api.genericUpdate(table, id, payloadForTable(table, fallbackPayload), idCol);
}

function isMissingColumnError(error, column) {
  const message = String(error?.message || error || '');
  return message.includes(`'${column}' column`) || message.includes(`\"${column}\" column`) || message.includes(` ${column} column`);
}

function renderInventoryRows(rows) {
  const body = $('inventoryTableBody'); if (!body) return;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-3">No inventory data</td></tr>';
    return;
  }
  const orderedRows = groupedInventoryLotsFrom(rows).map(group => group[0] || {}).sort(inventoryExcelComparator);
  body.innerHTML = orderedCategoryBlocks(orderedRows).map(({ category, rows: groupRows }) => {
    const key = category.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'other';
    const collapsed = inventoryCollapsedCategories.has(key);
    const low = groupRows.filter(r => ['low', 'empty'].includes(lotStatusCode(r))).length;
    const exp = groupRows.filter(r => ['expiring', 'expired'].includes(lotStatusCode(r))).length;
    const subtotalUsable = groupRows.reduce((s, r) => s + usableTests(r), 0);
    const header = `<tr class="inventory-category-row lab-group-row">
      <td colspan="11" class="py-2">
        <div class="cat-header-wrap">
          <button type="button" class="btn btn-sm btn-link text-decoration-none p-0" onclick="toggleInventoryCategoryGroup('${esc(key)}')">
            <i class="bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-down'}" data-inv-category-icon="${esc(key)}"></i>
          </button>
          ${categoryBadge(category)}
          <span class="cat-header-name">${esc(category)}</span>
          <span class="cat-header-count">${groupRows.length} ລາຍການ</span>
          <span class="ms-auto small text-success"><i class="bi bi-check2-circle"></i> Usable ${Math.round(subtotalUsable).toLocaleString()}</span>
          ${low ? `<span class="small text-warning"><i class="bi bi-exclamation-triangle"></i> ໃກ້ໝົດ ${low}</span>` : ''}
          ${exp ? `<span class="small text-danger"><i class="bi bi-calendar-x"></i> ໃກ້ໝົດອາຍຸ ${exp}</span>` : ''}
        </div>
      </td>
    </tr>`;
    const detailRows = groupRows.map(r => {
      const qtyIn = lotQtyIn(r);
      const usable = usableTests(r);
      const units = unitRemaining(r);
      const days = lotDaysLeft(r);
      const status = lotStatusCode(r);
      const daysText = days === null ? '-' : (days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`);
      const rowClass = status === 'expired' || status === 'empty' ? 'lab-row-danger' : status === 'expiring' || status === 'low' ? 'lab-row-warning' : '';
      const compPill = componentStockBadges(r); // single component pill, fits one line
      const displayCode = inventoryDisplayCode(r);
      return `<tr class="inventory-lab-row ${rowClass} ${collapsed ? 'd-none' : ''}" data-inv-category-row="${esc(key)}">
      <td class="ps-3 col-cat-cell"><span class="cat-dot cat-dot-${esc(key)}"></span></td>
      <td class="fw-semibold col-reagent-cell">
        <span class="reagent-primary" title="${esc(r.reagent_name || '-')}">${esc(r.reagent_name || '-')}</span>
        <span class="reagent-code">${esc(displayCode)}</span>
      </td>
      <td><button type="button" class="btn btn-link btn-sm p-0 movement-order-link" onclick="openStockHistoryModal()">${esc(r.lot_no || '-')}</button></td>
      <td class="col-components"><div class="component-pill-wrap">${compPill}</div></td>
      <td class="text-end fw-bold text-success">${usable.toLocaleString()}</td>
      <td class="text-end col-hide-sm">${units.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${esc(unitType(r))}</td>
      <td class="col-hide-sm">${fmtDate(r.exp_date) || '-'}</td>
      <td class="text-center">${esc(daysText)}</td>
      <td class="text-center">${inventoryStatus(r)}</td>
      <td class="small lab-secondary-text col-hide-md text-truncate" style="max-width:140px" title="${esc(r.location || '')} / ${esc(r.supplier || '')}">${esc(r.location || r.supplier || '-')}</td>
      <td class="text-center">
        <div class="row-actions">
          <button class="ra-btn ra-adjust" onclick="openStockAdjustModal(${r.id})" title="ປັບຍອດ stock ເວລານັບສາງຕົວຈິງ"><i class="bi bi-pencil-square"></i> ປັບຍອດ</button>
          <button class="ra-btn ra-icon" onclick="openStockHistoryModal()" title="ປະຫວັດ"><i class="bi bi-clock-history"></i></button>
          <button class="ra-btn ra-icon admin-only" onclick="editInvLot(${r.id})" title="ແກ້ໄຂ Lot"><i class="bi bi-pencil"></i></button>
          <button class="ra-btn ra-icon ra-danger admin-only" onclick="deleteInvLot(${r.id})" title="ລຶບ"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>`;
    }).join('');
    return header + detailRows;
  }).join('');
}

function applyInventoryFilters() {
  const sd = $('invStartDate')?.value;
  const ed = $('invEndDate')?.value;
  const q = ($('inventorySearch')?.value || '').trim().toLowerCase();
  const statusFilter = $('inventoryStatusFilter')?.value || '';
  const categoryFilter = $('inventoryCategoryFilter')?.value || '';
  let rows = cache.inventory.slice();
  // Date controls filter the movement report/KPIs. The stock list stays current
  // so users can always see the on-hand balance while reviewing any period.
  if (q) {
    rows = rows.filter(r => [itemCode(r), r.reagent_name, itemDetails(r), componentType(r), itemCategory(r), r.lot_no, r.location, r.supplier]
      .some(v => String(v || '').toLowerCase().includes(q)));
  }
  if (statusFilter) rows = rows.filter(r => lotStatusCode(r) === statusFilter);
  if (categoryFilter) rows = rows.filter(r => normalizeCategory(itemCategory(r)) === categoryFilter);

  populateInventoryCategoryFilter();
  renderInventoryCategorySummary(rows);
  if ($('invTotalLots'))  $('invTotalLots').textContent = cache.reagents.length || new Set(cache.inventory.map(r => r.reagent_id || r.reagent_name)).size;
  if ($('invExpiringSoon')) $('invExpiringSoon').textContent = cache.inventory.filter(r => ['expiring', 'expired', 'low', 'empty'].includes(lotStatusCode(r))).length;
  const txRows = filteredTransactions();
  if ($('invTotalIn'))  $('invTotalIn').textContent = txRows.filter(t => String(t.type || t.transaction_type).toUpperCase() === 'IN').reduce((s,t) => s + txQty(t), 0).toLocaleString();
  if ($('invTotalOut')) $('invTotalOut').textContent = txRows.filter(t => String(t.type || t.transaction_type).toUpperCase() === 'OUT').reduce((s,t) => s + txQty(t), 0).toLocaleString();
  renderInventoryRows(rows);
  renderStockMovementRows();
  renderInventoryUsageReport();
  renderInventoryOverview(cache.inventory);
  renderInventorySettingsPanel();
}
window.applyInventoryFilters = applyInventoryFilters;

function renderStockMovementRows() {
  const compactBody = $('stockMovementTableBody');
  const modalBody = $('stockHistoryTableBody');
  const rows = filteredTransactions().slice(0, 500);
  const makeRow = (r) => {
    const type = String(r.type || r.transaction_type || '').toUpperCase();
    const qty = txQty(r);
    const remain = stockTotalByReagent(r.reagent_id, r.reagent_name);
    const user = r.created_by || r.user_name || '-';
    return `<tr class="inventory-lab-row">
      <td class="ps-3">${fmtDate(r.created_at || r.date || r.transaction_date)}</td>
      <td>${categoryBadge(txCategory(r))}</td>
      <td class="fw-semibold">${esc(r.reagent_name || '-')}</td>
      <td><button type="button" class="btn btn-link btn-sm p-0 movement-order-link" onclick="openStockHistoryModal()">${esc(r.lot_no || '-')}</button></td>
      <td><span class="component-pill component-single">${esc(transactionComponent(r))}</span></td>
      <td class="text-center">${txTypeBadge(type)}</td>
      <td class="text-end fw-bold">${qty.toLocaleString()}</td>
      <td class="text-end fw-bold text-primary">${remain.toLocaleString()}</td>
      <td><span class="small fw-semibold">${esc(txSourceLabel(r))}</span><div class="small text-muted">${esc(user)}</div></td>
      <td>${txReferenceLink(r)}</td>
    </tr>`;
  };
  const empty = '<tr><td colspan="10" class="text-center text-muted py-3">No stock movements</td></tr>';
  const html = rows.map(makeRow).join('') || empty;
  if (compactBody) compactBody.innerHTML = html;
  if (modalBody) modalBody.innerHTML = html;
}
window.renderStockMovementRows = renderStockMovementRows;

let inventoryReportMode = 'weekly';

function reportPeriodDays() {
  const { sd, ed } = inventoryDateRange();
  if (sd && ed) return Math.max(1, Math.ceil((new Date(ed) - new Date(sd)) / 86400000) + 1);
  if (inventoryReportMode === 'monthly') return 30;
  return 7;
}

function groupedInventoryLots() {
  const map = new Map();
  cache.inventory.forEach(lot => {
    const key = groupKey(lot);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(lot);
  });
  return [...map.values()]
    .map(group => group.slice().sort(inventoryExcelComparator))
    .sort((a, b) => inventoryExcelComparator(a[0] || {}, b[0] || {}));
}

function orderedCategoryBlocks(rows) {
  return rows.slice().sort(inventoryExcelComparator).reduce((blocks, row) => {
    const category = normalizeCategory(row.category || itemCategory(row));
    const last = blocks[blocks.length - 1];
    if (!last || last.category !== category) blocks.push({ category, rows: [] });
    blocks[blocks.length - 1].rows.push(row);
    return blocks;
  }, []);
}

function txQty(tx) {
  return Math.abs(Number(tx.qty_tests ?? tx.qty ?? 0)) || 0;
}

function reportRows() {
  const txRows = filteredTransactions();
  const days = reportPeriodDays();
  const categoryFilter = $('inventoryCategoryFilter')?.value || '';
  return groupedInventoryLots().map(group => {
    const first = group[0] || {};
    const category = normalizeCategory(itemCategory(first));
    if (categoryFilter && category !== categoryFilter) return null;
    const reagentId = first.reagent_id;
    const lotNo = first.lot_no || '';
    const relatedTx = txRows.filter(tx =>
      (Number(tx.reagent_id) === Number(reagentId) || String(tx.reagent_name || '') === String(first.reagent_name || '')) &&
      (!tx.lot_no || !lotNo || String(tx.lot_no) === String(lotNo))
    );
    const received = relatedTx.filter(t => String(t.type || t.transaction_type).toUpperCase() === 'IN').reduce((s, t) => s + txQty(t), 0);
    const used = relatedTx.filter(t => String(t.type || t.transaction_type).toUpperCase() === 'OUT').reduce((s, t) => s + txQty(t), 0);
    const ending = group.reduce((s, l) => s + lotQty(l), 0);
    const opening = ending - received + used;
    const r1 = group.filter(l => String(componentType(l)).toUpperCase() === 'R1').reduce((s, l) => s + lotQty(l), 0);
    const r2 = group.filter(l => String(componentType(l)).toUpperCase() === 'R2').reduce((s, l) => s + lotQty(l), 0);
    const r3 = group.filter(l => String(componentType(l)).toUpperCase() === 'R3').reduce((s, l) => s + lotQty(l), 0);
    const usable = usableTests(first);
    const avgWeek = used ? (used / days) * 7 : 0;
    const weeksLeft = avgWeek ? usable / avgWeek : null;
    const statusCode = lotStatusCode(first);
    const status = weeksLeft !== null && weeksLeft <= 2
      ? 'Stockout Soon'
      : statusCode === 'low'
        ? 'Low Stock'
        : statusCode === 'expiring'
          ? 'Expiring Soon'
          : statusCode === 'expired'
            ? 'Expired'
            : statusCode === 'empty'
              ? 'Empty'
              : 'Normal';
    return {
      category,
      item_code: itemCode(first),
      sort_order: inventoryOrderValue(first),
      reagent_name: first.reagent_name || '-',
      lot_no: lotNo || '-',
      component_summary: `R1: ${r1 || '-'} | R2: ${r2 || '-'}${r3 ? ` | R3: ${r3}` : ''}`,
      opening_balance_tests: opening,
      received_tests: received,
      used_tests: used,
      ending_balance_tests: ending,
      usable_tests: usable,
      average_usage_per_week: avgWeek,
      estimated_weeks_left: weeksLeft,
      exp_date: first.exp_date || '',
      days_to_expire: lotDaysLeft(first),
      status
    };
  }).filter(Boolean).sort(inventoryExcelComparator);
}

function renderInventoryUsageInsights(rows) {
  const insights = $('inventoryUsageInsights');
  const charts = $('inventoryUsageCharts');
  const banner = $('inventoryUsageSummaryBanner');
  if (!insights && !charts && !banner) return;
  const sortedUsed = rows.slice().sort((a, b) => b.used_tests - a.used_tests);
  const sortedFast = rows.slice().sort((a, b) => b.average_usage_per_week - a.average_usage_per_week);
  const nearStockout = rows
    .filter(r => r.estimated_weeks_left !== null)
    .sort((a, b) => a.estimated_weeks_left - b.estimated_weeks_left)[0];
  const expThisMonth = rows.filter(r => Number(r.days_to_expire) >= 0 && Number(r.days_to_expire) <= 30).length;
  const minWeeks = nearStockout ? nearStockout.estimated_weeks_left : null;
  const lowCount = rows.filter(r => r.status === 'Low Stock').length;
  const periodLabel = inventoryReportMode === 'monthly' ? 'ເດືອນນີ້' : (inventoryReportMode === 'custom' ? 'ໃນຊ່ວງທີ່ເລືອກ' : 'ອາທິດນີ້');

  if (banner) {
    const lines = [];
    if (sortedUsed[0] && sortedUsed[0].used_tests > 0) {
      lines.push(`<div class="isb-line">${periodLabel} <b>${esc(sortedUsed[0].reagent_name)}</b> ຖືກໃຊ້ຫຼາຍທີ່ສຸດ (${Math.round(sortedUsed[0].used_tests).toLocaleString()} tests)</div>`);
    }
    if (expThisMonth > 0) {
      lines.push(`<div class="isb-line">ມີ <b>${expThisMonth}</b> ລາຍການໃກ້ໝົດອາຍຸພາຍໃນ 30 ມື້</div>`);
    }
    if (lowCount > 0) {
      lines.push(`<div class="isb-line">ມີ <b>${lowCount}</b> ລາຍການ stock ຕ່ຳ — ຄວນກຽມສັ່ງຊື້</div>`);
    }
    if (nearStockout && minWeeks !== null && minWeeks <= 4) {
      lines.push(`<div class="isb-line"><b>${esc(nearStockout.reagent_name)}</b> ຈະໝົດ stock ໃນ ${minWeeks.toLocaleString(undefined, { maximumFractionDigits: 1 })} ອາທິດ</div>`);
    }
    banner.innerHTML = lines.length
      ? `<div class="isb-title"><i class="bi bi-megaphone-fill"></i> ສະຫຼຸບສຳລັບຜູ້ບໍລິຫານ <span class="text-muted small fw-normal">Manager summary</span></div>${lines.join('')}`
      : '';
  }

  if (insights) {
    const cards = [
      ['ໃຊ້ຫຼາຍສຸດ', 'Most used', sortedUsed[0]?.reagent_name || '-', sortedUsed[0] ? `${Math.round(sortedUsed[0].used_tests).toLocaleString()} tests` : '-', 'bi-fire', 'danger'],
      ['ໄຫຼໄວສຸດ', 'Fastest moving', sortedFast[0]?.reagent_name || '-', sortedFast[0] ? `${sortedFast[0].average_usage_per_week.toLocaleString(undefined, { maximumFractionDigits: 1 })}/week` : '-', 'bi-lightning-charge', 'primary'],
      ['ໃກ້ໝົດ stock', 'Near stockout', nearStockout?.reagent_name || '-', nearStockout ? `${nearStockout.estimated_weeks_left.toLocaleString(undefined, { maximumFractionDigits: 1 })} ອາທິດ` : '-', 'bi-hourglass-split', 'warning'],
      ['ໃກ້ໝົດອາຍຸເດືອນນີ້', 'Expiring this month', expThisMonth, 'lots', 'bi-calendar-x', 'danger'],
      ['ອາທິດເຫຼືອຕ່ຳສຸດ', 'Min weeks remaining', minWeeks === null ? '-' : minWeeks.toLocaleString(undefined, { maximumFractionDigits: 1 }), 'minimum', 'bi-graph-down-arrow', 'info'],
    ];
    insights.innerHTML = cards.map(([lao, en, value, meta, icon, color]) => `
      <div class="col-6 col-xl">
        <div class="inventory-executive-card">
          <i class="bi ${icon} text-${color}"></i>
          <div class="ovc-lao">${lao}</div>
          <div class="ovc-en">${en}</div>
          <div class="fw-bold">${esc(value)}</div>
          <div class="small text-muted">${esc(meta)}</div>
        </div>
      </div>`).join('');
  }
  if (charts) {
    const byCategory = new Map();
    rows.forEach(r => byCategory.set(r.category, (byCategory.get(r.category) || 0) + r.used_tests));
    const maxCategory = Math.max(...byCategory.values(), 1);
    const used = rows.reduce((s, r) => s + r.used_tests, 0);
    const received = rows.reduce((s, r) => s + r.received_tests, 0);
    const maxTrend = Math.max(used, received, 1);
    charts.innerHTML = `
      <div class="col-lg-5">
        <div class="inventory-section-card h-100">
          <div class="inventory-section-title"><i class="bi bi-activity"></i> ແນວໂນ້ມການໃຊ້ <span class="ist-en">Weekly / Monthly Trend</span></div>
          ${[
            ['ໃຊ້ໄປ (Used)', used, 'bg-danger'],
            ['ຮັບເຂົ້າ (Received)', received, 'bg-success'],
            ['Usable ປັດຈຸບັນ', rows.reduce((s, r) => s + r.usable_tests, 0), 'bg-primary']
          ].map(([label, value, color]) => `
            <div class="inventory-chart-row">
              <div class="d-flex justify-content-between small mb-1"><span>${label}</span><b>${Math.round(value).toLocaleString()}</b></div>
              <div class="inventory-chart-track"><span class="${color}" style="width:${Math.max(4, Math.min(100, (Number(value) / maxTrend) * 100))}%"></span></div>
            </div>`).join('')}
        </div>
      </div>
      <div class="col-lg-7">
        <div class="inventory-section-card h-100">
          <div class="inventory-section-title"><i class="bi bi-pie-chart"></i> ການໃຊ້ຕາມໝວດ <span class="ist-en">Category Usage Distribution</span></div>
          ${[...byCategory.entries()].slice(0, 8).map(([category, value]) => `
            <div class="inventory-chart-row">
              <div class="d-flex justify-content-between small mb-1"><span>${categoryBadge(category)}</span><b>${Math.round(value).toLocaleString()}</b></div>
              <div class="inventory-chart-track"><span class="bg-info" style="width:${Math.max(4, Math.min(100, (Number(value) / maxCategory) * 100))}%"></span></div>
            </div>`).join('') || '<div class="text-muted small">No usage yet.</div>'}
        </div>
      </div>`;
  }
}

// New: Report tab — simplified per-reagent movement table.
// Keeps reportRows()/exports unchanged. Adds search filter + condensed columns.
window.renderInventoryReport = function renderInventoryReport() {
  const body = document.getElementById('reportMainTableBody');
  if (!body) return;
  populateInventoryCategoryFilter();
  let rows = reportRows();
  const q = ($('reportSearch')?.value || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(r =>
      String(r.reagent_name || '').toLowerCase().includes(q) ||
      String(r.lot_no || '').toLowerCase().includes(q)
    );
  }
  // Update summary banner using existing insights pipeline
  renderInventoryUsageInsights(rows);
  // Reflect active period button
  const periodBtn = inventoryReportMode === 'monthly' ? 'month' : (inventoryReportMode === 'custom' ? null : 'week');
  document.querySelectorAll('.rdb-btn[data-period]').forEach(b => {
    b.classList.toggle('active', b.dataset.period === periodBtn);
  });
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">ບໍ່ມີຂໍ້ມູນໃນຊ່ວງເວລານີ້ <small class="d-block">No data in this period</small></td></tr>';
    renderStockMovementRows();
    return;
  }
  // Group by category for readability (subtotal row per category)
  body.innerHTML = orderedCategoryBlocks(rows).map(({ category, rows: group }) => {
    const subUsed = group.reduce((s, r) => s + r.used_tests, 0);
    const subRecv = group.reduce((s, r) => s + r.received_tests, 0);
    const subEnd = group.reduce((s, r) => s + r.ending_balance_tests, 0);
    const header = `<tr class="lab-group-row"><td colspan="8" class="py-2">
      <div class="cat-header-wrap">
        ${categoryBadge(category)}
        <span class="cat-header-name">${esc(category)}</span>
        <span class="cat-header-count">${group.length} ລາຍການ</span>
        <span class="ms-auto small text-success"><i class="bi bi-arrow-down-circle"></i> ຮັບ ${Math.round(subRecv).toLocaleString()}</span>
        <span class="small text-danger"><i class="bi bi-arrow-up-circle"></i> ໃຊ້ ${Math.round(subUsed).toLocaleString()}</span>
        <span class="small text-primary fw-bold">ເຫຼືອ ${Math.round(subEnd).toLocaleString()}</span>
      </div>
    </td></tr>`;
    return header + group.map(r => `
      <tr class="inventory-lab-row">
        <td class="ps-3 fw-semibold"><div class="reagent-primary">${esc(r.reagent_name)}</div></td>
        <td><span class="small">${esc(r.lot_no || '-')}</span></td>
        <td class="text-end">${Math.round(r.opening_balance_tests).toLocaleString()}</td>
        <td class="text-end col-received">${Math.round(r.received_tests).toLocaleString()}</td>
        <td class="text-end col-used">${Math.round(r.used_tests).toLocaleString()}</td>
        <td class="text-end fw-bold">${Math.round(r.ending_balance_tests).toLocaleString()}</td>
        <td class="text-end fw-bold text-primary">${Math.round(r.usable_tests).toLocaleString()}</td>
        <td class="text-center"><span class="badge rounded-pill ${statusBadgeClass(r.status)}">${esc(r.status)}</span></td>
      </tr>`).join('');
  }).join('');
  renderStockMovementRows();
};

function renderInventoryUsageReport() {
  // Legacy renderer kept so exports & other callers don't break.
  if (typeof renderInventoryReport === 'function') renderInventoryReport();
  const body = $('inventoryUsageReportBody');
  if (!body) return;
  const rows = reportRows();
  renderInventoryUsageInsights(rows);
  const low = rows.filter(r => r.status === 'Low Stock').length;
  const expiring = rows.filter(r => ['Expiring Soon', 'Expired'].includes(r.status)).length;
  const stockoutSoon = rows.filter(r => r.estimated_weeks_left !== null && r.estimated_weeks_left <= 2).length;
  if ($('invReportTotalReagents')) $('invReportTotalReagents').textContent = new Set(rows.map(r => r.reagent_name)).size;
  if ($('invReportLowStock')) $('invReportLowStock').textContent = low;
  if ($('invReportExpiring')) $('invReportExpiring').textContent = expiring;
  if ($('invReportStockout2Weeks')) $('invReportStockout2Weeks').textContent = stockoutSoon;
  body.innerHTML = rows.length ? orderedCategoryBlocks(rows).map(({ category, rows: group }) => {
    const subtotalUsed = group.reduce((s, r) => s + r.used_tests, 0);
    const subtotalUsable = group.reduce((s, r) => s + r.usable_tests, 0);
    const subtotalEnding = group.reduce((s, r) => s + r.ending_balance_tests, 0);
    return `<tr class="table-light">
      <td colspan="13" class="fw-bold">${categoryBadge(category)} <span class="ms-2 text-muted small">SUBTOTAL · Used: ${Math.round(subtotalUsed).toLocaleString()} · Usable: ${Math.round(subtotalUsable).toLocaleString()} · Ending: ${Math.round(subtotalEnding).toLocaleString()}</span></td>
    </tr>` + group.map(r => `
    <tr>
      <td class="fw-semibold">${esc(r.reagent_name)}</td>
      <td>${esc(r.lot_no)}</td>
      <td>${esc(r.component_summary)}</td>
      <td class="text-end">${Math.round(r.opening_balance_tests).toLocaleString()}</td>
      <td class="text-end text-success fw-semibold">${Math.round(r.received_tests).toLocaleString()}</td>
      <td class="text-end text-danger fw-semibold">${Math.round(r.used_tests).toLocaleString()}</td>
      <td class="text-end fw-bold">${Math.round(r.ending_balance_tests).toLocaleString()}</td>
      <td class="text-end fw-bold text-primary">${Math.round(r.usable_tests).toLocaleString()}</td>
      <td class="text-end">${r.average_usage_per_week.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
      <td class="text-end">${r.estimated_weeks_left === null ? '-' : r.estimated_weeks_left.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
      <td>${fmtDate(r.exp_date) || '-'}</td>
      <td class="text-end">${r.days_to_expire ?? '-'}</td>
      <td><span class="badge rounded-pill ${statusBadgeClass(r.status)}">${esc(r.status)}</span></td>
    </tr>`).join('');
  }).join('') : '<tr><td colspan="13" class="text-center text-muted py-3">ບໍ່ມີລາຍງານ</td></tr>';
}

function renderInventorySettingsPanel() {
  const catBody = $('inventoryCategorySettingsBody');
  if (catBody) {
    const stats = categoryStats(cache.inventory);
    catBody.innerHTML = LAB_CATEGORIES.map(category => {
      const s = stats.find(x => x.category === category) || { total: 0, low: 0, expiring: 0, usable: 0 };
      return `<tr>
        <td>${categoryBadge(category)}</td>
        <td class="text-end">${s.total}</td>
        <td class="text-end text-warning fw-semibold">${s.low}</td>
        <td class="text-end text-danger fw-semibold">${s.expiring}</td>
        <td class="text-end fw-bold text-success">${Math.round(s.usable).toLocaleString()}</td>
      </tr>`;
    }).join('');
  }
  const mapBody = $('inventoryMappingSettingsBody');
  if (mapBody) {
    mapBody.innerHTML = (cache.reagents || []).slice().sort(inventoryExcelComparator).slice(0, 8).map(r => `
      <tr>
        <td class="fw-semibold">${esc(r.name || r.reagent_name || '-')}</td>
        <td>${categoryBadge(r.category || 'Other')}</td>
        <td><span class="component-pill component-r1">R1</span><span class="component-pill component-r2">R2</span></td>
        <td class="text-end">${Number(r.default_low_threshold_tests ?? r.low_threshold ?? 10).toLocaleString()}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">No mapping data yet.</td></tr>';
  }
}

window.setInventoryReportMode = function(mode) {
  inventoryReportMode = mode;
  ['weekly', 'monthly', 'custom'].forEach(m => {
    $(`invReport${m[0].toUpperCase()}${m.slice(1)}Btn`)?.classList.toggle('active', m === mode);
  });
  if (mode === 'weekly' || mode === 'monthly') window.setInventoryPeriod(mode === 'weekly' ? 'week' : 'month');
  else renderInventoryUsageReport();
};

window.loadInventoryTable = async function() {
  const [lots, tx, reagents] = await Promise.all([
    api.getInventoryLots(),
    api.getStockTransactions(),
    api.getStockMaster()
  ]);
  rememberTableColumns('lis_one_inventory_lots', lots);
  rememberTableColumns('lis_one_stock_transactions', tx);
  rememberTableColumns('lis_one_stock_master', reagents);
  cache.reagents = await applyStoredReagentCategories(reagents || []);
  const byId = new Map(cache.reagents.map(r => [Number(r.id), r]));
  const byName = new Map(cache.reagents.map(r => [String(r.name || '').trim().toLowerCase(), r]));
  cache.inventory = (lots || []).map(l => {
    const master = byId.get(Number(l.reagent_id)) || byName.get(String(l.reagent_name || '').trim().toLowerCase()) || {};
    return { ...master, ...l };
  });
  cache.stockTransactions = tx || [];
  applyInventoryFilters();
  renderStockMovementRows();
};
window.loadInventoryDataWithDate = applyInventoryFilters;
window.loadAllInventoryData = async function() {
  if ($('invStartDate')) $('invStartDate').value = '';
  if ($('invEndDate'))   $('invEndDate').value   = '';
  if ($('inventorySearch')) $('inventorySearch').value = '';
  if ($('inventoryStatusFilter')) $('inventoryStatusFilter').value = '';
  if ($('inventoryCategoryFilter')) $('inventoryCategoryFilter').value = '';
  await window.loadInventoryTable();
};
window.resetInventoryDateFilter = () => {
  if ($('invStartDate')) $('invStartDate').value = '';
  if ($('invEndDate'))   $('invEndDate').value   = '';
  if ($('inventorySearch')) $('inventorySearch').value = '';
  if ($('inventoryStatusFilter')) $('inventoryStatusFilter').value = '';
  if ($('inventoryCategoryFilter')) $('inventoryCategoryFilter').value = '';
  applyInventoryFilters();
};

window.setInventoryPeriod = function(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === 'week') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  } else if (period === 'month') {
    start.setDate(1);
  }
  const iso = d => d.toISOString().slice(0, 10);
  if ($('invStartDate')) $('invStartDate').value = iso(period === 'today' ? now : start);
  if ($('invEndDate')) $('invEndDate').value = iso(now);
  applyInventoryFilters();
};

window.sortInventoryData = () => {
  const mode = $('inventorySortOrder')?.value || 'custom';
  const rows = cache.inventory.slice();
  const sorters = {
    'name':       (a,b) => (a.reagent_name||'').localeCompare(b.reagent_name||''),
    'name-desc':  (a,b) => (b.reagent_name||'').localeCompare(a.reagent_name||''),
    'exp':        (a,b) => (a.exp_date||'').localeCompare(b.exp_date||''),
    'exp-new':    (a,b) => (b.exp_date||'').localeCompare(a.exp_date||''),
    'qty':        (a,b) => Number(b.qty_remaining||0) - Number(a.qty_remaining||0),
    'qty-asc':    (a,b) => Number(a.qty_remaining||0) - Number(b.qty_remaining||0),
    'custom':     inventoryExcelComparator,
  };
  if (sorters[mode]) rows.sort(sorters[mode]);
  cache.inventory = rows;
  applyInventoryFilters();
};

function activeLotsForSelect() {
  return cache.inventory
    .filter(l => lotQty(l) > 0 && lotStatusCode(l) !== 'expired')
    .sort((a, b) => {
      const orderDiff = inventoryExcelComparator(a, b);
      if (orderDiff) return orderDiff;
      const da = lotDaysLeft(a);
      const db = lotDaysLeft(b);
      return (da ?? 99999) - (db ?? 99999);
    });
}

window.openStockOutModal = async function(lotId = null) {
  if (!cache.inventory.length) cache.inventory = await api.getInventoryLots();
  const sel = $('stockOutLotSelect');
  if (sel) {
    const rows = activeLotsForSelect();
    sel.innerHTML = rows.map(l => `
      <option value="${l.id}" ${Number(l.id) === Number(lotId) ? 'selected' : ''}>
        ${esc(itemCode(l) || '')} ${esc(l.reagent_name || '-')} (${esc(componentType(l))}) | Lot: ${esc(l.lot_no || '-')} | ຍອດ: ${lotQty(l).toLocaleString()} | Exp: ${fmtDate(l.exp_date)}
      </option>`).join('');
  }
  if ($('stockOutQty')) $('stockOutQty').value = '';
  if ($('stockOutNote')) $('stockOutNote').value = '';
  window.updateStockOutHint();
  showModal('stockOutModal');
};

window.updateStockOutHint = function() {
  const id = Number($('stockOutLotSelect')?.value);
  const lot = cache.inventory.find(l => Number(l.id) === id);
  const hint = $('stockOutHint');
  if (!hint) return;
  if (!lot) {
    hint.textContent = 'ບໍ່ພົບ Lot ທີ່ພ້ອມໃຊ້';
    return;
  }
  hint.textContent = `${itemCode(lot) || '-'} | ${componentType(lot)} | ຄົງເຫຼືອ ${lotQty(lot).toLocaleString()} | ${inventoryStatus(lot).replace(/<[^>]+>/g, '')}`;
};

window.submitStockOut = async function() {
  const id = Number($('stockOutLotSelect')?.value);
  const lot = cache.inventory.find(l => Number(l.id) === id);
  if (!lot) return toast('warning', 'ກະລຸນາເລືອກ Lot');
  const qty = Number($('stockOutQty')?.value || 0);
  if (!qty || qty <= 0) return toast('warning', 'ກະລຸນາໃສ່ຈຳນວນໃຫ້ຖືກຕ້ອງ');
  if (qty > lotQty(lot)) return toast('warning', `ຍອດຄົງເຫຼືອມີ ${lotQty(lot).toLocaleString()} ເທົ່ານັ້ນ`);
  const btn = $('btnSubmitStockOut'); if (btn) btn.disabled = true;
  const nextQty = lotQty(lot) - qty;
  const note = ($('stockOutNote')?.value || '').trim();
  const res = await updateWithSchemaFallback('lis_one_inventory_lots', id, {
    qty_remaining: nextQty,
    remaining_tests: nextQty,
    used_tests: lotQtyIn(lot) - nextQty,
    status: nextQty <= 0 ? 'Empty' : (nextQty <= lowThresholdTests(lot) ? 'Low Stock' : 'Normal')
  }, { qty_remaining: nextQty });
  if (res.success) {
    const txPayload = {
      reagent_id: lot.reagent_id,
      reagent_name: lot.reagent_name,
      type: 'OUT',
      transaction_type: 'OUT',
      component_type: componentType(lot),
      lot_no: lot.lot_no || null,
      qty,
      qty_tests: qty,
      qty_unit: null,
      reference_type: 'manual',
      created_by: currentUser(),
      movement_date: new Date().toISOString().slice(0, 10),
      note: `${componentType(lot)} | Lot ${lot.lot_no || '-'}${note ? ' - ' + note : ''}`,
      user_name: currentUser()
    };
    await insertWithSchemaFallback('lis_one_stock_transactions', txPayload, {
      reagent_id: lot.reagent_id,
      reagent_name: lot.reagent_name,
      type: 'OUT',
      qty,
      note: txPayload.note,
      user_name: currentUser()
    });
    api.writeAudit(currentUser(), 'Stock OUT', 'lis_one_inventory_lots', { lot_id: id, qty, nextQty });
    hideModal('stockOutModal');
    toast('success', 'ເບີກອອກສຳເລັດ');
    await window.loadInventoryTable();
    window.refreshInventoryAlertBadge?.();
  } else {
    toast('error', 'ເບີກອອກບໍ່ສຳເລັດ');
  }
  if (btn) btn.disabled = false;
};

window.openStockAdjustModal = function(lotId) {
  const lot = cache.inventory.find(l => Number(l.id) === Number(lotId));
  if (!lot) return toast('warning', 'ບໍ່ພົບ Lot');
  $('adjustLotId').value = lot.id;
  $('adjustCurrentQty').value = lotQty(lot);
  $('adjustNewQty').value = lotQty(lot);
  $('adjustNote').value = '';
  $('adjustLotLabel').textContent = `${itemCode(lot) || '-'} ${lot.reagent_name || '-'} | ${componentType(lot)} | Lot ${lot.lot_no || '-'} | Exp ${fmtDate(lot.exp_date) || '-'}`;
  showModal('stockAdjustModal');
};

window.submitStockAdjust = async function() {
  const id = Number($('adjustLotId')?.value);
  const lot = cache.inventory.find(l => Number(l.id) === id);
  if (!lot) return toast('warning', 'ບໍ່ພົບ Lot');
  const oldQty = lotQty(lot);
  const newQty = Number($('adjustNewQty')?.value || 0);
  if (newQty < 0) return toast('warning', 'ຍອດໃໝ່ຕ້ອງບໍ່ຕິດລົບ');
  const diff = newQty - oldQty;
  const note = ($('adjustNote')?.value || '').trim();
  const btn = $('btnSubmitStockAdjust'); if (btn) btn.disabled = true;
  const res = await updateWithSchemaFallback('lis_one_inventory_lots', id, {
    qty_remaining: newQty,
    remaining_tests: newQty,
    used_tests: Math.max(0, lotQtyIn(lot) - newQty),
    status: newQty <= 0 ? 'Empty' : (newQty <= lowThresholdTests(lot) ? 'Low Stock' : 'Normal')
  }, { qty_remaining: newQty });
  if (res.success) {
    const txPayload = {
      reagent_id: lot.reagent_id,
      reagent_name: lot.reagent_name,
      type: diff >= 0 ? 'IN' : 'OUT',
      transaction_type: 'ADJUST',
      component_type: componentType(lot),
      lot_no: lot.lot_no || null,
      qty: Math.abs(diff),
      qty_tests: Math.abs(diff),
      qty_unit: null,
      reference_type: 'adjustment',
      created_by: currentUser(),
      movement_date: new Date().toISOString().slice(0, 10),
      note: `ADJUST ${componentType(lot)} | Lot ${lot.lot_no || '-'}: ${oldQty} -> ${newQty}${note ? ' - ' + note : ''}`,
      user_name: currentUser()
    };
    await insertWithSchemaFallback('lis_one_stock_transactions', txPayload, {
      reagent_id: lot.reagent_id,
      reagent_name: lot.reagent_name,
      type: diff >= 0 ? 'IN' : 'OUT',
      qty: Math.abs(diff),
      note: txPayload.note,
      user_name: currentUser()
    });
    api.writeAudit(currentUser(), 'Stock ADJUST', 'lis_one_inventory_lots', { lot_id: id, oldQty, newQty });
    hideModal('stockAdjustModal');
    toast('success', 'ປັບຍອດສຳເລັດ');
    await window.loadInventoryTable();
    window.refreshInventoryAlertBadge?.();
  } else {
    toast('error', 'ປັບຍອດບໍ່ສຳເລັດ');
  }
  if (btn) btn.disabled = false;
};

window.openStockHistoryModal = async function() {
  cache.stockTransactions = await api.getStockTransactions();
  renderStockMovementRows();
  showModal('stockHistoryModal');
};

/* ----- Add lot modal ----- */
window.openAddLotModal = async function() {
  await refreshReagentCache();
  const sel = $('invSelectReagent');
  if (sel) {
    sel.innerHTML = '<option value="" disabled selected>-- ເລືອກນ້ຳຢາ --</option>' +
      cache.reagents.slice().sort(inventoryExcelComparator).map(r => `<option value="${r.id}" data-name="${esc(r.name)}" data-details="${esc(r.details || '')}" data-code="${esc(r.item_code || '')}">${esc(r.item_code ? r.item_code + ' - ' : '')}${esc(r.name)}${r.unit?` (${esc(r.unit)})`:''}</option>`).join('');
  }
  ['invLotNo','invExpDate','invReceiveDate','invLocation','invSupplier','invQty','invDetails','invUnitQty'].forEach(id => { if ($(id)) $(id).value = ''; });
  if ($('invComponentType')) $('invComponentType').value = 'Single';
  if ($('invUnitType')) $('invUnitType').value = 'box';
  if ($('invTestsPerUnit')) $('invTestsPerUnit').value = '1';
  if ($('invLowThreshold')) $('invLowThreshold').value = '10';
  if ($('invReceiveDate')) $('invReceiveDate').value = new Date().toISOString().slice(0,10);
  showModal('addLotModal');
};

window.submitInventoryLot = async function() {
  const reagent_id = $('invSelectReagent')?.value;
  if (!reagent_id) return toast('warning', 'ກະລຸນາເລືອກນ້ຳຢາ');
  const opt = $('invSelectReagent').selectedOptions[0];
  const master = cache.reagents.find(r => Number(r.id) === Number(reagent_id)) || {};
  const unitQty = Number($('invUnitQty')?.value || 0);
  const testsPer = Number($('invTestsPerUnit')?.value || 1) || 1;
  const totalTests = Number($('invQty')?.value || 0) || (unitQty * testsPer);
  const fullPayload = {
    lot_id: `LOT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reagent_id: Number(reagent_id),
    reagent_name: opt?.dataset.name || opt?.text || '',
    item_code: opt?.dataset.code || master.item_code || '',
    details: $('invDetails')?.value.trim() || opt?.dataset.details || master.details || '',
    component_type: $('invComponentType')?.value || 'Single',
    unit_type: $('invUnitType')?.value || master.default_unit_type || master.unit || 'test',
    unit_qty: unitQty || null,
    tests_per_unit: testsPer,
    total_tests: totalTests,
    used_tests: 0,
    remaining_tests: totalTests,
    low_threshold_tests: Number($('invLowThreshold')?.value || master.default_low_threshold_tests || master.low_threshold || 10) || 10,
    status: 'Normal',
    category: normalizeCategory(master.category || 'Other'),
    manufacturer: master.manufacturer || '',
    storage_temp: master.storage_temp || '',
    lot_no: $('invLotNo').value.trim(),
    exp_date: $('invExpDate').value || null,
    receive_date: $('invReceiveDate').value || new Date().toISOString().slice(0,10),
    location: $('invLocation').value.trim(),
    supplier: $('invSupplier').value.trim(),
    qty: totalTests,
    qty_remaining: totalTests,
  };
  const payload = {
    lot_id: fullPayload.lot_id,
    reagent_id: fullPayload.reagent_id,
    reagent_name: fullPayload.reagent_name,
    lot_no: fullPayload.component_type && fullPayload.component_type !== 'Single' ? `${fullPayload.lot_no || '-'} ${fullPayload.component_type}` : fullPayload.lot_no,
    exp_date: fullPayload.exp_date,
    receive_date: fullPayload.receive_date,
    location: fullPayload.location,
    supplier: fullPayload.supplier,
    qty: fullPayload.qty,
    qty_remaining: fullPayload.qty_remaining,
  };
  if (!payload.qty) return toast('warning', 'ກະລຸນາໃສ່ຈຳນວນ tests ຫຼື unit qty/tests per unit');
  const btn = $('btnSubmitInv'); if (btn) btn.disabled = true;
  const res = await insertWithSchemaFallback('lis_one_inventory_lots', fullPayload, payload);
  if (btn) btn.disabled = false;
  if (res.success) {
    await insertWithSchemaFallback('lis_one_stock_transactions', {
      reagent_id: payload.reagent_id, reagent_name: payload.reagent_name,
      type: 'IN',
      transaction_type: 'IN',
      component_type: fullPayload.component_type,
      lot_no: fullPayload.lot_no,
      qty: payload.qty,
      qty_tests: payload.qty,
      qty_unit: unitQty || null,
      reference_type: 'manual',
      created_by: currentUser(),
      movement_date: fullPayload.receive_date,
      note: `${fullPayload.component_type} | Lot ${fullPayload.lot_no || '-'}`,
      user_name: currentUser()
    }, {
      reagent_id: payload.reagent_id,
      reagent_name: payload.reagent_name,
      type: 'IN',
      qty: payload.qty,
      note: `${fullPayload.component_type} | Lot ${fullPayload.lot_no || '-'}`,
      user_name: currentUser()
    });
    hideModal('addLotModal');
    toast('success', 'ບັນທຶກສຳເລັດ');
    window.loadInventoryTable();
    window.refreshInventoryAlertBadge?.();
  } else toast('error', 'ບັນທຶກລົ້ມເຫຼວ');
};

window.editInvLot = function(id) {
  const lot = cache.inventory.find(l => l.id === id);
  if (!lot) return;
  $('editInvLotId').value = lot.id;
  $('editInvLotNo').value = lot.lot_no || '';
  if ($('editInvComponentType')) $('editInvComponentType').value = componentType(lot);
  if ($('editInvUnitType')) $('editInvUnitType').value = unitType(lot);
  $('editInvExpDate').value = lot.exp_date ? lot.exp_date.slice(0,10) : '';
  $('editInvLocation').value = lot.location || '';
  $('editInvSupplier').value = lot.supplier || '';
  if ($('editInvDetails')) $('editInvDetails').value = itemDetails(lot) || '';
  $('editInvQty').value = lot.qty_remaining ?? lot.qty ?? 0;
  if ($('editInvLowThreshold')) $('editInvLowThreshold').value = lowThresholdTests(lot);
  showModal('inventoryEditModal');
};

window.saveInvLotEdit = async function() {
  const id = Number($('editInvLotId').value);
  if (!id) return;
  const fullPayload = {
    lot_no: $('editInvLotNo').value.trim(),
    component_type: $('editInvComponentType')?.value || 'Single',
    unit_type: $('editInvUnitType')?.value || 'test',
    details: $('editInvDetails')?.value.trim() || null,
    exp_date: $('editInvExpDate').value || null,
    location: $('editInvLocation').value.trim(),
    supplier: $('editInvSupplier').value.trim(),
    qty_remaining: Number($('editInvQty').value) || 0,
    remaining_tests: Number($('editInvQty').value) || 0,
    low_threshold_tests: Number($('editInvLowThreshold')?.value || 10) || 10,
  };
  const payload = {
    lot_no: fullPayload.component_type && fullPayload.component_type !== 'Single' ? `${fullPayload.lot_no || '-'} ${fullPayload.component_type}` : fullPayload.lot_no,
    exp_date: fullPayload.exp_date,
    location: fullPayload.location,
    supplier: fullPayload.supplier,
    qty_remaining: fullPayload.qty_remaining,
  };
  const res = await updateWithSchemaFallback('lis_one_inventory_lots', id, fullPayload, payload);
  if (res.success) { hideModal('inventoryEditModal'); toast('success','ອັບເດດສຳເລັດ'); window.loadInventoryTable(); }
  else toast('error', 'ອັບເດດລົ້ມເຫຼວ');
};

window.deleteInvLot = async function(id) {
  if (!await confirmDelete()) return;
  const res = await api.genericDelete('lis_one_inventory_lots', id);
  if (res.success) { toast('success', 'ລຶບສຳເລັດ'); window.loadInventoryTable(); }
  else toast('error', 'ລຶບລົ້ມເຫຼວ');
};

window.exportInventoryData = function(type) {
  const rows = cache.inventory.slice().sort(inventoryExcelComparator);
  if (!rows.length) return toast('info', 'ບໍ່ມີຂໍ້ມູນ');
  const headers = ['Item ID','Category','Reagent','Component','Details','Lot No','Unit Type','Unit Qty','Tests Per Unit','Total Tests','Used Tests','Remaining Tests','Usable Tests','R1 Remaining','R2 Remaining','R3 Remaining','Exp Date','Days Left','Location','Supplier','Status'];
  const data = rows.map(r => [
    inventoryDisplayCode(r),
    normalizeCategory(itemCategory(r)),
    r.reagent_name,
    componentType(r),
    itemDetails(r),
    r.lot_no,
    unitType(r),
    r.unit_qty ?? '',
    testsPerUnit(r),
    lotQtyIn(r),
    lotQtyOut(r),
    lotQty(r),
    usableTests(r),
    componentRemaining(r, 'R1'),
    componentRemaining(r, 'R2'),
    componentRemaining(r, 'R3'),
    r.exp_date,
    lotDaysLeft(r) ?? '',
    r.location,
    r.supplier,
    lotStatusCode(r)
  ]);
  if (type === 'csv' || type === 'excel') {
    const csv = [headers.join(','), ...data.map(d => d.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: type==='excel'?'application/vnd.ms-excel':'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventory_${new Date().toISOString().slice(0,10)}.${type==='excel'?'xls':'csv'}`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (type === 'pdf') {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<title>Inventory</title><style>body{font-family:sans-serif;padding:16px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f3f4f6}</style>`);
    w.document.write(`<h3>Inventory Report — ${new Date().toLocaleDateString()}</h3>`);
    w.document.write(`<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>`);
    data.forEach(d => w.document.write(`<tr>${d.map(c=>`<td>${c ?? ''}</td>`).join('')}</tr>`));
    w.document.write(`</tbody></table>`);
    w.document.close();
    w.print();
  }
};

window.exportInventoryUsageReport = function(type) {
  const rows = reportRows();
  if (!rows.length) return toast('info', 'ບໍ່ມີລາຍງານ');
  const headers = [
    'category','reagent_name','lot_no','component_summary','opening_balance_tests','received_tests',
    'used_tests','ending_balance_tests','usable_tests','average_usage_per_week',
    'estimated_weeks_left','exp_date','days_to_expire','status'
  ];
  const data = [];
  orderedCategoryBlocks(rows).forEach(({ category, rows: group }) => {
    data.push([`CATEGORY: ${category}`, '', '', '', '', '', '', '', '', '', '', '', '', '']);
    group.forEach(r => data.push(headers.map(h => r[h] ?? '')));
    data.push([
      `SUBTOTAL ${category}`, '', '', '',
      '',
      group.reduce((s, r) => s + r.received_tests, 0),
      group.reduce((s, r) => s + r.used_tests, 0),
      group.reduce((s, r) => s + r.ending_balance_tests, 0),
      group.reduce((s, r) => s + r.usable_tests, 0),
      '', '', '', '', ''
    ]);
  });
  if (type === 'csv' || type === 'excel') {
    const csv = [headers.join(','), ...data.map(d => d.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: type === 'excel' ? 'application/vnd.ms-excel' : 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventory_usage_${inventoryReportMode}_${new Date().toISOString().slice(0,10)}.${type === 'excel' ? 'xls' : 'csv'}`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (type === 'pdf') {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<title>Inventory Usage Report</title><style>body{font-family:"Noto Sans Lao",Arial,sans-serif;padding:16px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ddd;padding:4px;text-align:left}th{background:#f3f4f6}.num{text-align:right}</style>`);
    w.document.write(`<h3>Inventory Usage Report - ${inventoryReportMode}</h3>`);
    w.document.write(`<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`);
    data.forEach(d => w.document.write(`<tr>${d.map((c, i) => `<td class="${i >= 4 && i <= 12 ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`));
    w.document.write(`</tbody></table>`);
    w.document.close();
    w.print();
  }
};

/* ----- Reagent master modal ----- */
window.openReagentModal = async function() {
  await refreshReagentCache();
  renderReagentTable();
  ['newReagentItemCode','newReagentName','newReagentUnit','newReagentCategory','newReagentManufacturer','newReagentDetails','newReagentSupplier','newReagentStorageTemp']
    .forEach(id => { if ($(id)) $(id).value = ''; });
  $('editReagentId').value = '';
  showModal('reagentMasterModal');
};
function renderReagentTable() {
  const body = $('reagentMasterTableBody'); if (!body) return;
  const catOpts = (selected) => LAB_CATEGORIES.map(c =>
    `<option value="${esc(c)}"${normalizeCategory(selected) === c ? ' selected' : ''}>${esc(c)}</option>`).join('');
  body.innerHTML = cache.reagents.slice().sort(inventoryExcelComparator).map(r => `
    <tr data-reagent-row="${r.id}">
      <td class="ps-3 fw-semibold text-primary">${esc(r.item_code || r.id)}</td>
      <td class="fw-semibold">${esc(r.name)}</td>
      <td class="small text-muted">${esc(r.details || '-')}</td>
      <td>${esc(r.unit || '-')}</td>
      <td>
        <select class="form-select form-select-sm reagent-inline-cat" data-reagent-id="${r.id}" onchange="updateReagentCategory(${r.id}, this.value)">
          ${catOpts(r.category)}
        </select>
      </td>
      <td class="text-center">
        <button class="ra-btn ra-icon" onclick="editReagent(${r.id})" title="ແກ້ໄຂລາຍລະອຽດ"><i class="bi bi-pencil"></i></button>
        <button class="ra-btn ra-icon ra-danger" onclick="deleteReagent(${r.id})" title="ລຶບ"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມູນ — ກົດ "ບັນທຶກ" ດ້ານເທິງເພື່ອເພີ່ມໃໝ່</td></tr>';
}

// Quick inline category update (no need to open the full edit form).
window.updateReagentCategory = async function(id, newCategory) {
  const normalized = normalizeCategory(newCategory);
  const res = tableSupportsColumn('lis_one_stock_master', 'category')
    ? await updateWithSchemaFallback('lis_one_stock_master', Number(id), { category: normalized }, {})
    : await saveStoredReagentCategory(id, normalized);
  if (res.success) {
    const r = cache.reagents.find(x => Number(x.id) === Number(id));
    if (r) r.category = normalized;
    toast('success', `ປ່ຽນໝວດເປັນ ${normalized}`);
    api.writeAudit(currentUser(), 'Update Reagent Category', 'lis_one_stock_master', { id, category: normalized });
    // Refresh the inventory list view if open
    if (typeof applyInventoryFilters === 'function') applyInventoryFilters();
  } else {
    if (isMissingColumnError(res.error, 'category')) {
      const r = cache.reagents.find(x => Number(x.id) === Number(id));
      if (r) r.category = normalized;
      renderReagentTable();
      if (typeof applyInventoryFilters === 'function') applyInventoryFilters();
      toast('warning', 'ຖານຂໍ້ມູນຍັງບໍ່ມີ column category — ປ່ຽນສະແດງໃນໜ້າຈໍຊົ່ວຄາວແລ້ວ');
      console.warn('[CRUD] category column missing on lis_one_stock_master. Apply inventory category migration to persist this value.', res.error);
      return;
    }
    toast('error', 'ບັນທຶກໝວດລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
    console.error('[CRUD] updateReagentCategory error:', res.error);
  }
};

window.editReagent = (id) => {
  const r = cache.reagents.find(x => x.id === id); if (!r) return;
  $('editReagentId').value = r.id;
  if ($('newReagentItemCode')) $('newReagentItemCode').value = r.item_code || '';
  $('newReagentName').value = r.name || '';
  $('newReagentUnit').value = r.unit || '';
  // Normalize before setting to avoid silent value=empty when DB has a non-standard label.
  if ($('newReagentCategory')) $('newReagentCategory').value = normalizeCategory(r.category || 'Other');
  if ($('newReagentManufacturer')) $('newReagentManufacturer').value = r.manufacturer || '';
  if ($('newReagentDetails')) $('newReagentDetails').value = r.details || '';
  if ($('newReagentSupplier')) $('newReagentSupplier').value = r.main_supplier || '';
  if ($('newReagentStorageTemp')) $('newReagentStorageTemp').value = r.storage_temp || '';
  $('btnCancelReagent')?.classList.remove('d-none');
  // Show "editing X" banner so user knows the form is now in edit mode.
  const banner = $('reagentEditBanner');
  if (banner) {
    banner.classList.remove('d-none');
    banner.innerHTML = `<i class="bi bi-pencil-square"></i> ກຳລັງແກ້ໄຂ: <b>${esc(r.name)}</b> <span class="text-muted small">(${esc(r.item_code || r.id)})</span>`;
  }
};
window.cancelEditReagent = () => {
  $('editReagentId').value = '';
  ['newReagentItemCode','newReagentName','newReagentUnit','newReagentCategory','newReagentManufacturer','newReagentDetails','newReagentSupplier','newReagentStorageTemp']
    .forEach(id => { if ($(id)) $(id).value = ''; });
  $('btnCancelReagent')?.classList.add('d-none');
  $('reagentEditBanner')?.classList.add('d-none');
};
window.saveReagentMaster = async function() {
  const name = $('newReagentName').value.trim();
  const unit = $('newReagentUnit').value.trim();
  if (!name) return toast('warning', 'ກະລຸນາໃສ່ຊື່ນ້ຳຢາ');
  const fullPayload = {
    item_code: $('newReagentItemCode')?.value.trim() || null,
    name,
    unit,
    category: normalizeCategory($('newReagentCategory')?.value || 'Other'),
    manufacturer: $('newReagentManufacturer')?.value.trim() || null,
    details: $('newReagentDetails')?.value.trim() || null,
    main_supplier: $('newReagentSupplier')?.value.trim() || null,
    storage_temp: $('newReagentStorageTemp')?.value.trim() || null,
    sort_order: INVENTORY_CODE_ORDER.get(String($('newReagentItemCode')?.value || '').trim().toUpperCase()) || null,
  };
  // Minimal fallback keeps CRUD working on older databases that have not applied
  // the inventory category/metadata migration yet.
  const payload = { name, unit };
  const id = $('editReagentId').value;
  const res = id
    ? await updateWithSchemaFallback('lis_one_stock_master', Number(id), fullPayload, payload)
    : await insertWithSchemaFallback('lis_one_stock_master', fullPayload, payload);
  if (res.success) { 
    const savedId = id || res.data?.[0]?.id;
    if (savedId && !tableSupportsColumn('lis_one_stock_master', 'category')) {
      await saveStoredReagentCategory(savedId, fullPayload.category);
    }
    toast('success','ບັນທຶກສຳເລັດ'); 
    window.cancelEditReagent(); 
    await refreshReagentCache(); 
    renderReagentTable(); 
    api.writeAudit(currentUser(), id ? 'Update Reagent' : 'Add Reagent', 'lis_one_stock_master', fullPayload);
  }
  else {
    console.error('[CRUD] Save ReagentMaster Error:', res.error);
    toast('error', 'ບັນທຶກລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
};
window.deleteReagent = async function(id) {
  if (!await confirmDelete()) return;
  const res = await api.genericDelete('lis_one_stock_master', id);
  if (res.success) { 
    toast('success','ລຶບສຳເລັດ'); 
    await refreshReagentCache(); 
    renderReagentTable(); 
    api.writeAudit(currentUser(), 'Delete Reagent', 'lis_one_stock_master', { id });
  }
  else {
    console.error('[CRUD] Delete Reagent Error:', res.error);
    toast('error', 'ລຶບລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
};

function excelDateToIso(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && window.XLSX?.SSF) {
    const d = window.XLSX.SSF.parse_date_code(value);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d)).toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function parseInventoryWorkbookRows(workbook) {
  const main = workbook.Sheets.MainStock || workbook.Sheets['Main Stock'] || workbook.Sheets[workbook.SheetNames[0]];
  if (!main || !window.XLSX) return [];
  const rows = window.XLSX.utils.sheet_to_json(main, { defval: '' });
  const readCell = (row, keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
    }
    return '';
  };
  return rows
    .map((r, idx) => ({
      sort_order: idx + 1,
      item_code: String(readCell(r, ['Item ID', 'ລະຫັດເຄື່ອງມື']) || '').trim(),
      name: String(readCell(r, ['Item', 'ລາຍການ']) || '').trim(),
      details: String(r.Details || '').trim(),
      stock_standard: Number(r['ຫັກການ Calibration ແລະ ການ maintenance 20%'] || 0) || null,
      unit: String(r.Unit || '').trim(),
      manufacturer: String(r.Manufacturer || '').trim(),
      main_supplier: String(r['Main Supplier'] || '').trim(),
      storage_location: String(r['Storage Location'] || '').trim(),
      storage_temp: String(r.Temp || '').trim(),
      category: normalizeCategory(r.Category || 'Other'),
      last_received_date: excelDateToIso(r['Last Received Date']),
      exp_date: excelDateToIso(r['Expiry Date']),
      current_stock: Number(readCell(r, ['Current Stock', 'ຍອດຄົງເຫຼືອປັດຈຸບັນ']) || 0) || 0,
      notes: String(r.Notes || '').trim(),
    }))
    .filter(r => r.item_code && r.name);
}

function componentsFromDetails(details) {
  const d = String(details || '');
  const components = ['R1', 'R2', 'R3'].filter(c => new RegExp(`\\b${c}\\b`, 'i').test(d));
  return components.length ? components : ['Single'];
}

window.importInventoryExcel = async function(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  if (!window.XLSX) return toast('error', 'XLSX library ບໍ່ພ້ອມໃຊ້ງານ');
  const confirm = typeof Swal === 'undefined' ? window.confirm('Import Excel?') : (await Swal.fire({
    icon: 'question',
    title: 'ນຳເຂົ້າ Inventory ຈາກ Excel?',
    text: 'ລະບົບຈະອ່ານ MainStock ແລະສ້າງ master/lot ຕາມ Item ID ກັບ Current Stock.',
    showCancelButton: true,
    confirmButtonText: 'Import',
    cancelButtonText: 'ຍົກເລີກ'
  })).isConfirmed;
  if (!confirm) return;

  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: 'array', cellDates: true });
  const rows = parseInventoryWorkbookRows(workbook);
  if (!rows.length) return toast('warning', 'ບໍ່ພົບຂໍ້ມູນ MainStock ໃນ Excel');

  await refreshReagentCache();
  let imported = 0;
  let lotsCreated = 0;
  for (const row of rows) {
    let reagent = cache.reagents.find(r => String(r.item_code || '').trim() === row.item_code)
      || cache.reagents.find(r => String(r.name || '').trim().toLowerCase() === row.name.toLowerCase());
    if (!reagent) {
      const fullMaster = {
        item_code: row.item_code,
        name: row.name,
        unit: row.unit,
        details: row.details,
        manufacturer: row.manufacturer,
        main_supplier: row.main_supplier,
        storage_location: row.storage_location,
        storage_temp: row.storage_temp,
        category: normalizeCategory(row.category),
        low_threshold: 5,
        sort_order: row.sort_order,
      };
      const masterRes = await insertWithSchemaFallback('lis_one_stock_master', fullMaster, { name: row.name, unit: row.unit });
      reagent = masterRes.data?.[0] || { id: null, ...fullMaster };
      cache.reagents.push(reagent);
      imported++;
    }
    if (reagent?.id && row.current_stock > 0) {
      const components = componentsFromDetails(row.details);
      const testsPerComponent = row.current_stock;
      for (const component of components) {
      const fullLot = {
        lot_id: `XLS-${row.item_code}-${component}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        reagent_id: Number(reagent.id),
        reagent_name: row.name,
        item_code: row.item_code,
        details: row.details,
        component_type: component,
        unit_type: row.unit || 'test',
        unit_qty: row.current_stock,
        tests_per_unit: 1,
        total_tests: testsPerComponent,
        used_tests: 0,
        remaining_tests: testsPerComponent,
        low_threshold_tests: 10,
        status: 'Normal',
        category: normalizeCategory(row.category),
        manufacturer: row.manufacturer,
        storage_temp: row.storage_temp,
        lot_no: row.item_code,
        exp_date: row.exp_date,
        receive_date: row.last_received_date || new Date().toISOString().slice(0, 10),
        location: row.storage_location,
        supplier: row.main_supplier,
        qty: testsPerComponent,
        qty_remaining: testsPerComponent,
      };
      const fallbackLot = {
        lot_id: fullLot.lot_id,
        reagent_id: fullLot.reagent_id,
        reagent_name: fullLot.reagent_name,
        lot_no: fullLot.lot_no,
        exp_date: fullLot.exp_date,
        receive_date: fullLot.receive_date,
        location: fullLot.location,
        supplier: fullLot.supplier,
        qty: fullLot.qty,
        qty_remaining: fullLot.qty_remaining,
      };
      const lotRes = await insertWithSchemaFallback('lis_one_inventory_lots', fullLot, fallbackLot);
      if (lotRes.success) {
        lotsCreated++;
        await insertWithSchemaFallback('lis_one_stock_transactions', {
          reagent_id: fullLot.reagent_id,
          reagent_name: fullLot.reagent_name,
          type: 'IN',
          transaction_type: 'IN',
          component_type: component,
          lot_no: fullLot.lot_no,
          qty: fullLot.qty,
          qty_tests: fullLot.qty,
          qty_unit: fullLot.unit_qty,
          reference_type: 'manual',
          created_by: currentUser(),
          movement_date: fullLot.receive_date,
          note: `Excel import ${fullLot.component_type} | ${row.item_code}`,
          user_name: currentUser()
        }, {
          reagent_id: fullLot.reagent_id,
          reagent_name: fullLot.reagent_name,
          type: 'IN',
          qty: fullLot.qty,
          note: `Excel import ${fullLot.component_type} | ${row.item_code}`,
          user_name: currentUser()
        });
      }
      }
    }
  }
  event.target.value = '';
  toast('success', `Import ສຳເລັດ: master ${imported}, lot ${lotsCreated}`);
  await window.loadInventoryTable();
};

/* ----- Stock history (placeholder used by existing modal) ----- */
window.saveStockHistoryEdit = async function() {
  toast('info', 'ປະຫວັດການເຄື່ອນໄຫວແມ່ນບໍ່ໃຫ້ແກ້ໂດຍຕົງ. ກະລຸນາໃຊ້ການເບີກ/ຮັບໃໝ່ແທນ.');
  hideModal('stockHistoryEditModal');
};

/* ============================================================
 * MAINTENANCE
 * ============================================================ */
window.loadMaintenanceTable = async function() {
  const body = $('maintenanceTableBody'); if (!body) return;
  const rows = await api.getMaintenanceLogs();
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມູນ</td></tr>';
    return;
  }
  body.innerHTML = rows.map(r => `
    <tr>
      <td class="ps-3">${fmtDate(r.log_date)}</td>
      <td class="fw-semibold">${esc(r.machine)}</td>
      <td><span class="badge bg-info">${esc(r.type)}</span></td>
      <td class="small">${esc(r.action || '-')}</td>
      <td class="text-danger">${fmtDate(r.next_due)}</td>
      <td>${esc(r.user_name || '-')}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-danger" onclick="deleteMaintenance(${r.id})"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join('');
};

window.submitMaintenance = async function() {
  const payload = {
    log_id:     'MNT-' + Date.now().toString().slice(-9),
    machine:    $('maintMachine').value.trim(),
    log_date:   $('maintDate').value || new Date().toISOString().slice(0,10),
    type:       $('maintType').value,
    issues:     $('maintIssues').value.trim(),
    action:     $('maintAction').value.trim(),
    next_due:   $('maintNextDue').value || null,
    user_name:  currentUser()
  };
  if (!payload.machine) return toast('warning','ກະລຸນາໃສ່ຊື່ເຄື່ອງຈັກ');
  const res = await api.genericInsert('lis_one_maintenance_log', payload);
  if (res.success) {
    ['maintMachine','maintIssues','maintAction','maintNextDue'].forEach(id => { if ($(id)) $(id).value=''; });
    toast('success','ບັນທຶກສຳເລັດ');
    api.writeAudit(currentUser(), 'INSERT', 'maintenance_log', { machine: payload.machine });
    window.loadMaintenanceTable();
  } else toast('error','ບັນທຶກລົ້ມເຫຼວ');
};

window.deleteMaintenance = async function(id) {
  if (!await confirmDelete()) return;
  const res = await api.genericDelete('lis_one_maintenance_log', id);
  if (res.success) { toast('success','ລຶບສຳເລັດ'); window.loadMaintenanceTable(); }
  else toast('error','ລຶບລົ້ມເຫຼວ');
};

/* ============================================================
 * TEST MASTER + CSV
 * ============================================================ */
window.loadTestMasterTable = async function() {
  const body = $('masterTableBody'); if (!body) return;
  cache.testMaster = await api.getTestMaster();
  if (!cache.testMaster.length) {
    body.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມູນ</td></tr>';
    return;
  }
  body.innerHTML = cache.testMaster.map(t => `
    <tr>
      <td class="fw-semibold">${esc(t.name)}</td>
      <td><span class="badge bg-secondary">${esc(t.category||'Other')}</span></td>
      <td class="text-end fw-bold text-danger">${fmtKip(t.price)}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-warning" onclick="editTestMaster(${t.id})"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteTestMaster(${t.id})"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join('');
};
window.editTestMaster = (id) => {
  const t = cache.testMaster.find(x => x.id === id); if (!t) return;
  $('editTestId').value = t.id;
  $('setupTestName').value = t.name;
  $('setupTestPrice').value = t.price;
  $('setupTestCat').value = t.category || 'Other';
  $('btnCancelTest')?.classList.remove('d-none');
};
window.cancelEditTest = () => {
  $('editTestId').value = '';
  $('setupTestName').value = '';
  $('setupTestPrice').value = '';
  $('btnCancelTest')?.classList.add('d-none');
};
window.saveTestMaster = async function() {
  const name = $('setupTestName').value.trim();
  if (!name) return toast('warning','ກະລຸນາໃສ່ຊື່ລາຍການກວດ');
  const payload = {
    name,
    price: Number($('setupTestPrice').value) || 0,
    category: $('setupTestCat').value || 'Other'
  };
  const id = $('editTestId').value;
  const res = id
    ? await api.genericUpdate('lis_one_test_master', Number(id), payload)
    : await api.genericInsert('lis_one_test_master', payload);
  if (res.success) {
    api.writeAudit(currentUser(), id ? 'Update Test' : 'Add Test', 'lis_one_test_master', payload);
    toast('success','ບັນທຶກສຳເລັດ'); window.cancelEditTest(); window.loadTestMasterTable();
  } else {
    console.error('[CRUD] Save TestMaster Error:', res.error);
    toast('error','ບັນທຶກລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
};
window.deleteTestMaster = async function(id) {
  if (!await confirmDelete()) return;
  const res = await api.genericDelete('lis_one_test_master', id);
  if (res.success) {
    api.writeAudit(currentUser(), 'Delete Test', 'lis_one_test_master', { id });
    toast('success','ລຶບສຳເລັດ'); window.loadTestMasterTable();
  } else {
    console.error('[CRUD] Delete TestMaster Error:', res.error);
    toast('error','ລຶບລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
};

window.exportTestMasterCSV = function() {
  if (!cache.testMaster.length) return toast('info','ບໍ່ມີຂໍ້ມູນ');
  const csv = ['name,price,category', ...cache.testMaster.map(t =>
    `"${(t.name||'').replace(/"/g,'""')}",${t.price||0},"${t.category||'Other'}"`)].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `test_master_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

window.showImportCSVModal = function() {
  $('csvDataPaste').value = '';
  $('importPreviewBody').innerHTML = '';
  showModal('importCSVModal');
};
$(document)?.addEventListener?.('change', () => {}); // no-op

document.addEventListener('change', (e) => {
  if (e.target?.id === 'csvFileInput') {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { $('csvDataPaste').value = reader.result; previewCSV(); };
    reader.readAsText(file, 'UTF-8');
  }
});
document.addEventListener('input', (e) => {
  if (e.target?.id === 'csvDataPaste') previewCSV();
});

function parseCSV(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    .filter(l => !/^name\s*,\s*price/i.test(l))
    .map(line => {
      const parts = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      const cells = parts.map(p => p.replace(/^"|"$/g,'').replace(/""/g,'"').trim());
      return { name: cells[0]||'', price: Number(cells[1])||0, category: cells[2]||'Other' };
    }).filter(r => r.name);
}
function previewCSV() {
  const rows = parseCSV($('csvDataPaste')?.value || '');
  const body = $('importPreviewBody'); if (!body) return;
  body.innerHTML = rows.slice(0,50).map(r => `<tr><td>${esc(r.name)}</td><td>${r.price}</td><td>${esc(r.category)}</td></tr>`).join('');
}
window.processCSVImport = async function() {
  const rows = parseCSV($('csvDataPaste').value || '');
  if (!rows.length) return toast('warning','ບໍ່ມີຂໍ້ມູນທີ່ Valid');
  const res = await api.genericInsert('lis_one_test_master', rows);
  if (res.success) { hideModal('importCSVModal'); toast('success', `Import ${rows.length} ລາຍການ`); window.loadTestMasterTable(); }
  else toast('error', 'Import ລົ້ມເຫຼວ');
};

/* ============================================================
 * MAPPING (test → reagent)
 * ============================================================ */
window.loadMappingData = async function() {
  if (!cache.testMaster.length) cache.testMaster = await api.getTestMaster();
  if (!cache.reagents.length)   await refreshReagentCache();
  const mapping = await api.getTestReagentMapping();
  cache.mapping = mapping;

  const testSel = $('mapTestName'), reaSel = $('mapReagent');
  if (testSel) testSel.innerHTML = '<option value="" disabled selected>-- ເລືອກ Test --</option>' +
    cache.testMaster.map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('');
  if (reaSel)  reaSel.innerHTML  = '<option value="" disabled selected>-- ເລືອກ Reagent --</option>' +
    cache.reagents.slice().sort(inventoryExcelComparator).map(r => `<option value="${r.id}" data-name="${esc(r.name)}">${esc(r.name)}</option>`).join('');

  const body = $('mappingTableBody');
  if (body) body.innerHTML = mapping.length ? mapping.map(m => `
    <tr data-mapping-row="${m.id}">
      <td>${esc(m.test_name)}</td>
      <td>${esc(m.reagent_name)}</td>
      <td class="text-center"><span class="map-component-pill">${esc(m.component_type || 'Single')}</span></td>
      <td class="text-center fw-semibold">${m.qty}</td>
      <td class="text-center">
        <div class="map-action-group">
          <button type="button" class="map-action-btn map-edit" onclick="editMapping(${m.id})" title="ແກ້ໄຂ Mapping">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button type="button" class="map-action-btn map-delete" onclick="deleteMapping(${m.id})" title="ລຶບ Mapping">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມູນ</td></tr>';
};

function setMappingFormMode(mode, row = null) {
  const editing = mode === 'edit';
  if ($('editMappingId')) $('editMappingId').value = editing ? row.id : '';
  const saveBtn = $('btnSaveMapping');
  if (saveBtn) {
    saveBtn.classList.toggle('btn-secondary', !editing);
    saveBtn.classList.toggle('btn-dark', editing);
    saveBtn.innerHTML = editing
      ? '<i class="bi bi-check2-circle"></i> ອັບເດດ'
      : '<i class="bi bi-plus-lg"></i> ເພີ່ມ';
    saveBtn.title = editing ? 'ອັບເດດ Mapping' : 'ບັນທຶກ Mapping';
  }
  $('btnCancelMapping')?.classList.toggle('d-none', !editing);
  const banner = $('mappingEditBanner');
  if (banner) {
    banner.classList.toggle('d-none', !editing);
    banner.innerHTML = editing
      ? `<i class="bi bi-pencil-square"></i> ກຳລັງແກ້ໄຂ Mapping: <b>${esc(row.test_name)}</b> → <b>${esc(row.reagent_name)}</b>`
      : '';
  }
  document.querySelectorAll('#mappingTableBody tr').forEach(tr => tr.classList.remove('mapping-row-editing'));
  if (editing) document.querySelector(`[data-mapping-row="${row.id}"]`)?.classList.add('mapping-row-editing');
}

window.editMapping = function(id) {
  const row = (cache.mapping || []).find(m => Number(m.id) === Number(id));
  if (!row) return toast('warning', 'ບໍ່ພົບ Mapping ທີ່ຈະແກ້ໄຂ');
  if ($('mapTestName')) $('mapTestName').value = row.test_name || '';
  if ($('mapReagent')) $('mapReagent').value = String(row.reagent_id || '');
  if ($('mapComponentType')) $('mapComponentType').value = row.component_type || 'Single';
  if ($('mapQty')) $('mapQty').value = row.qty || 1;
  setMappingFormMode('edit', row);
};

window.cancelEditMapping = function() {
  ['mapTestName', 'mapReagent'].forEach(id => { if ($(id)) $(id).value = ''; });
  if ($('mapComponentType')) $('mapComponentType').value = 'Single';
  if ($('mapQty')) $('mapQty').value = '';
  setMappingFormMode('add');
};

window.saveMapping = async function() {
  const test_name = $('mapTestName').value;
  const opt = $('mapReagent').selectedOptions[0];
  const reagent_id = Number($('mapReagent').value);
  const qty = Number($('mapQty').value) || 0;
  if (!test_name || !reagent_id || !qty) return toast('warning','ກະລຸນາໃສ່ຂໍ້ມູນໃຫ້ຄົບ');
  const payload = {
    test_name,
    reagent_id,
    reagent_name: opt?.dataset.name || '',
    component_type: $('mapComponentType')?.value || 'Single',
    qty
  };
  const editId = Number($('editMappingId')?.value || 0);
  const res = editId
    ? await updateWithSchemaFallback('lis_one_test_reagent_mapping', editId, payload, {
        test_name,
        reagent_id,
        reagent_name: opt?.dataset.name || '',
        qty
      })
    : await insertWithSchemaFallback('lis_one_test_reagent_mapping', payload, {
    test_name,
    reagent_id,
    reagent_name: opt?.dataset.name || '',
    qty
  });
  if (res.success) { 
    toast('success', editId ? 'ອັບເດດສຳເລັດ' : 'ບັນທຶກສຳເລັດ');
    window.cancelEditMapping();
    window.loadMappingData(); 
    api.writeAudit(currentUser(), editId ? 'Update Mapping' : 'Add Mapping', 'lis_one_test_reagent_mapping', payload);
  }
  else {
    console.error('[CRUD] Save Mapping Error:', res.error);
    toast('error','ບັນທຶກລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
};
window.deleteMapping = async function(id) {
  if (!await confirmDelete()) return;
  const res = await api.genericDelete('lis_one_test_reagent_mapping', id);
  if (res.success) { 
    toast('success','ລຶບສຳເລັດ'); 
    window.loadMappingData(); 
    api.writeAudit(currentUser(), 'Delete Mapping', 'lis_one_test_reagent_mapping', { id });
  }
  else {
    console.error('[CRUD] Delete Mapping Error:', res.error);
    toast('error','ລຶບລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
};

/* ============================================================
 * PACKAGES
 * ============================================================ */
let packageItems = [];

window.loadPackagesTable = async function() {
  cache.packages = await api.genericFetch('lis_one_test_packages', { order: 'id.desc' });
  const body = $('packagesTableBody');
  if (!body) return;
  body.innerHTML = cache.packages.length ? cache.packages.map(p => `
    <tr>
      <td class="fw-semibold">${esc(p.name)}</td>
      <td class="small text-muted">${esc(p.description||'-')}</td>
      <td class="text-end text-danger fw-bold">${fmtKip(p.price)}</td>
      <td class="text-center" data-pkg-items="${p.id}">…</td>
      <td>${p.is_active ? '<span class="badge bg-success">ໃຊ້ງານ</span>' : '<span class="badge bg-secondary">ປິດ</span>'}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-warning" onclick="editPackage(${p.id})"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deletePackage(${p.id})"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມູນ</td></tr>';
  // populate item counts
  for (const p of cache.packages) {
    const items = await api.genericFetch('lis_one_test_package_items', { filter: `package_id=eq.${p.id}` });
    const cell = document.querySelector(`[data-pkg-items="${p.id}"]`);
    if (cell) cell.textContent = items.length;
  }
};

window.openPackageModal = async function(id = null) {
  if (!cache.testMaster.length) cache.testMaster = await api.getTestMaster();
  packageItems = [];
  $('editPackageId').value = '';
  $('pkgName').value = ''; $('pkgPrice').value = '0'; $('pkgActive').value = 'true'; $('pkgDescription').value = '';
  $('packageModalTitle').textContent = 'ສ້າງ Package ໃໝ່';
  if (id) {
    const p = cache.packages.find(x => x.id === id);
    if (p) {
      $('editPackageId').value = p.id;
      $('pkgName').value = p.name; $('pkgPrice').value = p.price; $('pkgActive').value = String(p.is_active);
      $('pkgDescription').value = p.description || '';
      $('packageModalTitle').textContent = 'ແກ້ໄຂ Package';
      packageItems = await api.genericFetch('lis_one_test_package_items', { filter: `package_id=eq.${id}` });
    }
  }
  renderPackageItems();
  showModal('packageModal');
};
window.editPackage = (id) => window.openPackageModal(id);

function renderPackageItems() {
  const body = $('packageItemsBody'); if (!body) return;
  body.innerHTML = packageItems.length ? packageItems.map((it, idx) => `
    <tr>
      <td>${esc(it.test_name)}</td>
      <td class="text-end">${fmtKip(it.price)}</td>
      <td class="text-center"><button class="btn btn-sm btn-outline-danger" onclick="removePackageItem(${idx})"><i class="bi bi-x-circle"></i></button></td>
    </tr>`).join('') : '<tr><td colspan="3" class="text-center text-muted">ກົດ "ເພີ່ມລາຍການ" ດ້ານເທິງ</td></tr>';
}
window.addPackageTestItem = async function() {
  if (!cache.testMaster.length) cache.testMaster = await api.getTestMaster();
  if (typeof Swal === 'undefined') return;
  const opts = cache.testMaster.reduce((o,t) => { o[t.id] = `${t.name} — ${fmtKip(t.price)}`; return o; }, {});
  const { value: id } = await Swal.fire({
    title: 'ເລືອກລາຍການກວດ', input: 'select', inputOptions: opts,
    showCancelButton: true, confirmButtonText: 'ເພີ່ມ', cancelButtonText: 'ຍົກເລີກ'
  });
  if (!id) return;
  const t = cache.testMaster.find(x => String(x.id) === String(id));
  if (!t) return;
  packageItems.push({ test_id: t.id, test_name: t.name, price: t.price });
  renderPackageItems();
};
window.removePackageItem = (idx) => { packageItems.splice(idx, 1); renderPackageItems(); };

window.savePackage = async function() {
  const name = $('pkgName').value.trim();
  if (!name) return toast('warning','ກະລຸນາໃສ່ຊື່ Package');
  const payload = {
    name, description: $('pkgDescription').value.trim(),
    price: Number($('pkgPrice').value) || 0,
    is_active: $('pkgActive').value === 'true'
  };
  const id = $('editPackageId').value;
  const res = id
    ? await api.genericUpdate('lis_one_test_packages', Number(id), payload)
    : await api.genericInsert('lis_one_test_packages', payload);
  if (!res.success) {
    console.error('[CRUD] Save Package Error:', res.error);
    return toast('error','ບັນທຶກລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
  const pkgId = id || (res.data?.[0]?.id);
  if (pkgId) {
    // Replace items: delete existing, insert new
    await api.genericDelete('lis_one_test_package_items', pkgId, 'package_id');
    if (packageItems.length) {
      await api.genericInsert('lis_one_test_package_items',
        packageItems.map(it => ({ package_id: Number(pkgId), test_id: it.test_id, test_name: it.test_name, price: it.price })));
    }
  }
  hideModal('packageModal');
  toast('success','ບັນທຶກສຳເລັດ');
  window.loadPackagesTable();
  api.writeAudit(currentUser(), id ? 'Update Package' : 'Add Package', 'lis_one_test_packages', payload);
};
window.deletePackage = async function(id) {
  if (!await confirmDelete()) return;
  const res = await api.genericDelete('lis_one_test_packages', id);
  if (res.success) { toast('success','ລຶບສຳເລັດ'); window.loadPackagesTable(); }
  else toast('error','ລຶບລົ້ມເຫຼວ');
};

/* ============================================================
 * SETTINGS / DROPDOWNS
 * ============================================================ */
window.loadSettings = async function() {
  cache.settings = await api.getSettings();
  const types = [
    ['VisitType','listVisitType'],
    ['Insite','listInsite'],
    ['Doctor','listDoctor'],
    ['Department','listDepartment'],
    ['Sender','listSender'],
    ['LabDest','listLabDest'],
  ];
  types.forEach(([type, listId]) => {
    const ul = $(listId); if (!ul) return;
    const items = cache.settings.filter(s => s.type === type);
    ul.innerHTML = items.length ? items.map(s => `
      <li class="list-group-item d-flex justify-content-between align-items-center py-1">
        <span class="small">${esc(s.value)}</span>
        <button class="btn btn-sm btn-link text-danger p-0" onclick="deleteSetting(${s.id})"><i class="bi bi-x-circle"></i></button>
      </li>`).join('') : '<li class="list-group-item small text-muted text-center">ບໍ່ມີຂໍ້ມູນ</li>';
  });
};
window.addSetting = async function(type, inputId) {
  const user = currentUser();
  const inp = $(inputId); if (!inp) return;
  const value = inp.value.trim();
  if (!value) return toast('warning','ກະລຸນາໃສ່ຄ່າ');
  const res = await api.genericInsert('lis_one_settings', { type, value });
  if (res.success) { 
    inp.value=''; 
    toast('success','ບັນທຶກ'); 
    window.loadSettings(); 
    api.writeAudit(user, 'Add Setting', 'lis_one_settings', { type, value });
    window.invalidateDropdownCache?.();
  }
  else {
    console.error('[CRUD] Add Setting Error:', res.error);
    toast('error','ບັນທຶກລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
};
window.deleteSetting = async function(id) {
  if (!await confirmDelete()) return;
  const res = await api.genericDelete('lis_one_settings', id);
  if (res.success) { 
    toast('success','ລຶບສຳເລັດ'); 
    window.loadSettings(); 
    api.writeAudit(currentUser(), 'Delete Setting', 'lis_one_settings', { id });
    window.invalidateDropdownCache?.();
  }
  else {
    console.error('[CRUD] Delete Setting Error:', res.error);
    toast('error','ລຶບລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
};

/* ============================================================
 * Result Entry frame (iframe reload)
 * ============================================================ */
window.toggleParamInputFields = function() {
  const t = $('spInputType').value;
  $('divNumberSetup').style.display   = t === 'Number'   ? '' : 'none';
  $('divDropdownSetup').style.display = t === 'Dropdown' ? '' : 'none';
};
window.loadParamSetupData = async function() {
  if (!cache.testMaster.length) cache.testMaster = await api.getTestMaster();
  const sel = $('spTestName');
  if (sel) sel.innerHTML = '<option value="" disabled selected>-- ເລືອກ Test --</option>' +
    cache.testMaster.map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('');
  cache.parameters = await api.getTestParameters();
  const body = $('paramTableBody');
  if (body) body.innerHTML = cache.parameters.length ? cache.parameters.map(p => `
    <tr>
      <td>${esc(p.test_name)}</td>
      <td class="fw-semibold">${esc(p.param_name)}</td>
      <td><span class="badge bg-info">${esc(p.input_type)}</span></td>
      <td class="small">${esc(p.input_type === 'Number' ? `${p.normal_min ?? ''}–${p.normal_max ?? ''}` : (p.options || ''))}</td>
      <td>${esc(p.unit || '-')}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-warning" onclick="editParameter(${p.id})"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteParameter(${p.id})"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມູນ</td></tr>';
  window.toggleParamInputFields();
};
window.editParameter = (id) => {
  const p = cache.parameters.find(x => x.id === id); if (!p) return;
  $('editParamId').value = p.id;
  $('spTestName').value = p.test_name;
  $('spParamName').value = p.param_name;
  $('spInputType').value = p.input_type;
  $('spUnit').value = p.unit || '';
  $('spMin').value = p.normal_min ?? '';
  $('spMax').value = p.normal_max ?? '';
  $('spOptions').value = p.options || '';
  $('btnCancelParameter')?.classList.remove('d-none');
  $('paramFormTitle').innerHTML = '<i class="bi bi-pencil-square me-2 text-warning"></i>ແກ້ໄຂ Parameter';
  window.toggleParamInputFields();
};
window.cancelParameterEdit = () => {
  $('editParamId').value = '';
  ['spParamName','spUnit','spMin','spMax','spOptions'].forEach(id => { if ($(id)) $(id).value = ''; });
  $('btnCancelParameter')?.classList.add('d-none');
  $('paramFormTitle').innerHTML = '<i class="bi bi-plus-circle-dotted me-2 text-primary"></i> ເພີ່ມຄ່າ Parameter ໃໝ່';
};
window.saveParameter = async function() {
  const user = currentUser();
  const payload = {
    test_name:  $('spTestName').value,
    param_name: $('spParamName').value.trim(),
    input_type: $('spInputType').value,
    unit:       $('spUnit').value.trim(),
    options:    $('spOptions').value.trim() || null,
    normal_min: $('spMin').value === '' ? null : Number($('spMin').value),
    normal_max: $('spMax').value === '' ? null : Number($('spMax').value),
  };
  if (!payload.test_name || !payload.param_name) return toast('warning','ກະລຸນາໃສ່ Test ແລະ Parameter');
  const id = $('editParamId').value;
  const res = id
    ? await api.genericUpdate('lis_one_test_parameters', Number(id), payload)
    : await api.genericInsert('lis_one_test_parameters', payload);
  if (res.success) { 
    toast('success','ບັນທຶກສຳເລັດ'); 
    window.cancelParameterEdit(); 
    window.loadParamSetupData(); 
    api.writeAudit(user, id ? 'Update Parameter' : 'Add Parameter', 'lis_one_test_parameters', payload);
  }
  else {
    console.error('[CRUD] Save Parameter Error:', res.error);
    toast('error','ບັນທຶກລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
};
window.deleteParameter = async function(id) {
  if (!await confirmDelete()) return;
  const res = await api.genericDelete('lis_one_test_parameters', id);
  if (res.success) { 
    toast('success','ລຶບສຳເລັດ'); 
    window.loadParamSetupData(); 
    api.writeAudit(currentUser(), 'Delete Parameter', 'lis_one_test_parameters', { id });
  }
  else {
    console.error('[CRUD] Delete Parameter Error:', res.error);
    toast('error','ລຶບລົ້ມເຫຼວ: ' + (res.error?.message || res.error || 'Unknown'));
  }
};

/* ============================================================
 * Result Entry frame (iframe reload)
 * ============================================================ */
window.reloadLabResultFrame = function() {
  const f = $('labResultFrame'); if (!f) return;
  const src = f.src; f.src = 'about:blank'; setTimeout(() => f.src = src, 50);
};

/* ============================================================
 * Hook into showPage AFTER app.js has defined it.
 * ============================================================ */
function wrapShowPage() {
  const orig = window.showPage;
  if (!orig || orig.__wrappedByCrud) return;
  const wrapped = function(e, id) {
    orig(e, id);
    if (id === 'maintenancePage')    window.loadMaintenanceTable?.();
    if (id === 'resultEntryPage')    { window.loadResultEntryOrders?.(); document.getElementById('reListView')?.classList.remove('d-none'); document.getElementById('reWorkspaceView')?.classList.add('d-none'); }
    if (id === 'auditLogPage')       window.loadAuditLog?.();
    if (id === 'patientMasterPage')  window.loadPatientMaster?.();
    if (id === 'patientHistoryPage') window.loadPatientHistoryPage?.(true);
    if (id === 'trackResult')        window.loadOutlabTable?.();
    // Re-apply permissions after page switch
    setTimeout(() => window.applyRolePermissions?.(), 30);
  };
  wrapped.__wrappedByCrud = true;
  window.showPage = wrapped;
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    hardenSidebarNavigation();
    wrapShowPage();
  });
} else {
  hardenSidebarNavigation();
  setTimeout(wrapShowPage, 0);
}

console.log('[crud.js] CRUD module loaded');
