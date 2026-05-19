/* ============================================================
 * LIS-One — RESULT ENTRY MODULE
 * Reads an order, fetches lis_one_test_parameters per test,
 * auto-generates input fields, computes H/L/Normal flag,
 * writes lis_one_test_results, marks order Completed.
 * ============================================================ */
import * as api from './api.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const toast = (icon, title) => {
  if (typeof Swal === 'undefined') return console.log(icon, title);
  Swal.fire({ icon, title, toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
};
const currentUser = () => {
  try { return JSON.parse(sessionStorage.getItem('lis_user') || '{}').username || 'admin'; }
  catch { return 'admin'; }
};

const state = {
  currentOrderId: null,
  orderRows: [],          // lis_one_test_orders rows for this order_id (one per test)
  paramsByTest: {},       // { test_name: [ {id, param_name, input_type, options, unit, normal_min, normal_max} ] }
  existingResults: {},    // { `${test_name}|${param_name}`: { id, result_value, flag } }
};

/* ---------- compute H/L/Normal flag ---------- */
function computeFlag(param, value) {
  if (value == null || value === '') return '';
  if (String(param.input_type).toLowerCase() !== 'number') return 'Normal';
  const v = Number(value);
  if (!Number.isFinite(v)) return '';
  if (param.normal_min != null && v < Number(param.normal_min)) return 'L';
  if (param.normal_max != null && v > Number(param.normal_max)) return 'H';
  return 'Normal';
}

function flagBadge(flag) {
  if (flag === 'H') return '<span class="badge bg-danger">H</span>';
  if (flag === 'L') return '<span class="badge bg-warning text-dark">L</span>';
  if (flag === 'Normal') return '<span class="badge bg-success">N</span>';
  return '<span class="text-muted">—</span>';
}

/* ---------- load order list for selection ---------- */
async function loadOrdersForEntry(filterStatus = 'Pending') {
  const filter = filterStatus === 'all' ? '' : `status=eq.${filterStatus}`;
  const rows = await api.genericFetch('lis_one_test_orders', {
    filter, order: 'order_datetime.desc', limit: 300
  });
  // Group by order_id
  const map = new Map();
  rows.forEach(r => {
    if (!map.has(r.order_id)) {
      map.set(r.order_id, {
        order_id: r.order_id, patient_id: r.patient_id, patient_name: r.patient_name,
        order_datetime: r.order_datetime, status: r.status, count: 0
      });
    }
    map.get(r.order_id).count += 1;
  });
  return [...map.values()];
}

window.loadResultEntryOrders = async function() {
  const status = $('reFilterStatus')?.value || 'Pending';
  const search = ($('reSearchOrder')?.value || '').trim().toLowerCase();
  let rows = await loadOrdersForEntry(status);
  if (search) rows = rows.filter(r =>
    (r.order_id || '').toLowerCase().includes(search) ||
    (r.patient_id || '').toLowerCase().includes(search) ||
    (r.patient_name || '').toLowerCase().includes(search));
  const body = $('reOrdersBody'); if (!body) return;
  body.innerHTML = rows.length ? rows.map(o => `
    <tr>
      <td class="fw-semibold">${esc(o.order_id)}</td>
      <td>${esc(o.patient_id || '-')}</td>
      <td>${esc(o.patient_name)}</td>
      <td class="text-center"><span class="badge bg-light text-dark">${o.count}</span></td>
      <td><small class="text-muted">${o.order_datetime ? new Date(o.order_datetime).toLocaleString() : '-'}</small></td>
      <td>${statusBadgeRE(o.status)}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-primary" onclick="openResultEntry('${esc(o.order_id)}')">
          <i class="bi bi-clipboard2-pulse"></i> ປ້ອນຜົນ
        </button>
        <button class="btn btn-sm btn-outline-secondary" onclick="openResultReport('${esc(o.order_id)}')">
          <i class="bi bi-printer"></i> ໃບລາຍງານ
        </button>
      </td>
    </tr>`).join('') : '<tr><td colspan="7" class="text-center text-muted py-3">ບໍ່ມີໃບກວດ</td></tr>';
};

function statusBadgeRE(s) {
  const v = String(s || 'Pending');
  const c = v === 'Completed' ? 'success' : v === 'Cancelled' ? 'danger' : v === 'Received' ? 'info' : 'secondary';
  return `<span class="badge bg-${c}">${esc(v)}</span>`;
}

/* ---------- open result entry workspace ---------- */
window.openResultEntry = async function(order_id) {
  state.currentOrderId = order_id;
  state.orderRows = await api.getOrderById(order_id);
  if (!state.orderRows.length) { toast('warning', 'ບໍ່ພົບໃບກວດ'); return; }

  const testNames = [...new Set(state.orderRows.map(r => r.test_name).filter(Boolean))];
  // Fetch parameters per unique test in parallel
  const paramResults = await Promise.all(testNames.map(tn =>
    api.genericFetch('lis_one_test_parameters', { filter: `test_name=eq.${encodeURIComponent(tn)}`, order: 'id.asc' })
  ));
  state.paramsByTest = {};
  testNames.forEach((tn, i) => { state.paramsByTest[tn] = paramResults[i]; });

  const existing = await api.getResultsForOrder(order_id);
  state.existingResults = {};
  existing.forEach(r => {
    state.existingResults[`${r.test_name}|${r.param_name}`] = r;
  });

  renderResultEntryWorkspace();
  // Switch to workspace view
  $('reListView').classList.add('d-none');
  $('reWorkspaceView').classList.remove('d-none');
  $('reHeaderOrderId').textContent = order_id;
};

window.backToResultList = function() {
  $('reListView').classList.remove('d-none');
  $('reWorkspaceView').classList.add('d-none');
  state.currentOrderId = null;
  window.loadResultEntryOrders();
};

function renderResultEntryWorkspace() {
  const o = state.orderRows[0] || {};
  // Patient header
  const header = $('rePatientHeader');
  if (header) {
    header.innerHTML = `
      <div class="row g-2 small">
        <div class="col-md-3"><span class="text-muted">HN:</span> <b>${esc(o.patient_id || '-')}</b></div>
        <div class="col-md-4"><span class="text-muted">ຊື່:</span> <b>${esc(o.patient_name || '-')}</b></div>
        <div class="col-md-2"><span class="text-muted">ອາຍຸ:</span> ${esc(o.age || '-')}</div>
        <div class="col-md-1"><span class="text-muted">ເພດ:</span> ${esc(o.gender || '-')}</div>
        <div class="col-md-2"><span class="text-muted">ໝໍ:</span> ${esc(o.doctor || '-')}</div>
        <div class="col-md-3"><span class="text-muted">ວັນທີ:</span> ${o.order_datetime ? new Date(o.order_datetime).toLocaleString() : '-'}</div>
        <div class="col-md-3"><span class="text-muted">ປະເພດ:</span> ${esc(o.visit_type || '-')} / ${esc(o.insite || '-')}</div>
        <div class="col-md-3"><span class="text-muted">ສະຖານະ:</span> ${statusBadgeRE(o.status)}</div>
        <div class="col-md-3"><span class="text-muted">ປະຫວັດສົ່ງຕໍ່:</span> ${esc(o.lab_dest || '-')}</div>
      </div>`;
  }

  // Build per-test cards
  const body = $('reTestsContainer');
  if (!body) return;
  const testNames = [...new Set(state.orderRows.map(r => r.test_name).filter(Boolean))];
  if (!testNames.length) {
    body.innerHTML = '<div class="alert alert-warning">ໃບກວດນີ້ບໍ່ມີລາຍການກວດ</div>';
    return;
  }
  body.innerHTML = testNames.map(tn => renderTestCard(tn)).join('');
  // Wire onchange handlers
  body.querySelectorAll('[data-re-input]').forEach(el => {
    el.addEventListener('input', () => updateFlagUI(el));
    updateFlagUI(el);
  });
}

function renderTestCard(test_name) {
  const params = state.paramsByTest[test_name] || [];
  if (!params.length) {
    return `
      <div class="card re-test-card mb-2">
        <div class="card-header"><i class="bi bi-clipboard2-data me-1"></i>${esc(test_name)}</div>
        <div class="card-body">
          <div class="d-flex align-items-center gap-2">
            <label class="form-label mb-0 small">ຜົນ:</label>
            <input type="text" class="form-control form-control-sm" style="max-width:300px"
              data-re-input data-test="${esc(test_name)}" data-param="Result"
              data-input-type="text"
              value="${esc(getExisting(test_name, 'Result')?.result_value || '')}">
            <span class="ms-2" data-flag-for="${esc(test_name)}|Result">—</span>
          </div>
          <div class="form-text small text-muted">⚠ ບໍ່ມີ parameter ໃນ Setup. ໃຫ້ປ້ອນຜົນ free-text.</div>
        </div>
      </div>`;
  }
  return `
    <div class="card re-test-card mb-2">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span><i class="bi bi-clipboard2-data me-1"></i>${esc(test_name)}</span>
        <small class="text-muted">${params.length} parameter</small>
      </div>
      <div class="card-body p-2">
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0 re-param-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th style="width:200px">ຜົນກວດ</th>
                <th style="width:80px">Unit</th>
                <th style="width:150px">Reference</th>
                <th style="width:70px" class="text-center">Flag</th>
              </tr>
            </thead>
            <tbody>
              ${params.map(p => renderParamRow(test_name, p)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function getExisting(test_name, param_name) {
  return state.existingResults[`${test_name}|${param_name}`];
}

function renderParamRow(test_name, p) {
  const ex = getExisting(test_name, p.param_name);
  const val = ex?.result_value ?? '';
  const type = String(p.input_type || 'number').toLowerCase();
  let inputHtml;
  if (type === 'select' || type === 'dropdown') {
    const opts = (p.options || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    inputHtml = `<select class="form-select form-select-sm" data-re-input data-test="${esc(test_name)}" data-param="${esc(p.param_name)}" data-input-type="select">
      <option value="">--</option>
      ${opts.map(o => `<option value="${esc(o)}"${o===val?' selected':''}>${esc(o)}</option>`).join('')}
    </select>`;
  } else if (type === 'text') {
    inputHtml = `<input type="text" class="form-control form-control-sm" data-re-input data-test="${esc(test_name)}" data-param="${esc(p.param_name)}" data-input-type="text" value="${esc(val)}">`;
  } else {
    inputHtml = `<input type="number" step="any" class="form-control form-control-sm" data-re-input data-test="${esc(test_name)}" data-param="${esc(p.param_name)}" data-input-type="number"
      data-min="${p.normal_min ?? ''}" data-max="${p.normal_max ?? ''}" value="${esc(val)}">`;
  }
  const ref = (p.normal_min != null && p.normal_max != null)
    ? `${p.normal_min} – ${p.normal_max}`
    : (p.options ? esc(p.options).slice(0, 30) : '-');
  return `<tr>
    <td class="fw-semibold">${esc(p.param_name)}</td>
    <td>${inputHtml}</td>
    <td class="small">${esc(p.unit || '')}</td>
    <td class="small text-muted">${ref}</td>
    <td class="text-center" data-flag-for="${esc(test_name)}|${esc(p.param_name)}">${ex ? flagBadge(ex.flag) : '—'}</td>
  </tr>`;
}

function updateFlagUI(el) {
  const test = el.dataset.test, param = el.dataset.param;
  const value = el.value;
  const type = el.dataset.inputType;
  let flag = '';
  if (value !== '') {
    if (type === 'number') {
      const min = el.dataset.min === '' ? null : Number(el.dataset.min);
      const max = el.dataset.max === '' ? null : Number(el.dataset.max);
      const v = Number(value);
      if (Number.isFinite(v)) {
        if (min != null && v < min) flag = 'L';
        else if (max != null && v > max) flag = 'H';
        else flag = 'Normal';
      }
    } else {
      flag = 'Normal';
    }
  }
  const cell = document.querySelector(`[data-flag-for="${cssEscape(test)}|${cssEscape(param)}"]`);
  if (cell) cell.innerHTML = flag ? flagBadge(flag) : '—';
}
function cssEscape(s) { return String(s).replace(/"/g, '\\"'); }

/* ---------- save ---------- */
window.saveResultEntry = async function(markCompleted = false) {
  if (!state.currentOrderId) return;
  const rows = [];
  document.querySelectorAll('#reTestsContainer [data-re-input]').forEach(el => {
    const test_name = el.dataset.test;
    const param_name = el.dataset.param;
    const value = el.value;
    if (value === '' || value == null) return;
    // recompute flag
    const params = state.paramsByTest[test_name] || [];
    const p = params.find(x => x.param_name === param_name) || {};
    const flag = computeFlag({ input_type: p.input_type || el.dataset.inputType, normal_min: p.normal_min, normal_max: p.normal_max }, value);
    rows.push({
      order_id: state.currentOrderId,
      test_name, param_name,
      result_value: String(value),
      flag: flag || 'Normal',
      user_name: currentUser()
    });
  });
  // Replace existing results for this order
  await api.deleteResultsForOrder(state.currentOrderId);
  if (rows.length) await api.bulkInsertResults(rows);
  if (markCompleted) {
    await api.setOrderStatus(state.currentOrderId, 'Completed');
  }
  api.writeAudit(currentUser(), markCompleted ? 'COMPLETE' : 'SAVE', 'test_results',
    { order_id: state.currentOrderId, count: rows.length });
  toast('success', markCompleted ? 'ສຳເລັດ! ປິດໃບກວດແລ້ວ' : 'ບັນທຶກຜົນແລ້ວ');
  if (markCompleted) window.backToResultList();
};

window.printResultFromEntry = function() {
  if (!state.currentOrderId) return;
  window.openResultReport(state.currentOrderId);
};

console.log('[result_entry.js] loaded');
