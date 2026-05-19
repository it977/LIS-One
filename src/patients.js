/* ============================================================
 * LIS-One — PATIENT MASTER
 *
 * Backed by lis_one_patients (HN auto-generated as P-YYYYMMDD-NNN).
 *
 * Exports (window):
 *   - loadPatientMaster()       : list/search view
 *   - openPatientModal(id?)     : create / edit
 *   - savePatient()
 *   - deletePatient(id)
 *   - openPatientPicker(cb)     : modal picker used by Order form
 *   - createPatientFromPicker() : quick-create from picker
 *   - loadPatientHistoryPage(force?) : "ປະຫວັດການກວດ" page (legacy stub now real)
 *   - openPatientVisitDetail(hn)
 *   - closePatientHistoryDetail()
 *   - filterPatientHistory()
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
const showModal = (id) => {
  const el = $(id); if (!el) return;
  if (window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(el).show();
};
const hideModal = (id) => {
  const el = $(id); if (!el) return;
  if (window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(el).hide();
};
const confirmDelete = async (msg = 'ຕ້ອງການລຶບລາຍການນີ້ບໍ?') => {
  if (typeof Swal === 'undefined') return confirm(msg);
  const r = await Swal.fire({ title: msg, icon: 'warning', showCancelButton: true,
    confirmButtonText: 'ລຶບ', cancelButtonText: 'ຍົກເລີກ', confirmButtonColor: '#dc2626' });
  return r.isConfirmed;
};

const state = {
  patients: [],
  masterPatients: [],
  patientOptions: [],
  pickerCallback: null,
  historyCache: [],   // grouped per HN for history page
  historyFiltered: [],
};

const HIS_PATIENT_TABLE = 'HIS_One_Patients';

/* ============================================================
 * HN auto-generator — P-YYYYMMDD-NNN
 *   - YYYYMMDD = today
 *   - NNN = next sequence per day (read MAX existing for today and +1)
 * ============================================================ */
async function generateHN() {
  const now = new Date();
  const ymd = now.toISOString().slice(0,10).replace(/-/g, '');
  const prefix = `P-${ymd}-`;
  const rows = await api.genericFetch('lis_one_patients', {
    filter: `hn=like.${prefix}*`, order: 'hn.desc', limit: 1
  });
  let next = 1;
  if (rows.length) {
    const m = String(rows[0].hn || '').match(/-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return prefix + String(next).padStart(3, '0');
}

function ageFromDob(dob) {
  if (!dob) return '';
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const md = now.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : '';
}

function firstValue(row = {}, keys = []) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function normalizeHisGender(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (['m', 'male', 'man', 'ຊາຍ', 'ชาย'].includes(text)) return 'Male';
  if (['f', 'female', 'woman', 'ຍິງ', 'หญิง'].includes(text)) return 'Female';
  return value;
}

function normalizePatientRow(row = {}) {
  const isHisPatient = row.Patient_ID || row.First_Name || row.Last_Name;
  const hn = row.hn || row.patient_id || row.Patient_ID || '';
  if (!hn) return null;
  const firstName = firstValue(row, ['First_Name', 'first_name']);
  const lastName = firstValue(row, ['Last_Name', 'last_name']);
  const hisName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const title = firstValue(row, ['title', 'Title', 'prefix', 'Prefix']);
  const dob = firstValue(row, ['dob', 'DOB', 'Date_of_Birth', 'Date_Of_Birth', 'Birth_Date', 'BirthDate', 'Birthday']);
  const age = firstValue(row, ['age', 'Age']);
  const createdAt = firstValue(row, ['created_at', 'Created_At', 'Created_Date', 'Register_Date', 'Registration_Date', 'order_datetime']);
  const village = firstValue(row, ['Village', 'village']);
  const district = firstValue(row, ['District', 'district']);
  const province = firstValue(row, ['Province', 'province']);
  return {
    id: row.id ?? null,
    hn,
    title,
    name: row.name || row.patient_name || hisName || '',
    dob: dob || null,
    age: age !== '' ? age : (dob ? ageFromDob(dob) : null),
    gender: normalizeHisGender(row.gender || row.Gender || ''),
    phone: firstValue(row, ['phone', 'Phone', 'Phone_Number', 'Mobile', 'Telephone', 'Tel']),
    village,
    address: row.address || row.Address || [village, district, province].filter(Boolean).join(', '),
    note: row.note || '',
    created_at: createdAt || '',
    _source: row._source || (row.hn ? 'master' : (isHisPatient ? 'his-table' : 'his'))
  };
}

async function getHisPatientsFromTable() {
  const rows = await api.genericFetch(HIS_PATIENT_TABLE, {
    order: 'Patient_ID.asc',
    limit: 5000
  });
  return rows.map(normalizePatientRow).filter(Boolean);
}

async function getHisPatientsFromOrders() {
  const orders = await api.genericFetch('lis_one_test_orders', { order: 'order_datetime.desc', limit: 5000 });
  const map = new Map();
  for (const order of orders) {
    const patient = normalizePatientRow(order);
    if (patient?.hn && !map.has(patient.hn)) map.set(patient.hn, patient);
  }
  return [...map.values()];
}

function mergePatientSources(masterRows = [], hisRows = []) {
  const map = new Map();
  for (const patient of hisRows.map(normalizePatientRow).filter(Boolean)) map.set(patient.hn, patient);
  for (const patient of masterRows.map(normalizePatientRow).filter(Boolean)) {
    map.set(patient.hn, { ...map.get(patient.hn), ...patient, _source: 'master' });
  }
  return [...map.values()].sort((a, b) => String(a.hn).localeCompare(String(b.hn)));
}

function ensurePatientDatalist() {
  let list = $('hisPatientOptions');
  if (!list) {
    list = document.createElement('datalist');
    list.id = 'hisPatientOptions';
    document.body.appendChild(list);
  }
  ['patientId', 'pHn'].forEach(id => {
    const input = $(id);
    if (input) input.setAttribute('list', 'hisPatientOptions');
  });
  return list;
}

function renderPatientDatalist(rows = state.patientOptions) {
  const list = ensurePatientDatalist();
  list.innerHTML = rows.map(patient => {
    const label = [patient.name, patient.gender, patient.age].filter(v => v !== '' && v != null).join(' | ');
    return `<option value="${esc(patient.hn)}" label="${esc(label)}"></option>`;
  }).join('');
}

function findPatientByHN(hn) {
  const key = String(hn || '').trim().toLowerCase();
  return state.patientOptions.find(patient => String(patient.hn || '').toLowerCase() === key);
}

function fillPatientFields(target, patient) {
  if (!patient) return false;
  const ids = target === 'modal'
    ? { hn: 'pHn', name: 'pName', age: 'pAge', gender: 'pGender', phone: 'pPhone', address: 'pAddress' }
    : { hn: 'patientId', name: 'patientName', age: 'age', gender: 'gender' };

  if ($(ids.hn)) $(ids.hn).value = patient.hn || '';
  if ($(ids.name)) $(ids.name).value = patient.name || '';
  if ($(ids.age)) $(ids.age).value = patient.age ?? '';
  if ($(ids.gender) && patient.gender) $(ids.gender).value = patient.gender;
  if (ids.phone && $(ids.phone)) $(ids.phone).value = patient.phone || '';
  if (ids.address && $(ids.address)) $(ids.address).value = patient.address || '';
  return true;
}

async function refreshPatientOptions(force = false) {
  if (!force && state.patientOptions.length) return state.patientOptions;
  const [masterRows, hisTableRows, orderHisRows] = await Promise.all([
    api.genericFetch('lis_one_patients', { order: 'created_at.desc', limit: 1000 }),
    getHisPatientsFromTable().catch(e => {
      console.warn('[patients] HIS patient table fetch failed', e);
      return [];
    }),
    getHisPatientsFromOrders()
  ]);
  state.masterPatients = masterRows.map(normalizePatientRow).filter(Boolean);
  state.patientOptions = mergePatientSources(masterRows, [...orderHisRows, ...hisTableRows]);
  renderPatientDatalist(state.patientOptions);
  return state.patientOptions;
}

/* ============================================================
 * Patient Master page
 * ============================================================ */
window.loadPatientMaster = async function() {
  state.patients = await refreshPatientOptions(true);
  renderPatientMasterTable(state.patients);
};

function renderPatientMasterTable(rows) {
  const body = $('patientMasterTableBody'); if (!body) return;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No patient data</td></tr>';
    return;
  }
  body.innerHTML = rows.map(p => {
    const payload = JSON.stringify(p).replace(/'/g, '&apos;');
    const isLisPatient = p._source === 'master' && p.id;
    const actions = isLisPatient ? `
      <button class="btn btn-sm btn-outline-warning" onclick="openPatientModal(${p.id})" data-perm-table="lis_one_patients" data-perm-action="update" title="Edit"><i class="bi bi-pencil"></i></button>
      <button class="btn btn-sm btn-outline-danger" onclick="deletePatient(${p.id})" data-perm-table="lis_one_patients" data-perm-action="delete" title="Delete"><i class="bi bi-trash"></i></button>
    ` : `
      <button class="btn btn-sm btn-outline-success" onclick='_openPatientFromHis(${payload})' data-perm-table="lis_one_patients" data-perm-action="insert" title="Import from HIS"><i class="bi bi-person-plus"></i></button>
    `;
    return `
    <tr>
      <td class="fw-semibold text-primary">${esc(p.hn)}</td>
      <td>${esc(p.name)}${p._source !== 'master' ? ' <span class="badge bg-light text-secondary border ms-1">HIS</span>' : ''}</td>
      <td class="text-center">${esc(p.gender || '-')}</td>
      <td class="text-center">${p.age != null ? p.age : (p.dob ? ageFromDob(p.dob) : '-')}</td>
      <td>${esc(p.phone || '-')}</td>
      <td class="small">${esc(p.address || '-')}</td>
      <td><small class="text-muted">${p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</small></td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-info" onclick="openPatientHistoryByHN('${esc(p.hn)}')" title="History"><i class="bi bi-clock-history"></i></button>
        ${actions}
      </td>
    </tr>`;
  }).join('');
  window.applyRolePermissions?.();
  return;
  /*
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມູນຄົນເຈັບ</td></tr>';
    return;
  }
  body.innerHTML = rows.map(p => `
    <tr>
      <td class="fw-semibold text-primary">${esc(p.hn)}</td>
      <td>${esc(p.name)}</td>
      <td class="text-center">${esc(p.gender || '-')}</td>
      <td class="text-center">${p.age != null ? p.age : (p.dob ? ageFromDob(p.dob) : '-')}</td>
      <td>${esc(p.phone || '-')}</td>
      <td class="small">${esc(p.address || '-')}</td>
      <td><small class="text-muted">${p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</small></td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-info" onclick="openPatientHistoryByHN('${esc(p.hn)}')" title="ປະຫວັດການກວດ"><i class="bi bi-clock-history"></i></button>
        <button class="btn btn-sm btn-outline-warning" onclick="openPatientModal(${p.id})" data-perm-table="lis_one_patients" data-perm-action="update" title="ແກ້ໄຂ"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger"  onclick="deletePatient(${p.id})" data-perm-table="lis_one_patients" data-perm-action="delete" title="ລຶບ"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join('');
  window.applyRolePermissions?.();
  */
}

window.filterPatientMaster = function() {
  const q = ($('patientMasterSearch')?.value || '').toLowerCase().trim();
  if (!q) return renderPatientMasterTable(state.patients);
  renderPatientMasterTable(state.patients.filter(p =>
    (p.hn || '').toLowerCase().includes(q) ||
    (p.name || '').toLowerCase().includes(q) ||
    (p.phone || '').toLowerCase().includes(q)));
};

window.openPatientModal = async function(id = null) {
  await refreshPatientOptions();
  $('editPatientId').value = '';
  ['pHn','pName','pDob','pAge','pPhone','pAddress','pNote'].forEach(k => { if ($(k)) $(k).value = ''; });
  if ($('pGender')) $('pGender').value = 'Male';
  if (id) {
    const p = state.masterPatients.find(x => x.id === id) || state.patients.find(x => x.id === id);
    if (p) {
      $('editPatientId').value = p.id;
      $('pHn').value = p.hn || '';
      $('pName').value = p.name || '';
      $('pDob').value = p.dob ? p.dob.slice(0,10) : '';
      $('pAge').value = p.age ?? '';
      $('pGender').value = p.gender || 'Male';
      $('pPhone').value = p.phone || '';
      $('pAddress').value = p.address || '';
      $('pNote').value = p.note || '';
    }
  } else {
    $('pHn').value = await generateHN();
  }
  showModal('patientModal');
};

window._openPatientFromHis = async function(patient) {
  await window.openPatientModal(null);
  fillPatientFields('modal', patient);
};

document.addEventListener('change', (e) => {
  if (e.target?.id === 'pDob') {
    const a = ageFromDob($('pDob').value);
    if (a !== '') $('pAge').value = a;
  }
  if (e.target?.id === 'pHn') {
    fillPatientFields('modal', findPatientByHN(e.target.value));
  }
  if (e.target?.id === 'patientId') {
    fillPatientFields('order', findPatientByHN(e.target.value));
  }
});

document.addEventListener('input', (e) => {
  if (e.target?.id === 'pHn') {
    fillPatientFields('modal', findPatientByHN(e.target.value));
  }
  if (e.target?.id === 'patientId') {
    fillPatientFields('order', findPatientByHN(e.target.value));
  }
});

window.savePatient = async function() {
  const hn   = $('pHn').value.trim();
  const name = $('pName').value.trim();
  if (!hn || !name) return toast('warning', 'ກະລຸນາໃສ່ HN ແລະ ຊື່');
  const payload = {
    hn, name,
    dob: $('pDob').value || null,
    age: $('pAge').value === '' ? null : Number($('pAge').value),
    gender: $('pGender').value || null,
    phone: $('pPhone').value.trim() || null,
    address: $('pAddress').value.trim() || null,
    note: $('pNote').value.trim() || null,
    updated_at: new Date().toISOString(),
  };
  const id = $('editPatientId').value;
  const res = id
    ? await api.genericUpdate('lis_one_patients', Number(id), payload)
    : await api.genericInsert('lis_one_patients', payload);
  if (res.success) {
    api.writeAudit(currentUser(), id ? 'UPDATE' : 'INSERT', 'patients', { hn, name });
    hideModal('patientModal');
    toast('success', 'ບັນທຶກສຳເລັດ');
    await window.loadPatientMaster?.();
    // If picker was open, deliver newly-created patient
    if (state.pickerCallback) {
      const created = (await api.genericFetch('lis_one_patients',
        { filter: `hn=eq.${encodeURIComponent(hn)}`, limit: 1 }))[0];
      if (created) state.pickerCallback(created);
      state.pickerCallback = null;
      hideModal('patientPickerModal');
    }
  } else toast('error', res.error || 'ບັນທຶກລົ້ມເຫຼວ');
};

window.deletePatient = async function(id) {
  if (!await confirmDelete('ລຶບຄົນເຈັບນີ້? (ປະຫວັດການກວດທີ່ມີຢູ່ຈະບໍ່ຖືກລຶບ)')) return;
  const res = await api.genericDelete('lis_one_patients', id);
  if (res.success) {
    api.writeAudit(currentUser(), 'DELETE', 'patients', { id });
    toast('success', 'ລຶບສຳເລັດ');
    window.loadPatientMaster?.();
  } else toast('error', 'ລຶບລົ້ມເຫຼວ');
};

/* ============================================================
 * Patient Picker (used by Order form)
 * ============================================================ */
window.openPatientPicker = function(callback) {
  state.pickerCallback = callback;
  $('patientPickerSearch').value = '';
  $('patientPickerResults').innerHTML = '<div class="text-muted text-center py-3 small">ພິມເພື່ອຄົ້ນຫາ HN / ຊື່ / ເບີໂທ ຫຼື ກົດ "ໃໝ່"</div>';
  refreshPatientOptions().catch(e => console.warn('[patients] options failed', e));
  showModal('patientPickerModal');
};
window.searchPatientPicker = async function() {
  const q = ($('patientPickerSearch').value || '').trim();
  if (q.length < 1) return;
  // Server-side ilike on hn OR name OR phone
  const f = `or=(hn.ilike.*${q}*,name.ilike.*${q}*,phone.ilike.*${q}*)`;
  const rows = await api.genericFetch('lis_one_patients', { filter: f, order: 'created_at.desc', limit: 30 });
  if (!rows.length) {
    $('patientPickerResults').innerHTML = '<div class="text-muted text-center py-3 small">ບໍ່ພົບ — ກົດ "ໃໝ່" ເພື່ອສ້າງຄົນເຈັບ</div>';
    return;
  }
  $('patientPickerResults').innerHTML = `
    <div class="list-group list-group-flush">
      ${rows.map(p => `
        <button type="button" class="list-group-item list-group-item-action" onclick='_pickPatient(${JSON.stringify({id:p.id,hn:p.hn,name:p.name,age:p.age,gender:p.gender,phone:p.phone}).replace(/'/g,"&apos;")})'>
          <div class="d-flex justify-content-between align-items-center">
            <div><b class="text-primary">${esc(p.hn)}</b> — ${esc(p.name)}</div>
            <small class="text-muted">${esc(p.gender || '')} ${p.age ?? ''} ${p.phone ? '· ' + esc(p.phone) : ''}</small>
          </div>
        </button>
      `).join('')}
    </div>`;
};

window.searchPatientPicker = async function() {
  const q = ($('patientPickerSearch').value || '').trim();
  if (q.length < 1) return;
  const options = await refreshPatientOptions();
  const needle = q.toLowerCase();
  const rows = options.filter(p =>
    (p.hn || '').toLowerCase().includes(needle) ||
    (p.name || '').toLowerCase().includes(needle) ||
    (p.phone || '').toLowerCase().includes(needle)
  ).slice(0, 30);
  if (!rows.length) {
    $('patientPickerResults').innerHTML = '<div class="text-muted text-center py-3 small">No patient found</div>';
    return;
  }
  $('patientPickerResults').innerHTML = `
    <div class="list-group list-group-flush">
      ${rows.map(p => `
        <button type="button" class="list-group-item list-group-item-action" onclick='_pickPatient(${JSON.stringify({id:p.id,hn:p.hn,name:p.name,age:p.age,gender:p.gender,phone:p.phone}).replace(/'/g,"&apos;")})'>
          <div class="d-flex justify-content-between align-items-center">
            <div><b class="text-primary">${esc(p.hn)}</b> - ${esc(p.name)}${p._source !== 'master' ? ' <span class="badge bg-light text-secondary border ms-1">HIS</span>' : ''}</div>
            <small class="text-muted">${esc(p.gender || '')} ${p.age ?? ''} ${p.phone ? ' - ' + esc(p.phone) : ''}</small>
          </div>
        </button>
      `).join('')}
    </div>`;
};
window._pickPatient = function(p) {
  if (state.pickerCallback) state.pickerCallback(p);
  state.pickerCallback = null;
  hideModal('patientPickerModal');
};
window.createPatientFromPicker = async function() {
  // Pre-fill modal then open
  await window.openPatientModal(null);
  // patientModal must appear on top; bootstrap stacks correctly
};

/* ============================================================
 * PATIENT HISTORY PAGE (was legacy stub)
 * ============================================================ */
async function buildPatientHistory() {
  const [orders, patientOptions] = await Promise.all([
    api.getRecentOrders(),
    refreshPatientOptions().catch(e => {
      console.warn('[patients] history patient detail lookup failed', e);
      return state.patientOptions || [];
    })
  ]);
  const patientMap = new Map((patientOptions || []).map(patient => [String(patient.hn || '').toLowerCase(), patient]));
  const map = new Map();
  for (const o of orders) {
    const key = o.patient_id || o.patient_name;
    if (!key) continue;
    let g = map.get(key);
    if (!g) {
      const patient = patientMap.get(String(o.patient_id || '').toLowerCase()) || normalizePatientRow(o) || {};
      g = {
        patient_id: o.patient_id,
        patient_name: o.patient_name || patient.name,
        title: patient.title || firstValue(o, ['title', 'Title', 'prefix', 'Prefix']),
        age: patient.age ?? firstValue(o, ['age', 'Age']),
        village: patient.village || firstValue(o, ['village', 'Village']),
        phone: patient.phone || firstValue(o, ['phone', 'Phone', 'Phone_Number', 'Mobile', 'Telephone', 'Tel']),
        visits: 0,
        results_ready: 0,
        last_dt: '',
        last_tests: [],
        total: 0,
        orders: [],
        _orderMap: new Map()
      };
      map.set(key, g);
    }

    const orderKey = String(o.order_id || `${o.patient_id || ''}-${o.order_datetime || ''}`).trim();
    if (!g._orderMap.has(orderKey)) {
      g._orderMap.set(orderKey, {
        ...o,
        tests: [],
        total_price: 0,
        _hasItemPrice: false,
        _totalCandidates: []
      });
    }
    const order = g._orderMap.get(orderKey);
    if (o.test_name && !order.tests.includes(o.test_name)) order.tests.push(o.test_name);
    const price = Number(o.price);
    if (Number.isFinite(price) && price > 0) {
      order.total_price += price;
      order._hasItemPrice = true;
    }
    const totalPrice = Number(o.total_price);
    if (Number.isFinite(totalPrice) && totalPrice > 0) order._totalCandidates.push(totalPrice);
    if ((o.order_datetime || '') > (order.order_datetime || '')) order.order_datetime = o.order_datetime;
  }

  for (const g of map.values()) {
    g.orders = [...g._orderMap.values()].map(order => ({
      ...order,
      test_name: order.tests.filter(Boolean).join(', '),
      total_price: order._hasItemPrice
        ? order.total_price
        : Math.max(0, ...(order._totalCandidates || [0]), Number(order.total_price) || 0)
    })).sort((a, b) => (b.order_datetime || '').localeCompare(a.order_datetime || ''));
    delete g._orderMap;
    g.visits = g.orders.length;
    g.results_ready = g.orders.filter(o => o.status === 'Completed').length;
    g.total = g.orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);
    const latest = g.orders[0];
    g.last_dt = latest?.order_datetime || '';
    g.last_tests = latest?.test_name ? latest.test_name.split(',').map(x => x.trim()) : [];
  }
  return [...map.values()].sort((a, b) => (b.last_dt || '').localeCompare(a.last_dt || ''));
}

window.loadPatientHistoryPage = async function(force = false) {
  if (!force && state.historyCache.length) {
    renderPatientHistoryTable(state.historyCache);
    return;
  }
  state.historyCache = await buildPatientHistory();
  // Update KPI cards
  if ($('patientHistoryTotalPatients')) $('patientHistoryTotalPatients').textContent = state.historyCache.length;
  if ($('patientHistoryTotalVisits'))   $('patientHistoryTotalVisits').textContent   = state.historyCache.reduce((s,g) => s+g.visits, 0);
  if ($('patientHistoryResultsReady'))  $('patientHistoryResultsReady').textContent  = state.historyCache.reduce((s,g) => s+g.results_ready, 0);
  renderPatientHistoryTable(state.historyCache);
};

function renderPatientHistoryTable(rows) {
  const body = $('patientHistoryTableBody'); if (!body) return;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມູນ</td></tr>';
    return;
  }
  body.innerHTML = rows.map(g => `
    <tr>
      <td class="fw-semibold text-primary">${esc(g.patient_id || '-')}</td>
      <td>${esc(g.title || '-')}</td>
      <td>${esc(g.patient_name || '-')}</td>
      <td class="text-center">${esc(g.age ?? '-')}</td>
      <td>${esc(g.village || '-')}</td>
      <td>${esc(g.phone || '-')}</td>
      <td class="text-center">${g.visits}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-primary" onclick="openPatientVisitDetail('${esc(g.patient_id)}')">
          <i class="bi bi-eye"></i> ເບິ່ງ
        </button>
      </td>
    </tr>`).join('');
}

window.filterPatientHistory = function() {
  const q = ($('patientHistorySearch')?.value || '').toLowerCase().trim();
  if (!q) return renderPatientHistoryTable(state.historyCache);
  renderPatientHistoryTable(state.historyCache.filter(g =>
    (g.patient_id || '').toLowerCase().includes(q) ||
    (g.patient_name || '').toLowerCase().includes(q) ||
    (g.title || '').toLowerCase().includes(q) ||
    (g.village || '').toLowerCase().includes(q) ||
    (g.phone || '').toLowerCase().includes(q)));
};

window.openPatientVisitDetail = function(patient_id) {
  const g = state.historyCache.find(x => x.patient_id === patient_id);
  if (!g) return;
  $('patientHistoryMasterSection').classList.add('d-none');
  const card = $('patientVisitHistoryCard'); if (!card) return;
  card.classList.remove('d-none');
  if ($('patientVisitHistoryName')) $('patientVisitHistoryName').textContent = `${g.patient_name}  (${g.patient_id || '-'})`;
  if ($('patientVisitHistoryMeta')) $('patientVisitHistoryMeta').textContent =
    `ມາກວດລວມ ${g.visits} ຄັ້ງ`;
  if ($('patientVisitHistoryCount')) $('patientVisitHistoryCount').textContent = `${g.visits} ຄັ້ງ`;

  const body = $('patientVisitHistoryTableBody'); if (!body) return;
  body.innerHTML = g.orders.map(o => `
    <tr>
      <td class="small">${o.order_datetime ? new Date(o.order_datetime).toLocaleString() : '-'}</td>
      <td><b>${esc(o.order_id)}</b></td>
      <td>${esc(o.test_name || '-')}</td>
      <td class="text-center">${esc(o.test_type || '-')}</td>
      <td>${esc(o.lab_dest || '-')}</td>
      <td class="text-center">${statusBadge(o.status)}</td>
      <td class="text-end">₭ ${Number(o.total_price || 0).toLocaleString()}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary" onclick="viewOrderDetail('${esc(o.order_id)}')" title="ເບິ່ງລາຍການ"><i class="bi bi-eye-fill"></i></button>
        <button class="btn btn-sm btn-outline-success" onclick="uploadOrderResult('${esc(o.order_id)}')" title="ໄຟລ໌ຜົນກວດເກົ່າ"><i class="bi bi-cloud-arrow-down-fill"></i></button>
      </td>
    </tr>`).join('');
};

window.openPatientHistoryByHN = function(hn) {
  // Switch to history page then open detail
  if (typeof window.showPage === 'function') {
    window.showPage(null, 'patientHistoryPage');
    setTimeout(() => window.openPatientVisitDetail(hn), 60);
  }
};

window.closePatientHistoryDetail = function() {
  $('patientVisitHistoryCard')?.classList.add('d-none');
  $('patientHistoryMasterSection')?.classList.remove('d-none');
};

function statusBadge(s) {
  const v = String(s || 'Pending');
  const c = v === 'Completed' ? 'success' : v === 'Cancelled' ? 'danger' : v === 'Received' ? 'info' : 'secondary';
  return `<span class="badge bg-${c}">${esc(v)}</span>`;
}

document.addEventListener('DOMContentLoaded', () => {
  ensurePatientDatalist();
  refreshPatientOptions().catch(e => console.warn('[patients] initial options failed', e));
});

console.log('[patients.js] loaded');
