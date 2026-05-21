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
  historyCache: [],
  historyFiltered: [],
  acSelectedIndex: -1,
  acResults: [],
  acDebounceTimer: null,
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

function orderDateValue(order) {
  return Date.parse(order?.order_datetime || order?.created_at || '') || 0;
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

/* ============================================================
 * PATIENT AUTOCOMPLETE DROPDOWN (Order page)
 * Optimized: priority search, column select, cache, abort, virtualize
 * ============================================================ */
const AC_MIN_CHARS = 2;
const AC_DEBOUNCE_MS = 300;
const AC_LIMIT = 20;
const AC_VISIBLE_LIMIT = 10;
const AC_CACHE_TTL = 5 * 60 * 1000;
const AC_SPINNER_THRESHOLD = 150;
const AC_SELECT_COLUMNS = 'Patient_ID,First_Name,Last_Name,Gender,Age,Phone_Number';

const acCache = new Map();
let acAbortController = null;
let acSpinnerTimer = null;
let acDropdownHover = false;
let acVisible = false;

window.currentACRows = [];

function getACDropdown() {
  return $('patientAutocompleteDropdown');
}

function positionACDropdown() {
  const dd = getACDropdown();
  const input = $('patientId');
  if (!dd || !input) return;
  if (dd.parentElement !== document.body) document.body.appendChild(dd);
  const r = input.getBoundingClientRect();
  dd.style.setProperty('position', 'fixed', 'important');
  dd.style.setProperty('top', `${r.bottom + 4}px`, 'important');
  dd.style.setProperty('left', `${r.left}px`, 'important');
  dd.style.setProperty('right', 'auto', 'important');
  dd.style.setProperty('width', `${r.width + 180}px`, 'important');
  dd.style.setProperty('z-index', '999999', 'important');
  dd.style.setProperty('margin-top', '0', 'important');
}

function showACDropdown() {
  const dd = getACDropdown();
  if (dd) {
    acVisible = true;
    positionACDropdown();
    dd.style.display = 'block';
    dd.style.visibility = 'visible';
    dd.style.opacity = '1';
  }
}

function hideACDropdown() {
  const dd = getACDropdown();
  acVisible = false;
  if (dd) {
    dd.style.display = 'none';
    dd.innerHTML = '';
  }
  state.acSelectedIndex = -1;
  window.currentACRows = [];
  if (acSpinnerTimer) { clearTimeout(acSpinnerTimer); acSpinnerTimer = null; }
}

function showSpinner() {
  const dd = getACDropdown();
  if (dd) dd.innerHTML = '<div class="px-3 py-2 text-muted small"><div class="spinner-border spinner-border-sm me-1"></div>ກລັງຄົ້ນຫາ...</div>';
  showACDropdown();
}

function selectPatient(patient) {
  console.log('[AC] selected patient:', patient);
  if (!patient) return;

  console.log('[AC] filling form for:', patient.hn, patient.name);

  const pid = $('patientId');
  const pname = $('patientName');
  const page = $('age');
  const pgender = $('gender');

  if (pid) pid.value = patient.hn || '';
  if (pname) pname.value = patient.name || '';
  if (page) page.value = patient.age ?? '';
  if (pgender && patient.gender) pgender.value = patient.gender;

  console.log('[AC] form filled - ID:', pid?.value, 'Name:', pname?.value, 'Age:', page?.value, 'Gender:', pgender?.value);
}

window._acHighlight = function(index) {
  state.acSelectedIndex = index;
  const dd = getACDropdown();
  if (!dd) return;
  dd.querySelectorAll('.ac-item').forEach((el, i) => {
    el.classList.toggle('bg-primary-subtle', i === index);
  });
};

window._acSelect = function(index) {
  console.log('[AC] _acSelect called with index:', index);
  const p = window.currentACRows[index];
  if (!p) {
    console.warn('[AC] no patient at index', index);
    return;
  }
  selectPatient(p);
  hideACDropdown();
};

function renderACDropdown(rows) {
  const dd = getACDropdown();
  console.log('[AC] renderACDropdown: dropdown exists:', !!dd, 'rows:', rows.length);
  if (!dd) return;
  if (dd.parentElement !== document.body) document.body.appendChild(dd);
  positionACDropdown();

  window.currentACRows = rows;
  state.acResults = rows;
  state.acSelectedIndex = -1;

  if (!rows.length) {
    dd.innerHTML = '<div class="px-3 py-2 text-muted small">ບໍ່ພົບຄົນເຈັບ</div>';
    showACDropdown();
    console.log('[AC] rendered no results');
    return;
  }

  const visible = rows.slice(0, AC_VISIBLE_LIMIT);
  const total = rows.length;

  const fragment = document.createDocumentFragment();
  const temp = document.createElement('div');
  temp.innerHTML = visible.map((p, i) => `
    <div class="ac-item px-3 py-2 small border-bottom" data-index="${i}" style="cursor:pointer" onmouseenter="window._acHighlight(${i})" onpointerdown="event.preventDefault(); window._acSelect(${i})">
      <div class="d-flex justify-content-between">
        <b class="text-primary">${esc(p.hn)}</b>
        <small class="text-muted">${esc(p.gender || '')} ${p.age ?? ''}</small>
      </div>
      <div class="text-truncate">${esc(p.name)}${p.phone ? ' · ' + esc(p.phone) : ''}</div>
    </div>
  `).join('');
  while (temp.firstChild) fragment.appendChild(temp.firstChild);

  dd.innerHTML = '';
  dd.appendChild(fragment);

  if (total > AC_VISIBLE_LIMIT) {
    const more = document.createElement('div');
    more.className = 'px-3 py-1 text-muted small text-center fst-italic';
    more.textContent = `... ລະ ອີກ ${total - AC_VISIBLE_LIMIT} ລາຍການ`;
    dd.appendChild(more);
  }

  showACDropdown();
  console.log('[AC] dropdown rendered, display:', dd.style.display, 'visibility:', dd.style.visibility);
};

function buildPriorityFilter(q) {
  const s = encodeURIComponent(q.trim());
  return `or=(Patient_ID.ilike.%${s}%,First_Name.ilike.%${s}%,Last_Name.ilike.%${s}%,Phone_Number.ilike.%${s}%)`;
}

async function searchPatientsAC(query) {
  const q = (query || '').trim();
  console.log('[AC] searchPatientsAC called, query:', q, 'length:', q.length);
  if (q.length < AC_MIN_CHARS) { console.log('[AC] query too short'); return; }

  const cacheKey = q.toLowerCase();
  const cached = acCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    console.log('[AC] cache hit, results:', cached.data.length);
    renderACDropdown(cached.data);
    return;
  }

  if (acAbortController) acAbortController.abort();
  acAbortController = new AbortController();
  const signal = acAbortController.signal;

  acSpinnerTimer = setTimeout(() => {
    if (!signal.aborted) showSpinner();
  }, AC_SPINNER_THRESHOLD);

  const filter = buildPriorityFilter(q);
  console.log('[AC] sending API request, filter:', filter);

  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: HIS_PATIENT_TABLE,
        select: AC_SELECT_COLUMNS,
        filter,
        order: 'Patient_ID.asc',
        limit: AC_LIMIT
      }),
      signal
    });

    if (signal.aborted) { console.log('[AC] request aborted'); return; }
    if (acSpinnerTimer) { clearTimeout(acSpinnerTimer); acSpinnerTimer = null; }

    console.log('[AC] response status:', res.status);

    if (!res.ok) {
      console.warn('[AC] API error:', res.status);
      if (query === q) {
        const dd = getACDropdown();
        if (dd) dd.innerHTML = '<div class="px-3 py-2 text-danger small">ຄົ້ນຫາລົ້ມເຫຼວ</div>';
        showACDropdown();
      }
      return;
    }

    const json = await res.json();
    if (signal.aborted) { console.log('[AC] aborted after response'); return; }
    if (query !== q) { console.log('[AC] query changed, discarding'); return; }

    const rawData = Array.isArray(json.data) ? json.data : [];
    console.log('[AC] raw rows:', rawData.length);
    console.log('[AC] raw row data:', rawData);

    const rows = rawData.map(normalizePatientRow).filter(Boolean);
    console.log('[AC] normalized rows:', rows.length);
    console.log('[AC] rows:', rows);
    if (rows.length) console.log('[AC] first result:', rows[0]);

    // Auto-select if exact HN match found
    const exactMatch = rows.find(r => String(r.hn || '').toLowerCase() === q.toLowerCase());
    if (exactMatch) {
      console.log('[AC] auto exact match found:', exactMatch.hn);
      selectPatient(exactMatch);
      hideACDropdown();
      return;
    }

    acCache.set(cacheKey, { data: rows, expires: Date.now() + AC_CACHE_TTL });
    if (acCache.size > 20) {
      const firstKey = acCache.keys().next().value;
      acCache.delete(firstKey);
    }

    console.log('[AC] calling renderACDropdown');
    renderACDropdown(rows);
  } catch (e) {
    if (e.name === 'AbortError') { console.log('[AC] abort error'); return; }
    if (acSpinnerTimer) { clearTimeout(acSpinnerTimer); acSpinnerTimer = null; }
    console.error('[AC] search failed:', e);
    if (query === q) {
      const dd = getACDropdown();
      if (dd) dd.innerHTML = '<div class="px-3 py-2 text-danger small">ຄົ້ນຫາລົ້ມເຫຼວ</div>';
      showACDropdown();
    }
  }
}

function initPatientAutocomplete() {
  const input = $('patientId');
  const dd = getACDropdown();
  console.log('[AC] initPatientAutocomplete: input exists:', !!input, 'dropdown exists:', !!dd);
  if (!input) {
    console.warn('[AC] patientId input not found, will retry on DOMContentLoaded');
    return;
  }

  if (dd) {
    dd.addEventListener('mouseenter', () => { acDropdownHover = true; });
    dd.addEventListener('mouseleave', () => { acDropdownHover = false; });
  }

  input.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    console.log('[AC] input event, value:', q);
    if (state.acDebounceTimer) clearTimeout(state.acDebounceTimer);
    if (q.length < AC_MIN_CHARS) { console.log('[AC] too short'); return; }
    console.log('[AC] scheduling debounce');
    state.acDebounceTimer = setTimeout(() => searchPatientsAC(q), AC_DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (e) => {
    const dd = getACDropdown();
    if (!dd || dd.style.display === 'none') return;
    const len = window.currentACRows.length;
    console.log('[AC] keydown:', e.key, 'selectedIndex:', state.acSelectedIndex, 'len:', len);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.acSelectedIndex = state.acSelectedIndex < len - 1 ? state.acSelectedIndex + 1 : 0;
      dd.querySelectorAll('.ac-item').forEach((el, i) => el.classList.toggle('bg-primary-subtle', i === state.acSelectedIndex));
      dd.querySelectorAll('.ac-item')[state.acSelectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.acSelectedIndex = state.acSelectedIndex > 0 ? state.acSelectedIndex - 1 : len - 1;
      dd.querySelectorAll('.ac-item').forEach((el, i) => el.classList.toggle('bg-primary-subtle', i === state.acSelectedIndex));
      dd.querySelectorAll('.ac-item')[state.acSelectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (state.acSelectedIndex >= 0 && state.acSelectedIndex < len) {
        console.log('[AC] Enter selecting index:', state.acSelectedIndex);
        window._acSelect(state.acSelectedIndex);
      } else if (len === 1) {
        console.log('[AC] Enter selecting only result');
        window._acSelect(0);
      }
    }
  });

  input.addEventListener('blur', (e) => {
    setTimeout(() => {
      if (!acDropdownHover) hideACDropdown();
    }, 250);
  });

  input.addEventListener('focus', (e) => {
    const q = e.target.value.trim();
    if (q.length >= AC_MIN_CHARS) searchPatientsAC(q);
  });

  document.addEventListener('pointerdown', (e) => {
    const dd = getACDropdown();
    if (e.target === input || dd?.contains(e.target)) return;
    hideACDropdown();
  });

  window.addEventListener('scroll', () => {
    const dd = getACDropdown();
    if (dd && acVisible) positionACDropdown();
  }, true);
  window.addEventListener('resize', () => {
    const dd = getACDropdown();
    if (dd && acVisible) positionACDropdown();
  });

  console.log('[AC] initPatientAutocomplete done');
}

/* ============================================================
 * INIT — runs immediately if DOM ready, otherwise on DOMContentLoaded
 * ============================================================ */
function initAll() {
  console.log('[patients] initAll called');
  initPatientAutocomplete();
  initPickerSearchDebounce();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  console.log('[patients] DOM already ready, initializing immediately');
  initAll();
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
});

document.addEventListener('input', (e) => {
  if (e.target?.id === 'pHn') {
    fillPatientFields('modal', findPatientByHN(e.target.value));
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
  $('patientPickerResults').innerHTML = '<div class="text-muted text-center py-3 small">ພິມ 2+ ຕົວອັກສອນເພື່ອຄົ້ນຫາ HN / ຊື່ / ເບີໂທ ຫຼື ກົດ "ໃໝ່"</div>';
  showModal('patientPickerModal');
  setTimeout(() => $('patientPickerSearch')?.focus(), 300);
};

let pickerAbortController = null;

window.searchPatientPicker = async function() {
  const q = ($('patientPickerSearch').value || '').trim();
  if (q.length < AC_MIN_CHARS) {
    $('patientPickerResults').innerHTML = '<div class="text-muted text-center py-3 small">ພິມຢ່າງໜ້ອຍ 2 ຕົວອັກສອນ</div>';
    return;
  }

  if (pickerAbortController) pickerAbortController.abort();
  pickerAbortController = new AbortController();
  const signal = pickerAbortController.signal;

  $('patientPickerResults').innerHTML = '<div class="text-center py-3 small"><div class="spinner-border spinner-border-sm"></div></div>';

  try {
    const filter = buildPriorityFilter(q);
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: HIS_PATIENT_TABLE,
        select: AC_SELECT_COLUMNS,
        filter,
        order: 'Patient_ID.asc',
        limit: 20
      }),
      signal
    });

    if (signal.aborted) return;

    if (!res.ok) {
      $('patientPickerResults').innerHTML = '<div class="text-danger text-center py-3 small">ຄົ້ນຫາລົ້ມເຫຼວ</div>';
      return;
    }

    const json = await res.json();
    if (signal.aborted) return;

    const rows = (Array.isArray(json.data) ? json.data : [])
      .map(normalizePatientRow)
      .filter(Boolean);

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
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.warn('[patients] picker search failed:', e);
    $('patientPickerResults').innerHTML = '<div class="text-danger text-center py-3 small">ຄົ້ນຫາລົ້ມເຫຼວ</div>';
  }
};
window._pickPatient = function(p) {
  if (state.pickerCallback) state.pickerCallback(p);
  state.pickerCallback = null;
  hideModal('patientPickerModal');
};
window.createPatientFromPicker = async function() {
  await window.openPatientModal(null);
};

function initPickerSearchDebounce() {
  const input = $('patientPickerSearch');
  if (!input) return;
  let timer = null;
  input.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => window.searchPatientPicker(), AC_DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); window.searchPatientPicker(); }
  });
}

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
    })).sort((a, b) => orderDateValue(b) - orderDateValue(a));
    delete g._orderMap;
    g.visits = g.orders.length;
    g.results_ready = g.orders.filter(o => o.status === 'Completed').length;
    g.total = g.orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);
    const latest = g.orders[0];
    g.last_dt = latest?.order_datetime || latest?.created_at || '';
    g.last_tests = latest?.test_name ? latest.test_name.split(',').map(x => x.trim()) : [];
  }
  return [...map.values()].sort((a, b) => orderDateValue({ order_datetime: b.last_dt }) - orderDateValue({ order_datetime: a.last_dt }));
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
    body.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">ບໍ່ມີຂໍ້ມນ</td></tr>';
    return;
  }
  body.innerHTML = rows.map(g => {
    const lastDate = g.last_dt ? new Date(g.last_dt) : null;
    const dateStr = lastDate && !isNaN(lastDate.getTime())
      ? lastDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-';
    return `
    <tr>
      <td class="fw-semibold text-primary">${esc(g.patient_id || '-')}</td>
      <td>${esc(g.title || '-')}</td>
      <td>${esc(g.patient_name || '-')}</td>
      <td class="text-center">${esc(g.age ?? '-')}</td>
      <td>${esc(g.village || '-')}</td>
      <td>${esc(g.phone || '-')}</td>
      <td class="text-center">${g.visits}</td>
      <td class="text-center text-muted small">${dateStr}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-primary" onclick="openPatientVisitDetail('${esc(g.patient_id)}')">
          <i class="bi bi-eye"></i> ບິ່ງ
        </button>
      </td>
    </tr>`;
  }).join('');
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

window.openPatientVisitDetail = async function(patient_id) {
  const g = state.historyCache.find(x => x.patient_id === patient_id);
  if (!g) return;

  const titleEl = $('patientVisitModalTitle');
  const metaEl = $('patientVisitModalMeta');
  const bodyEl = $('patientVisitModalBody');
  if (!bodyEl) return;

  if (titleEl) titleEl.textContent = `${g.patient_name} (${g.patient_id || '-'})`;
  if (metaEl) metaEl.textContent = `ປະຫວັດ ແລະ ົນກວດແຕ່ລະຄັ້ງ — ${g.visits} ຄັ້ງ`;

  bodyEl.innerHTML = '<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>ກຳລັງໂຫຼດຂໍ້ມູນ...</div>';

  try {
    const fileCounts = {};
    await Promise.all(g.orders.map(async o => {
      try {
        const res = await api.getOrderFiles(o.order_id);
        fileCounts[o.order_id] = res.success ? (res.data || []).length : 0;
      } catch { fileCounts[o.order_id] = 0; }
    }));

    if (!g.orders.length) {
      bodyEl.innerHTML = '<div class="text-center text-muted py-4">ບໍ່ມີປະຫວັດການກວດ</div>';
    } else {
      bodyEl.innerHTML = `<div class="position-relative ps-3" style="border-left:2px solid #e9ecef">${g.orders.map((o, idx) => {
        const dt = o.order_datetime ? new Date(o.order_datetime).toLocaleString() : '-';
        const tests = (o.test_name || '-').split(',').map(t => t.trim()).filter(Boolean);
        const testBadges = tests.map(t => `<span class="badge bg-light text-dark border me-1 mb-1" style="font-size:0.7rem">${esc(t)}</span>`).join('');
        const fileCount = fileCounts[o.order_id] || 0;
        const isCompleted = String(o.status || '').toLowerCase() === 'completed';
        const uid = `visit-result-${idx}`;
        return `
        <div class="position-relative mb-4 pe-3">
          <div class="position-absolute start-0 translate-middle-x" style="left:-20px;top:12px;width:12px;height:12px;border-radius:50%;background:${isCompleted ? '#198754' : '#6c757d'};border:2px solid #fff"></div>
          <div class="card border shadow-sm">
            <div class="card-body p-3">
              <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <div class="fw-bold text-primary small"><i class="bi bi-receipt me-1"></i>${esc(o.order_id)}</div>
                  <div class="text-muted small"><i class="bi bi-calendar3 me-1"></i>${dt}</div>
                </div>
                <div class="text-end">
                  <div class="fw-bold text-danger small">₭ ${Number(o.total_price || 0).toLocaleString()}</div>
                  <div class="mt-1">${statusBadge(o.status)}</div>
                </div>
              </div>
              <div class="d-flex flex-wrap gap-2 mb-2 small">
                <span class="text-muted"><i class="bi bi-tag me-1"></i>${esc(o.visit_type || '-')}</span>
                <span class="text-muted"><i class="bi bi-geo-alt me-1"></i>${esc(o.lab_dest || '-')}</span>
              </div>
              <div class="mb-2">${testBadges || '<span class="text-muted small">ບໍ່ມີລາຍການ</span>'}</div>
              <div class="d-flex flex-wrap gap-2 mb-2 align-items-center small">
                <span class="text-muted"><i class="bi bi-file-earmark-medical me-1"></i>ຜົນກວດ: ${isCompleted ? '<span class="text-success fw-bold">ສຳເລັດ</span>' : '<span class="text-warning">ລໍຖ້າ</span>'}</span>
                <span class="text-muted"><i class="bi bi-paperclip me-1"></i>ໄຟລ໌: ${fileCount > 0 ? `<span class="text-primary fw-bold">${fileCount} ໄຟລ໌</span>` : '<span class="text-muted">ບໍ່ມີ</span>'}</span>
              </div>
              <div class="d-flex gap-2 mb-2">
                <button class="btn btn-sm btn-outline-primary" onclick="viewOrderDetail('${esc(o.order_id)}')" title="ເບິ່ງລາຍການ"><i class="bi bi-eye-fill me-1"></i>ເບິ່ງ</button>
                <button class="btn btn-sm btn-outline-success" onclick="uploadOrderResult('${esc(o.order_id)}')" title="ອັບໂຫຼດຜົນກວດ"><i class="bi bi-cloud-arrow-up-fill me-1"></i>ອັບໂຫຼດ</button>
              </div>
              <div class="collapse" id="${uid}">
                <div class="border-top pt-2 mt-2">
                  <div class="small text-muted mb-1"><i class="bi bi-list-check me-1"></i>ລາຍການກວດທັງໝົດ:</div>
                  <div class="d-flex flex-wrap gap-1">${testBadges}</div>
                  ${fileCount > 0 ? `<div class="small text-muted mt-2"><i class="bi bi-paperclip me-1"></i>ມີໄຟລ໌ຜົນກວດ ${fileCount} ໄຟລ໌ — ກົດ "ເບິ່ງ" ເພື່ອເບິ່ງລາຍລະອຽດ</div>` : ''}
                </div>
              </div>
              <button class="btn btn-sm btn-link text-decoration-none p-0 small" type="button" data-bs-toggle="collapse" data-bs-target="#${uid}" aria-expanded="false">
                <i class="bi bi-chevron-down"></i> ເບິ່ງເພີ່ມເຕີມ
              </button>
            </div>
          </div>
        </div>`;
      }).join('')}</div>`;
    }
  } catch (err) {
    console.error('[patients] openPatientVisitDetail error:', err);
    bodyEl.innerHTML = '<div class="text-center text-danger py-4">ເກີດຂໍ້ຜິດພາດໃນການໂຫຼດຂໍ້ມູນ</div>';
  }

  if (window.bootstrap?.Modal) {
    bootstrap.Modal.getOrCreateInstance($('patientVisitModal')).show();
  }
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

console.log('[patients.js] loaded');
