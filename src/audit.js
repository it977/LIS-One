/* ============================================================
 * LIS-One — AUDIT LOG VIEWER
 * Reads lis_one_audit_log with date / user / action / target filters.
 * ============================================================ */
import * as api from './api.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const actionStyle = {
  INSERT:   'bg-success',
  UPDATE:   'bg-warning text-dark',
  DELETE:   'bg-danger',
  COMPLETE: 'bg-primary',
  SAVE:     'bg-info',
  DEDUCT:   'bg-secondary',
};

function buildFilter() {
  const parts = [];
  const sd = $('alStart')?.value, ed = $('alEnd')?.value;
  const user = ($('alUser')?.value || '').trim();
  const action = $('alAction')?.value;
  const target = ($('alTarget')?.value || '').trim();
  if (sd) parts.push(`created_at=gte.${sd}T00:00:00`);
  if (ed) parts.push(`created_at=lte.${ed}T23:59:59`);
  if (user) parts.push(`user_name=ilike.*${user}*`);
  if (action) parts.push(`action=eq.${action}`);
  if (target) parts.push(`target=ilike.*${target}*`);
  return parts.join('&');
}

window.loadAuditLog = async function() {
  const filter = buildFilter();
  const rows = await api.getAuditLogs({ filter, limit: 2000 });
  const body = $('auditTableBody'); if (!body) return;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມູນ</td></tr>';
    return;
  }
  body.innerHTML = rows.map(r => {
    const cls = actionStyle[r.action] || 'bg-light text-dark';
    let detailsHtml = esc(r.details || '-');
    if (r.details && /^[{\[]/.test(r.details)) {
      try {
        const obj = JSON.parse(r.details);
        detailsHtml = `<code class="small text-muted">${esc(JSON.stringify(obj))}</code>`;
      } catch {}
    }
    return `
      <tr>
        <td class="text-nowrap small">${r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
        <td>${esc(r.user_name || '-')}</td>
        <td><span class="badge ${cls}">${esc(r.action || '-')}</span></td>
        <td class="fw-semibold">${esc(r.target || '-')}</td>
        <td>${detailsHtml}</td>
      </tr>`;
  }).join('');
};

window.resetAuditFilters = function() {
  ['alStart','alEnd','alUser','alTarget'].forEach(id => { if ($(id)) $(id).value = ''; });
  if ($('alAction')) $('alAction').value = '';
  window.loadAuditLog();
};

window.exportAuditCSV = async function() {
  const filter = buildFilter();
  const rows = await api.getAuditLogs({ filter, limit: 5000 });
  if (!rows.length) return;
  const headers = ['created_at','user_name','action','target','details'];
  const csv = [headers.join(','), ...rows.map(r =>
    headers.map(h => `"${String(r[h] ?? '').replace(/"/g,'""').replace(/\n/g,' ')}"`).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `audit_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

console.log('[audit.js] loaded');
