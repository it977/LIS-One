/* ============================================================
 * LIS-One — OUTLAB + INVENTORY ALERTS + remaining legacy stubs
 *
 * - Outlab: loadOutlabTable, filterOutlabByDate, resetOutlabFilter,
 *           setOutlabStatus, openOutlabResultEntry, exportOutlabCSV
 * - Inventory Alerts: showInventoryAlerts, refreshInventoryAlertBadge
 * - Legacy stubs: cancelEdit, printTubeLabel, filterTestItems
 * ============================================================ */
import * as api from './api.js';

const $   = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const toast = (icon, title) => {
  if (typeof Swal === 'undefined') return console.log(icon, title);
  Swal.fire({ icon, title, toast: true, position: 'top-end', timer: 1800, showConfirmButton: false });
};
const currentUser = () => {
  try { return JSON.parse(sessionStorage.getItem('lis_user') || '{}').username || 'admin'; }
  catch { return 'admin'; }
};

/* ============================================================
 * OUTLAB MANAGEMENT
 * Status workflow: Pending → Sent → Received → Completed
 * ============================================================ */
const outlabState = { rows: [] };

function outlabStatusBadge(s) {
  const v = String(s || 'Pending');
  const cls = v === 'Completed' ? 'bg-success'
            : v === 'Received'  ? 'bg-info text-dark'
            : v === 'Sent'      ? 'bg-warning text-dark'
            : v === 'Cancelled' ? 'bg-danger'
            : 'bg-secondary';
  return `<span class="badge ${cls}">${esc(v)}</span>`;
}

window.loadOutlabTable = async function() {
  // Pull rows where lab_dest is not In-house
  const rows = await api.genericFetch('lis_one_test_orders', {
    filter: `lab_dest=neq.In-house`,
    order: 'order_datetime.desc',
    limit: 500
  });
  outlabState.rows = rows;
  applyOutlabFilter();
};

window.filterOutlabByDate = function() {
  applyOutlabFilter();
};
window.resetOutlabFilter = function() {
  if ($('outlabStartDate')) $('outlabStartDate').value = '';
  if ($('outlabEndDate'))   $('outlabEndDate').value   = '';
  applyOutlabFilter();
};

function applyOutlabFilter() {
  let rows = outlabState.rows.slice();
  const sd = $('outlabStartDate')?.value;
  const ed = $('outlabEndDate')?.value;
  if (sd) rows = rows.filter(r => (r.order_datetime || '') >= sd);
  if (ed) rows = rows.filter(r => (r.order_datetime || '') <= ed + 'T23:59:59');
  renderOutlabTable(rows);
}

function renderOutlabTable(rows) {
  const body = $('outlabTableBody'); if (!body) return;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມູນ outlab</td></tr>';
    return;
  }
  body.innerHTML = rows.map(o => `
    <tr>
      <td class="fw-semibold">${esc(o.order_id)}</td>
      <td><small>${o.order_datetime ? new Date(o.order_datetime).toLocaleString() : '-'}</small></td>
      <td>${esc(o.patient_name)}<br><small class="text-muted">${esc(o.patient_id || '')}</small></td>
      <td>${esc(o.lab_dest || '-')}</td>
      <td>${esc(o.sender || '-')}</td>
      <td class="small">${esc(o.test_name || '-')}</td>
      <td>${outlabStatusBadge(o.status)}</td>
      <td class="small">${o.outlab_received_date ? new Date(o.outlab_received_date).toLocaleString() : '-'}</td>
      <td class="small">${esc(o.outlab_note || '-')}</td>
      <td class="text-nowrap">
        ${o.status === 'Pending' || !o.status
          ? `<button class="btn btn-sm btn-warning" onclick="setOutlabStatus('${esc(o.order_id)}','Sent')" data-perm-table="lis_one_test_orders" data-perm-action="update"><i class="bi bi-send"></i> Sent</button>`
          : ''}
        ${o.status === 'Sent'
          ? `<button class="btn btn-sm btn-info" onclick="setOutlabStatus('${esc(o.order_id)}','Received')" data-perm-table="lis_one_test_orders" data-perm-action="update"><i class="bi bi-inbox"></i> Received</button>`
          : ''}
        ${o.status === 'Received'
          ? `<button class="btn btn-sm btn-primary" onclick="openOutlabResultEntry('${esc(o.order_id)}')" data-perm-table="lis_one_test_results" data-perm-action="insert"><i class="bi bi-clipboard2-pulse"></i> ປ້ອນຜົນ</button>`
          : ''}
        <button class="btn btn-sm btn-outline-secondary" onclick="openResultReport('${esc(o.order_id)}')"><i class="bi bi-printer"></i></button>
      </td>
    </tr>`).join('');
  window.applyRolePermissions?.();
}

window.setOutlabStatus = async function(order_id, status) {
  const payload = { status };
  if (status === 'Sent')      payload.outlab_sent_date = new Date().toISOString();
  if (status === 'Received')  payload.outlab_received_date = new Date().toISOString();
  if (status === 'Completed') payload.completed_at = new Date().toISOString();
  const res = await api.genericUpdate('lis_one_test_orders', order_id, payload, 'order_id');
  if (res.success) {
    api.writeAudit(currentUser(), 'UPDATE', 'test_orders', { order_id, status });
    toast('success', `ປ່ຽນສະຖານະເປັນ ${status}`);
    window.loadOutlabTable();
  } else toast('error', 'ປ່ຽນສະຖານະລົ້ມເຫຼວ');
};

window.openOutlabResultEntry = function(order_id) {
  // Re-use the same in-house Result Entry workspace
  if (typeof window.showPage === 'function') window.showPage(null, 'resultEntryPage');
  setTimeout(() => window.openResultEntry?.(order_id), 80);
};

window.exportOutlabCSV = function() {
  const rows = outlabState.rows;
  if (!rows.length) return toast('info','ບໍ່ມີຂໍ້ມູນ');
  const headers = ['order_id','order_datetime','patient_id','patient_name','lab_dest','sender','test_name','status','outlab_sent_date','outlab_received_date','outlab_note'];
  const csv = [headers.join(','), ...rows.map(r =>
    headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""').replace(/\n/g,' ')}"`).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `outlab_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

/* ============================================================
 * INVENTORY ALERTS
 * Three buckets:
 *   - expired   : exp_date < today
 *   - expiring  : 0 ≤ days_to_expiry ≤ 30
 *   - lowStock  : qty_remaining ≤ stock_master.low_threshold
 * ============================================================ */
const alertsState = { expired: [], expiring: [], low: [] };

async function computeInventoryAlerts() {
  const [lots, masters] = await Promise.all([
    api.getInventoryLots(),
    api.getStockMaster(),
  ]);
  const thr = {};
  masters.forEach(m => { thr[m.id] = Number(m.low_threshold ?? 5) || 5; });

  const now = new Date();
  const today = now.toISOString().slice(0,10);

  alertsState.expired  = [];
  alertsState.expiring = [];
  // aggregate stock by reagent_id
  const stockByReagent = {};
  lots.forEach(l => {
    if (l.exp_date && l.exp_date < today) {
      alertsState.expired.push(l);
    } else if (l.exp_date) {
      const days = Math.ceil((new Date(l.exp_date) - now) / 86400000);
      if (days >= 0 && days <= 30) alertsState.expiring.push({ ...l, days });
    }
    const r = stockByReagent[l.reagent_id] ||= { reagent_id: l.reagent_id, reagent_name: l.reagent_name, total: 0 };
    r.total += Number(l.qty_remaining) || 0;
  });

  alertsState.low = Object.values(stockByReagent)
    .filter(r => r.total <= (thr[r.reagent_id] || 5))
    .map(r => ({ ...r, threshold: thr[r.reagent_id] || 5 }));

  return alertsState;
}

window.refreshInventoryAlertBadge = async function() {
  await computeInventoryAlerts();
  const total = alertsState.expired.length + alertsState.expiring.length + alertsState.low.length;
  const badge = $('alertCountBadge');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? '' : 'none';
  }
};

window.showInventoryAlerts = async function() {
  await computeInventoryAlerts();
  const html = `
    <ul class="nav nav-tabs" id="invAlertTabs" role="tablist">
      <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tabExpired" type="button">ໝົດອາຍຸ <span class="badge bg-danger ms-1">${alertsState.expired.length}</span></button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabExpiring" type="button">ໃກ້ໝົດ <span class="badge bg-warning text-dark ms-1">${alertsState.expiring.length}</span></button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabLow" type="button">Stock ຕ່ຳ <span class="badge bg-info ms-1">${alertsState.low.length}</span></button></li>
    </ul>
    <div class="tab-content pt-2">
      <div class="tab-pane fade show active" id="tabExpired">${renderAlertTable(alertsState.expired, 'expired')}</div>
      <div class="tab-pane fade"            id="tabExpiring">${renderAlertTable(alertsState.expiring, 'expiring')}</div>
      <div class="tab-pane fade"            id="tabLow">${renderAlertTable(alertsState.low, 'low')}</div>
    </div>`;
  const container = $('inventoryAlertsBody');
  if (container) container.innerHTML = html;
  const el = $('inventoryAlertsModal');
  if (window.bootstrap?.Modal && el) bootstrap.Modal.getOrCreateInstance(el).show();
};

function renderAlertTable(rows, kind) {
  if (!rows.length) return '<div class="text-muted text-center py-3 small">ບໍ່ມີລາຍການ</div>';
  if (kind === 'low') {
    return `<table class="table table-sm table-hover align-middle mb-0">
      <thead class="table-light"><tr><th>Reagent</th><th class="text-center">ມີຢູ່ (ລວມ)</th><th class="text-center">Threshold</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td class="fw-semibold">${esc(r.reagent_name)}</td>
        <td class="text-center text-danger fw-bold">${Number(r.total).toLocaleString()}</td>
        <td class="text-center text-muted">${Number(r.threshold).toLocaleString()}</td>
      </tr>`).join('')}</tbody></table>`;
  }
  return `<table class="table table-sm table-hover align-middle mb-0">
    <thead class="table-light"><tr><th>Reagent</th><th>Lot No</th><th>Exp Date</th><th class="text-center">${kind === 'expiring' ? 'Days' : 'Remain'}</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td class="fw-semibold">${esc(r.reagent_name)}</td>
      <td>${esc(r.lot_no || '-')}</td>
      <td class="${kind === 'expired' ? 'text-danger' : 'text-warning'}">${esc(r.exp_date || '-')}</td>
      <td class="text-center fw-bold">${kind === 'expiring' ? r.days + 'd' : Number(r.qty_remaining || 0).toLocaleString()}</td>
    </tr>`).join('')}</tbody></table>`;
}

/* ============================================================
 * LEGACY STUBS now wired
 * ============================================================ */

// Order form: cancel "edit" mode (resets form + hides edit banner)
window.cancelEdit = function() {
  const banner = $('editAlert');
  if (banner) banner.classList.add('d-none');
  const idDisp = $('editOrderIdDisplay');
  if (idDisp) idDisp.textContent = '';
  window.resetForm?.();
  toast('info', 'ຍົກເລີກການແກ້ໄຂ');
};

// Quick filter inside the order-form test grid
window.filterTestItems = function() {
  const q = ($('searchTestInput')?.value || '').toLowerCase().trim();
  const cards = document.querySelectorAll('#dynamicTestContainer .test-item-card');
  let visibleGroups = new Set();
  cards.forEach(card => {
    const name = card.textContent.toLowerCase();
    const match = !q || name.includes(q);
    const col = card.closest('[class*="col-"]');
    if (col) col.style.display = match ? '' : 'none';
    if (match) {
      const group = card.closest('.col-12.mt-3');
      if (group) visibleGroups.add(group);
    }
  });
  // Hide group headers whose children are all hidden
  document.querySelectorAll('#dynamicTestContainer .col-12.mt-3').forEach(g => {
    g.style.display = !q || visibleGroups.has(g) ? '' : 'none';
  });
};

// Tube label: print a simple barcode-less sticker for the current cart
window.printTubeLabel = function() {
  const pid   = $('patientId')?.value?.trim() || '';
  const pname = $('patientName')?.value?.trim() || '';
  const age   = $('age')?.value || '';
  const gender = $('gender')?.value || '';
  const doc   = $('doctor')?.value || '';
  const now   = new Date();
  if (!pid || !pname) return toast('warning', 'ກະລຸນາໃສ່ HN ແລະ ຊື່ກ່ອນພິມປ້າຍ');

  // Read current cart for test list
  const items = [...document.querySelectorAll('.test-checkbox:checked')].map(c => c.dataset.name);

  const orderId = 'ORD-' + now.getTime().toString().slice(-8);
  const html = `
    <html><head><title>Tube Label — ${esc(pid)}</title>
    <style>
      body{font-family:'Noto Sans Lao',sans-serif;padding:8px;margin:0}
      .label{border:1px dashed #555;padding:10px 12px;margin-bottom:8px;width:300px}
      .hn{font-size:16px;font-weight:800;letter-spacing:0.5px}
      .nm{font-size:13px;font-weight:600;margin-top:2px}
      .meta{font-size:10px;color:#555;margin-top:4px;display:flex;justify-content:space-between}
      .tests{font-size:10.5px;margin-top:4px;border-top:1px dotted #999;padding-top:4px}
      .order{font-size:10px;color:#888;margin-top:2px}
    </style></head>
    <body onload="window.print()">
      <div class="label">
        <div class="hn">${esc(pid)}</div>
        <div class="nm">${esc(pname)}</div>
        <div class="meta"><span>${esc(gender)} · ${esc(age)}y</span><span>${now.toLocaleDateString()}</span></div>
        <div class="tests">${items.length ? items.map(esc).join(' · ') : '<i>(ບໍ່ມີລາຍການ)</i>'}</div>
        <div class="order">${esc(orderId)} · Dr. ${esc(doc)}</div>
      </div>
    </body></html>`;
  const w = window.open('', '_blank', 'width=420,height=420');
  if (!w) return toast('error', 'Pop-up blocked');
  w.document.write(html);
  w.document.close();
};

console.log('[ops.js] loaded');
