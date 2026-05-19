/* ============================================================
 * LIS-One — RESULT REPORT (Patient Lab Report)
 * Renders a print-ready HTML report and exports to PDF
 * via window.html2pdf (already loaded in index.html).
 * ============================================================ */
import * as api from './api.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const flagCell = (flag) => {
  if (flag === 'H') return '<span style="color:#dc2626;font-weight:700">H ↑</span>';
  if (flag === 'L') return '<span style="color:#d97706;font-weight:700">L ↓</span>';
  if (flag === 'Normal') return '<span style="color:#059669">Normal</span>';
  return '';
};

async function buildReportHtml(order_id) {
  const orderRows = await api.getOrderById(order_id);
  if (!orderRows.length) throw new Error('ບໍ່ພົບໃບກວດ ' + order_id);
  const o = orderRows[0];
  const tests = [...new Set(orderRows.map(r => r.test_name).filter(Boolean))];

  const results = await api.getResultsForOrder(order_id);
  // group by test_name
  const byTest = {};
  results.forEach(r => {
    (byTest[r.test_name] ||= []).push(r);
  });

  // Fetch reference ranges
  const paramResults = await Promise.all(tests.map(tn =>
    api.genericFetch('lis_one_test_parameters', { filter: `test_name=eq.${encodeURIComponent(tn)}`, order: 'id.asc' })
  ));
  const refByTest = {};
  tests.forEach((tn, i) => { refByTest[tn] = paramResults[i]; });

  const dateStr = o.order_datetime ? new Date(o.order_datetime).toLocaleString() : '';
  const printDate = new Date().toLocaleString();

  const testSections = tests.map(tn => {
    const params = refByTest[tn] || [];
    const res = byTest[tn] || [];
    const orderRow = orderRows.find(r => r.test_name === tn) || {};
    const category = orderRow.category || '';
    // Build rows from union of params + results to handle free-text Result
    const rowsToShow = params.length ? params : res.map(r => ({ param_name: r.param_name, unit: '', input_type: 'text' }));
    return `
      <table class="result-block">
        <thead>
          <tr><th colspan="5" class="block-title">${esc(tn)} ${category ? `<span class="block-cat">(${esc(category)})</span>` : ''}</th></tr>
          <tr class="col-head">
            <th>Test / Parameter</th>
            <th class="num">Result</th>
            <th>Unit</th>
            <th>Reference Range</th>
            <th class="flag">Flag</th>
          </tr>
        </thead>
        <tbody>
          ${rowsToShow.map(p => {
            const r = res.find(x => x.param_name === p.param_name);
            const ref = (p.normal_min != null && p.normal_max != null)
              ? `${p.normal_min} – ${p.normal_max}`
              : (p.options || '');
            return `<tr>
              <td>${esc(p.param_name)}</td>
              <td class="num"><b>${esc(r?.result_value ?? '')}</b></td>
              <td>${esc(p.unit || '')}</td>
              <td>${esc(ref)}</td>
              <td class="flag">${flagCell(r?.flag)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }).join('');

  return `
    <div class="rep-root" id="repRoot">
      <style>
        .rep-root { font-family: 'Noto Sans Lao', sans-serif; color: #111827; padding: 24px; background: #fff; max-width: 820px; margin: 0 auto; font-size: 11.5px; }
        .rep-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 14px; }
        .rep-head .brand h2 { margin: 0; font-size: 18px; font-weight: 800; color: #1e293b; }
        .rep-head .brand small { color: #64748b; }
        .rep-head .meta { text-align: right; font-size: 10.5px; color: #475569; }
        .pat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px; background: #f9fafb; }
        .pat-grid .row { display: flex; gap: 6px; }
        .pat-grid .row .lbl { color: #64748b; min-width: 88px; }
        .pat-grid .row b { color: #0f172a; }
        .result-block { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .result-block .block-title { background: #1f2937; color: #fff; text-align: left; padding: 6px 10px; font-weight: 700; font-size: 12px; }
        .result-block .block-cat { font-weight: 400; opacity: 0.7; font-size: 10.5px; }
        .result-block thead .col-head th { background: #f1f5f9; color: #334155; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; padding: 4px 8px; text-align: left; border-bottom: 1px solid #cbd5e1; }
        .result-block tbody td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .result-block .num { text-align: right; }
        .result-block .flag { text-align: center; min-width: 60px; }
        .rep-footer { margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #475569; }
        .sign { width: 200px; text-align: center; }
        .sign .line { border-top: 1px solid #1f2937; margin-top: 36px; padding-top: 4px; }
        .legend { font-size: 9.5px; color: #6b7280; margin-top: 6px; }
      </style>
      <div class="rep-head">
        <div class="brand">
          <h2>LIS-One Laboratory Report</h2>
          <small>One Medical Center — ໃບລາຍງານຜົນກວດ</small>
        </div>
        <div class="meta">
          <div><b>Order:</b> ${esc(order_id)}</div>
          <div><b>Sample:</b> ${esc(dateStr)}</div>
          <div><b>Printed:</b> ${esc(printDate)}</div>
        </div>
      </div>

      <div class="pat-grid">
        <div class="row"><span class="lbl">HN/ID:</span><b>${esc(o.patient_id || '-')}</b></div>
        <div class="row"><span class="lbl">ຊື່:</span><b>${esc(o.patient_name || '-')}</b></div>
        <div class="row"><span class="lbl">ອາຍຸ/ເພດ:</span><b>${esc(o.age || '-')} / ${esc(o.gender || '-')}</b></div>
        <div class="row"><span class="lbl">ໝໍສັ່ງ:</span><b>${esc(o.doctor || '-')}</b></div>
        <div class="row"><span class="lbl">ພະແນກ:</span>${esc(o.department || '-')}</div>
        <div class="row"><span class="lbl">Visit:</span>${esc(o.visit_type || '-')} / ${esc(o.insite || '-')}</div>
      </div>

      ${testSections || '<div style="text-align:center;color:#94a3b8;padding:32px">ບໍ່ມີຜົນກວດ</div>'}

      <div class="legend">Flag legend: <b style="color:#dc2626">H</b> = High &nbsp; <b style="color:#d97706">L</b> = Low &nbsp; <b style="color:#059669">Normal</b> = in range</div>

      <div class="rep-footer">
        <div>
          <div><b>ໝາຍເຫດ:</b> ໃບລາຍງານສ້າງໂດຍລະບົບ LIS-One</div>
          <div style="margin-top:4px">Order Status: ${esc(o.status || 'Pending')}</div>
        </div>
        <div class="sign">
          <div class="line">ຜູ້ກວດ / Lab Technician</div>
        </div>
      </div>
    </div>
  `;
}

window.openResultReport = async function(order_id) {
  try {
    const html = await buildReportHtml(order_id);
    const container = $('reportPreviewContainer');
    if (!container) return;
    container.innerHTML = html;
    $('reportCurrentOrderId').textContent = order_id;
    const modalEl = $('resultReportModal');
    if (window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(modalEl).show();
  } catch (e) {
    console.error(e);
    if (typeof Swal !== 'undefined') Swal.fire('ຜິດພາດ', e.message, 'error');
  }
};

window.printResultReport = function() {
  const el = $('repRoot'); if (!el) return;
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) return;
  w.document.write(`<html><head><title>Result Report</title></head><body>${el.outerHTML}</body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); }, 150);
};

window.exportResultReportPDF = async function() {
  const el = $('repRoot'); if (!el) return;
  const orderId = $('reportCurrentOrderId')?.textContent || 'report';
  if (!window.html2pdf) {
    if (typeof Swal !== 'undefined') Swal.fire('ຜິດພາດ', 'html2pdf ບໍ່ໄດ້ໂຫຼດ', 'error');
    return;
  }
  await window.html2pdf().set({
    margin: 8,
    filename: `LabReport_${orderId}.pdf`,
    image: { type: 'jpeg', quality: 0.96 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  }).from(el).save();
};

console.log('[result_report.js] loaded');
