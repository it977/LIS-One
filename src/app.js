// ==========================================
// MAIN APP - LIS Test By No V2
// ດັດແປງຈາກ GAS ມາໃຊ້ Supabase
// ==========================================
import * as api from './api.js'

// ================== GLOBAL STATE ==================
let cartItems = []
let finalTotal = 0
let currentEditOrderId = null
let globalOrders = []
let myCharts = {}
let globalStockList = []
let globalSummaryData = []
let globalInventoryData = []
let globalStockHistory = []
let reagentModalInstance, invEditModalInstance, stockEditModalInstance, addLotModalInstance, resultModalInstance

// ================== CHART.JS SETUP ==================
Chart.register(ChartDataLabels)

// Set global Chart.js font defaults to Noto Sans Lao
Chart.defaults.font.family = "'Noto Sans Lao', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
Chart.defaults.font.size = 11

Chart.defaults.set('plugins.datalabels', {
  color: '#fff',
  font: { 
    weight: 'bold',
    size: 11,
    family: "'Noto Sans Lao', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  formatter: function(v) { return v > 0 ? v : '' }
})

// ================== DATATABLE HELPER ==================
function initDT(tableId, scrollHeight = '480px') {
  // ທຳລາຍ DataTable ເກົ່າຖ້າມີ
  const table = $('#' + tableId)
  if (table.length > 0 && $.fn.DataTable.isDataTable(table)) {
    table.DataTable().destroy(true) // true = remove event handlers
  }
  
  // ສ້າງ DataTable ໃໝ່
  table.DataTable({
    scrollY: scrollHeight, scrollCollapse: true, scrollX: true, pageLength: 15, order: [],
    language: { search: "ຄົ້ນຫາ:", lengthMenu: "ສະແດງ _MENU_ ລາຍການ", info: "ສະແດງ _START_ ຫາ _END_ ຈາກ _TOTAL_ ລາຍການ", paginate: { previous: "ກັບຄືນ", next: "ຕໍ່ໄປ" }, emptyTable: "ບໍ່ມີຂໍ້ມູນ", zeroRecords: "ບໍ່ພົບຂໍ້ມູນ" }
  })
}

// ================== SIDEBAR ==================
window.toggleSidebar = function() {
  const sb = document.getElementById('sidebar')
  const ov = document.getElementById('sidebarOverlay')
  if (window.innerWidth <= 768) { sb.classList.toggle('mobile-open'); ov.classList.toggle('active') }
  else { sb.classList.toggle('collapsed') }
}

// ================== INIT ==================
window.onload = function() {
  setInterval(() => { if (document.getElementById('dashboard').classList.contains('active')) { setDashDate('today') } }, 600000) // 10 minutes
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = '')
  setDefaultDates()
  document.getElementById('invReceiveDate').value = new Date().toISOString().split('T')[0]
  document.getElementById('maintDate').value = new Date().toISOString().split('T')[0]
  checkLogin()
}

function setDefaultDates() {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const tStr = today.toISOString().split('T')[0]
  const fStr = firstDay.toISOString().split('T')[0]
  document.getElementById('dashEndDate').value = tStr
  document.getElementById('dashStartDate').value = fStr
}

window.setDashDate = function(type) { const dates = calculateDateRange(type); document.getElementById('dashStartDate').value = dates.start; document.getElementById('dashEndDate').value = dates.end; loadDashboard() }
window.setReportDate = function(type) { const dates = calculateDateRange(type); document.getElementById('repStartDate').value = dates.start; document.getElementById('repEndDate').value = dates.end; loadSummaryReport() }

function calculateDateRange(type) {
  const today = new Date(); let start = new Date()
  if (type === 'week') { const day = start.getDay() || 7; start.setDate(start.getDate() - (day - 1)) }
  else if (type === 'month') { start.setDate(1) }
  else if (type === 'year') { start.setMonth(0, 1) }
  const fmt = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  return { start: fmt(start), end: fmt(today) }
}

// ================== AUTH ==================
function checkLogin() {
  const userRole = sessionStorage.getItem('lis_role')
  if (userRole) {
    document.getElementById('loginScreen').style.display = 'none'
    document.getElementById('mainApp').style.display = 'flex'
    document.getElementById('displayRole').innerText = sessionStorage.getItem('lis_username') + ' (' + userRole + ')'
    if (userRole !== 'Admin') { document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none') }
    resetForm(); loadSettings(); loadTestCheckboxes(); loadTable(); loadTestMasterTable()
    loadOutlabTable(); loadStockData(); loadInventoryTable(); loadMaintenanceTable()
    loadSummaryReport(); loadMappingData(); loadParamSetupData(); loadPackagesTable()
    // loadPatientAutocomplete() - ປິດແລ້ວ ໃຊ້ debounce ແທນ
    if (userRole === 'Admin') { showPage(null, 'dashboard') } else { showPage(null, 'orderForm') }
  } else {
    document.getElementById('loginScreen').style.display = 'flex'
    document.getElementById('mainApp').style.display = 'none'
  }
}

window.performLogin = async function() {
  const u = document.getElementById('loginUser').value.trim()
  const p = document.getElementById('loginPass').value.trim()
  if (!u || !p) { Swal.fire({ icon: 'warning', title: 'ແຈ້ງເຕືອນ', text: 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ!' }); return }
  const btn = document.getElementById('btnLogin')
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ກຳລັງກວດສອບ...'; btn.disabled = true
  const res = await api.loginUser(u, p)
  if (res.success) {
    sessionStorage.setItem('lis_role', res.role); sessionStorage.setItem('lis_username', res.username)
    Swal.fire({ icon: 'success', title: 'ສຳເລັດ', text: 'ຍິນດີຕ້ອນຮັບ!', timer: 800, showConfirmButton: false })
    setTimeout(() => { checkLogin() }, 800)
  } else {
    Swal.fire({ icon: 'error', title: 'ຜິດພາດ', text: res.message })
    btn.innerHTML = 'ເຂົ້າສູ່ລະບົບ (Login)'; btn.disabled = false
  }
}

window.performLogout = function() {
  Swal.fire({ title: 'ອອກຈາກລະບົບ?', icon: 'question', showCancelButton: true, confirmButtonText: 'ຢືນຢັນ', cancelButtonText: 'ຍົກເລີກ' })
    .then(async result => {
      if (result.isConfirmed) {
        await api.logActivityFrontend(sessionStorage.getItem('lis_username'), 'Logout', 'System', '')
        sessionStorage.clear()
        document.getElementById('mainApp').style.display = 'none'
        document.getElementById('loginScreen').style.display = 'flex'
        document.getElementById('loginUser').value = ''; document.getElementById('loginPass').value = ''
        document.getElementById('btnLogin').innerHTML = 'ເຂົ້າສູ່ລະບົບ (Login)'; document.getElementById('btnLogin').disabled = false
      }
    })
}

// ================== PAGE ROUTING ==================
window.showPage = function(event, pageId) {
  if (event) event.preventDefault()
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'))
  document.getElementById(pageId).classList.add('active')
  if (event && event.currentTarget) event.currentTarget.classList.add('active')
  else { const links = document.querySelectorAll(`.sidebar a[onclick*="${pageId}"]`); if (links.length > 0) links[0].classList.add('active') }
  if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('mobile-open'); document.getElementById('sidebarOverlay').classList.remove('active') }
  setTimeout(() => { $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust() }, 200)
}

// ================== PATIENT SEARCH ==================
// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID - Global function
window.searchPatient = async function(patientId) {
  console.log('🔍 searchPatient called with:', patientId)
  
  if (!patientId || patientId.length < 2) {
    console.log('⚠️ Patient ID too short')
    return
  }

  try {
    console.log('📡 Calling searchPatientById...')
    const patient = await api.searchPatientById(patientId)

    if (patient) {
      console.log('✅ Patient found:', patient)
      // ພົບຂໍ້ມູນ - ກຣອກຂໍ້ມູນລົງໃນຟອມ
      const nameEl = document.getElementById('patientName')
      const ageEl = document.getElementById('age')
      const genderEl = document.getElementById('gender')
      
      if (nameEl) nameEl.value = patient.fullName
      if (ageEl) ageEl.value = patient.age
      if (genderEl) genderEl.value = patient.gender || 'Male'
      
      console.log('✅ Form filled:', {
        name: patient.fullName,
        age: patient.age,
        gender: patient.gender
      })
    } else {
      console.log('⚠️ No patient found')
    }
    
    // ໂຫຼດ autocomplete suggestions
    console.log('📋 Loading autocomplete suggestions...')
    const suggestions = await api.getAllPatients(patientId)
    console.log('💡 Suggestions:', suggestions)
    
    const datalist = document.getElementById('patientList')
    if (datalist && suggestions.length > 0) {
      datalist.innerHTML = suggestions.map(p =>
        `<option value="${p.patientId}" data-name="${p.fullName}">`
      ).join('')
      console.log('✅ Autocomplete suggestions loaded:', suggestions.length)
    } else {
      datalist.innerHTML = ''
      console.log('⚠️ No autocomplete suggestions')
    }
  } catch (e) {
    console.error('❌ Error searching patient:', e)
  }
}

// ໂຫຼດລາຍຊື່ຄົນເຈັບສຳລັບ autocomplete (ປິດແລ້ວ)
async function loadPatientAutocomplete() {
  // ບໍ່ໂຫຼດລ່ວງໜ້າ ເພື່ອຫຼີກລ່ຽງ error
}

// ເພີ່ມ Event Listener ສຳລັບ Patient ID Input - ເຮັດວຽກແນ່ນອນ
if (typeof window !== 'undefined') {
  window.addEventListener('load', function() {
    console.log('🔧 Window loaded, setting up Patient ID listener...')
    setTimeout(function() {
      const patientInput = document.getElementById('patientId')
      if (patientInput) {
        console.log('✅ Patient ID input found, attaching event listener')
        patientInput.addEventListener('input', function() {
          const value = this.value.trim()
          console.log('📝 Patient ID input changed:', value)
          if (value && value.length >= 2) {
            console.log('🚀 Calling searchPatient...')
            window.searchPatient(value)
          }
        })
        console.log('✅ Event listener attached successfully')
      } else {
        console.error('❌ Patient ID input not found!')
      }
    }, 500)  // ລໍຖ້າ 500ms ໃຫ້ແນ່ໃຈວ່າ DOM ພ້ອມ
  })
}

window.openReagentModal = function() { if (!reagentModalInstance) { reagentModalInstance = new bootstrap.Modal(document.getElementById('reagentMasterModal')) } cancelEditReagent(); reagentModalInstance.show(); setTimeout(() => initDT('reagentMasterTable'), 200) }
window.openAddLotModal = function() { if (!addLotModalInstance) { addLotModalInstance = new bootstrap.Modal(document.getElementById('addLotModal')) } document.getElementById('invReceiveDate').value = new Date().toISOString().split('T')[0]; addLotModalInstance.show() }

// ================== SETTINGS ==================
async function loadSettings() {
  const d = await api.getSettings()
  const pop = (t, sId, lId) => {
    const sel = document.getElementById(sId), lst = document.getElementById(lId)
    if (sel) sel.innerHTML = '<option value="" selected disabled>-- ເລືອກ --</option>'
    if (lst) lst.innerHTML = ''
    if (d[t]) { d[t].forEach(i => { if (sel) sel.innerHTML += `<option value="${i.val}">${i.val}</option>`; if (lst) lst.innerHTML += `<li class="list-group-item d-flex justify-content-between p-1 small bg-transparent">${i.val} <button class="btn btn-sm text-danger py-0" onclick="deleteSetting(${i.row})"><i class="bi bi-x"></i></button></li>` }) }
  }
  pop('VisitType', 'visitType', 'listVisitType'); pop('Insite', 'insite', 'listInsite')
  pop('Doctor', 'doctor', 'listDoctor'); pop('Department', 'department', 'listDepartment')
  pop('Sender', 'sender', 'listSender'); pop('LabDest', 'labDest', 'listLabDest')
  
  // ໂຫຼດຂໍ້ມູນເຂົ້າ Dashboard Filters
  loadDashboardFilters(d)
}

// ໂຫຼດຂໍ້ມູນເຂົ້າ Dashboard Filters
function loadDashboardFilters(settings) {
  // Department
  const deptSel = document.getElementById('dashDepartment')
  if (deptSel && settings.Department) {
    settings.Department.forEach(d => {
      deptSel.innerHTML += `<option value="${d.val}">${d.val}</option>`
    })
  }
  
  // Doctor
  const docSel = document.getElementById('dashDoctor')
  if (docSel && settings.Doctor) {
    settings.Doctor.forEach(d => {
      docSel.innerHTML += `<option value="${d.val}">${d.val}</option>`
    })
  }
}

window.addSetting = async function(t, i) { const v = document.getElementById(i).value; if (!v) return; document.getElementById(i).value = ''; await api.addSetting(t, v); loadSettings() }
window.deleteSetting = function(r) { Swal.fire({ title: 'ລຶບ?', icon: 'warning', showCancelButton: true }).then(async res => { if (res.isConfirmed) { await api.deleteSetting(r); loadSettings() } }) }

// ================== DASHBOARD ==================
window.loadDashboard = async function() {
  const sDate = document.getElementById('dashStartDate').value
  const eDate = document.getElementById('dashEndDate').value
  
  // ດຶງຄ່າຈາກ Filters
  const department = document.getElementById('dashDepartment').value
  const doctor = document.getElementById('dashDoctor').value
  const testType = document.getElementById('dashTestType').value
  const category = document.getElementById('dashCategory').value
  
  document.getElementById('dashContent').style.display = 'none'
  document.getElementById('dashLoader').style.display = 'block'
  
  // ສົ່ງ Filters ໄປ API
  const res = await api.getDashboardData(sDate, eDate, { department, doctor, testType, category })
  
  document.getElementById('dashLoader').style.display = 'none'
  if (res.success) {
    document.getElementById('dashContent').style.display = 'block'
    document.getElementById('kpiPatients').innerText = res.kpis.totalPatients.toLocaleString()
    document.getElementById('kpiRev').innerText = '₭ ' + res.kpis.totalRevenue.toLocaleString()
    document.getElementById('kpiInLab').innerText = '₭ ' + res.kpis.inlabRev.toLocaleString()
    document.getElementById('kpiOutLab').innerText = '₭ ' + res.kpis.outlabRev.toLocaleString()
    
    let alertCount = 0
    if (res.alerts.expired > 0) {
      alertCount += res.alerts.expired
    }
    if (res.alerts.expiringSoon > 0) {
      alertCount += res.alerts.expiringSoon
    }
    
    // ສະແດງ Badge ກໍຕໍ່ເມື່ອມີແຈ້ງເຕືອນ
    const alertBadge = document.getElementById('alertCountBadge')
    if (alertCount > 0) {
      alertBadge.style.display = 'flex'
      alertBadge.innerText = alertCount
    } else {
      alertBadge.style.display = 'none'
    }
    
    setTimeout(() => {
      const safe = (id, type, labels, data, colors, isMoney) => { try { renderChart(id, type, labels, data, colors, isMoney) } catch (e) { console.error('Chart error:', id, e) } }
      safe('chartGender', 'pie', Object.keys(res.charts.gender), Object.values(res.charts.gender), ['#3B82F6', '#EC4899'])
      safe('chartInsite', 'doughnut', Object.keys(res.charts.insite), Object.values(res.charts.insite), ['#0EA5E9', '#F59E0B'])
      safe('chartVisitType', 'pie', Object.keys(res.charts.visitType), Object.values(res.charts.visitType), ['#1E3A8A', '#10B981', '#D97706'])
      safe('chartLabType', 'pie', Object.keys(res.charts.labType), Object.values(res.charts.labType), ['#10B981', '#EF4444'])
      safe('chartTestType', 'doughnut', Object.keys(res.charts.testTypeRev), Object.values(res.charts.testTypeRev), ['#0284C7', '#F59E0B'])
      safe('chartDept', 'bar', Object.keys(res.charts.deptRev), Object.values(res.charts.deptRev), ['#0EA5E9', '#6366F1'], true)
      safe('chartDoctor', 'bar', Object.keys(res.charts.doctors), Object.values(res.charts.doctors), ['#3B82F6'], true)
      try { renderTimeSlotChart(res.charts.timeSlot) } catch (e) { console.error(e) }
      
      // Render Age Groups Chart (calculate from orders data)
      try {
        const ageGroupsData = calculateAgeGroups(res.orders || [])
        renderAgeGroupsChart(ageGroupsData)
      } catch (e) { console.error('Age groups chart error:', e) }
      
      try { renderTopTable('topTestsBody', res.charts.tests); renderTopTable('topCatsBody', res.charts.categories) } catch (e) { console.error(e) }

      // ໂຫຼດ Summary Table
      if (res.summaryData) {
        renderDashboardSummaryTable(res.summaryData)
      }
    }, 150)
  } else {
    document.getElementById('dashContent').style.display = 'block'
    document.getElementById('dashAlerts').innerHTML = `<div class="alert alert-danger"><b>Error:</b> ${res.message}</div>`
  }
}

// ສະແດງ/ຊ່ອນ Summary Table ໃນ Dashboard
window.toggleSummaryTableDashboard = function() {
  const container = document.getElementById('dashboardSummaryTableContainer')
  const btnText = document.getElementById('summaryTableTextDash')
  const btnIcon = document.querySelector('#btnToggleSummaryDash i')
  
  if (container.style.display === 'none') {
    container.style.display = 'block'
    btnText.innerText = 'ຊ່ອນ'
    btnIcon.className = 'bi bi-eye-slash'
  } else {
    container.style.display = 'none'
    btnText.innerText = 'ສະແດງ'
    btnIcon.className = 'bi bi-eye'
  }
}

// ລ້າງ Filters
window.resetDashboardFilters = function() {
  document.getElementById('dashDepartment').value = ''
  document.getElementById('dashDoctor').value = ''
  document.getElementById('dashTestType').value = ''
  document.getElementById('dashCategory').value = ''
  loadDashboard()
}

// ສະແດງ Modal ແຈ້ງເຕືອນນ້ຳຢາ
window.showInventoryAlerts = async function() {
  Swal.fire({
    title: '<i class="bi bi-exclamation-triangle-fill text-warning"></i> ແຈ້ງເຕືອນນ້ຳຢາ',
    html: '<div class="text-start"><p>ກະລຸນາກວດສອບນ້ຳຢາທີ່ໃກ້ໝົດອາຍຸ ຫຼື ໝົດອາຍຸແລ້ວໃນໜ້າ <b>"ສາງນ້ຳຢາ (Inventory)"</b></p></div>',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ໄປເບິ່ງດຽວນີ້',
    cancelButtonText: 'ປິດ',
    confirmButtonColor: '#10B981',
    cancelButtonColor: '#6B7280'
  }).then(result => {
    if (result.isConfirmed) {
      // ໄປໜ້າ Inventory
      showPage(null, 'inventoryPage')
    }
  })
}

// ສະແດງ Summary Table
window.renderDashboardSummaryTable = function(data) {
  const tbody = document.getElementById('dashboardSummaryBody')
  const tfoot = document.getElementById('dashboardSummaryFoot')
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">ບໍ່ມີຂໍ້ມູນ</td></tr>'
    tfoot.innerHTML = ''
    return
  }
  
  let html = ''
  let sumNormal = 0, sumPackage = 0, sumRev = 0

  data.forEach(d => {
    sumNormal += d.normal
    sumPackage += d.package
    sumRev += d.revenue
    const categoryClass = getCategoryBadgeClass(d.category)
    html += `<tr>
      <td><span class="badge ${categoryClass}">${d.category}</span></td>
      <td class="fw-bold text-primary">${d.testName}</td>
      <td class="text-center">${d.normal}</td>
      <td class="text-center">${d.package}</td>
      <td class="text-end price-text">₭ ${d.revenue.toLocaleString()}</td>
    </tr>`
  })

  tbody.innerHTML = html
  tfoot.innerHTML = `<tr class="table-light fw-bold">
    <td colspan="2" class="text-end text-primary">ລວມທັງໝົດ:</td>
    <td class="text-center text-danger">${sumNormal.toLocaleString()}</td>
    <td class="text-center text-danger">${sumPackage.toLocaleString()}</td>
    <td class="text-end text-danger">₭ ${sumRev.toLocaleString()}</td>
  </tr>`
}

// Helper function to get category badge class
function getCategoryBadgeClass(category) {
  if (!category || category.trim() === '') return 'badge-category-default'
  // Normalize category: lowercase, replace spaces with hyphens, remove special chars except /
  const cat = category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\/-]/g, '')
  if (cat === 'default' || cat === 'other') return 'badge-category-default'
  return 'badge-category-' + cat
}

// ລາຍງານ Time Slot ແບບກະແນ່
window.loadTimeSlotReport = function(slotType) {
  // slotType: 'all', 'morning', 'evening', 'night'
  const timeSlotData = myCharts['chartTimeSlot'] ? myCharts['chartTimeSlot'].data : null
  
  if (!timeSlotData) {
    Swal.fire('ແຈ້ງເຕືອນ', 'ຍັງບໍ່ມີຂໍ້ມູນ Time Slot', 'warning')
    return
  }
  
  // ສະແດງຕາຕະລາງ
  renderTimeSlotSummaryTable(timeSlotData, slotType)
}

function renderTimeSlotSummaryTable(timeSlotData, slotType) {
  const tbody = document.getElementById('timeSlotSummaryBody')
  const tfoot = document.getElementById('timeSlotSummaryFoot')
  
  const slotLabels = {
    '08:00-16:00': 'ເຊົ້າ (08:00-16:00)',
    '16:00-21:00': 'ແລງ (16:00-21:00)',
    '21:00-08:00': 'ກະເດີກ (21:00-08:00)'
  }
  
  const slotColors = {
    '08:00-16:00': 'success',
    '16:00-21:00': 'warning',
    '21:00-08:00': 'danger'
  }
  
  let html = ''
  let totalCount = 0, totalRev = 0
  
  const slots = slotType === 'all' 
    ? ['08:00-16:00', '16:00-21:00', '21:00-08:00']
    : slotType === 'morning' ? ['08:00-16:00']
    : slotType === 'evening' ? ['16:00-21:00']
    : ['21:00-08:00']
  
  slots.forEach(slot => {
    const dataset = timeSlotData.datasets.find(d => d.label === 'ຈຳນວນບິນ')
    const revDataset = timeSlotData.datasets.find(d => d.label === 'ລາຍຮັບ (₭)')
    const idx = timeSlotData.labels.indexOf(slot)
    
    if (idx !== -1) {
      const count = dataset.data[idx] || 0
      const rev = revDataset.data[idx] || 0
      const avg = count > 0 ? rev / count : 0
      
      totalCount += count
      totalRev += rev
      
      html += `<tr class="table-${slotColors[slot]}">
        <td><span class="badge bg-${slotColors[slot]}">${slotLabels[slot]}</span></td>
        <td class="text-center fw-bold">${count}</td>
        <td class="text-end">₭ ${rev.toLocaleString()}</td>
        <td class="text-end text-muted">₭ ${avg.toLocaleString()}</td>
      </tr>`
    }
  })
  
  tbody.innerHTML = html
  tfoot.innerHTML = `<tr class="table-light fw-bold">
    <td class="text-end">ລວມທັງໝົດ:</td>
    <td class="text-center text-danger">${totalCount}</td>
    <td class="text-end text-danger">₭ ${totalRev.toLocaleString()}</td>
    <td class="text-end text-muted">-</td>
  </tr>`
}

function renderTopTable(tbodyId, dataObj) {
  const tbody = document.getElementById(tbodyId); if (!tbody) return; tbody.innerHTML = ''
  const arr = Object.entries(dataObj).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5)
  if (arr.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">ບໍ່ມີຂໍ້ມູນ</td></tr>'; return }
  arr.forEach((item, index) => { tbody.innerHTML += `<tr><td class="ps-3"><span class="badge bg-secondary">${index + 1}</span></td><td><b>${item[0]}</b></td><td class="text-center">${item[1].count}</td><td class="text-end price-text pe-3">₭ ${item[1].rev.toLocaleString()}</td></tr>` })
}

function renderChart(canvasId, type, labels, data, colors, isMoney = false) {
  if (!document.getElementById(canvasId)) return
  if (myCharts[canvasId]) myCharts[canvasId].destroy()
  const ctx = document.getElementById(canvasId).getContext('2d')
  myCharts[canvasId] = new Chart(ctx, { type, data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type !== 'bar', position: 'bottom' }, datalabels: { formatter: v => { if (v === 0) return ''; return isMoney ? '₭ ' + v.toLocaleString() : v }, anchor: type === 'bar' ? 'end' : 'center', align: type === 'bar' ? 'bottom' : 'center', color: '#fff' } } } })
}

function renderTimeSlotChart(timeSlotData) {
  if (!document.getElementById('chartTimeSlot')) return
  if (myCharts['chartTimeSlot']) myCharts['chartTimeSlot'].destroy()
  const order = ['08:00-16:00', '16:00-21:00', '21:00-08:00']
  const labels = [], counts = [], revenues = []
  order.forEach(slot => { labels.push(slot); counts.push(timeSlotData[slot] ? timeSlotData[slot].count : 0); revenues.push(timeSlotData[slot] ? timeSlotData[slot].rev : 0) })
  const ctx = document.getElementById('chartTimeSlot').getContext('2d')

  // Chart font configuration
  const chartFont = "'Noto Sans Lao', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

  myCharts['chartTimeSlot'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'ລາຍຮັບ (₭)',
          type: 'line',
          data: revenues,
          borderColor: '#EF4444',
          backgroundColor: '#EF4444',
          borderWidth: 3,
          tension: 0.3,
          yAxisID: 'y1',
          datalabels: {
            align: 'top',
            anchor: 'end',
            color: '#EF4444',
            font: { family: chartFont, size: 10, weight: 'bold' },
            formatter: v => v > 0 ? '₭ ' + v.toLocaleString() : '',
            backgroundColor: 'rgba(255,255,255,0.8)',
            borderRadius: 4
          }
        },
        {
          label: 'ຈຳນວນບິນ',
          type: 'bar',
          data: counts,
          backgroundColor: '#3B82F6',
          yAxisID: 'y',
          datalabels: {
            align: 'center',
            anchor: 'center',
            color: '#fff',
            font: { family: chartFont, size: 11, weight: 'bold' },
            formatter: v => v > 0 ? v + ' ບິນ' : ''
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { font: { family: chartFont, size: 11 } }
        },
        tooltip: {
          titleFont: { family: chartFont, size: 12 },
          bodyFont: { family: chartFont, size: 11 }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'ຈຳນວນບິນ',
            font: { family: chartFont, size: 11, weight: 'bold' }
          },
          ticks: { font: { family: chartFont, size: 10 } }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'ລາຍຮັບ (₭)',
            font: { family: chartFont, size: 11, weight: 'bold' }
          },
          ticks: { font: { family: chartFont, size: 10 } },
          grid: { drawOnChartArea: false }
        },
        x: {
          ticks: { font: { family: chartFont, size: 10 } }
        }
      }
    }
  })
}

// Calculate Age Groups from orders data
function calculateAgeGroups(orders) {
  const ageGroups = {
    '0-15': { count: 0, rev: 0 },
    '16-35': { count: 0, rev: 0 },
    '36-55': { count: 0, rev: 0 },
    '56+': { count: 0, rev: 0 }
  }

  orders.forEach(order => {
    const age = parseInt(order.age) || 0
    const price = Number(order.price) || 0

    if (age <= 15) {
      ageGroups['0-15'].count++
      ageGroups['0-15'].rev += price
    } else if (age >= 16 && age <= 35) {
      ageGroups['16-35'].count++
      ageGroups['16-35'].rev += price
    } else if (age >= 36 && age <= 55) {
      ageGroups['36-55'].count++
      ageGroups['36-55'].rev += price
    } else if (age > 55) {
      ageGroups['56+'].count++
      ageGroups['56+'].rev += price
    }
  })

  return ageGroups
}

// Render Age Groups Chart
function renderAgeGroupsChart(ageGroupsData) {
  if (!document.getElementById('chartAgeGroups')) return
  if (myCharts['chartAgeGroups']) myCharts['chartAgeGroups'].destroy()

  const chartFont = "'Noto Sans Lao', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  const ageLabels = ['0-15', '16-35', '36-55', '56+']
  // Bright, vibrant colors for better visibility
  const ageColors = ['#059669', '#2563EB', '#D97706', '#DC2626']

  const counts = ageLabels.map(age => ageGroupsData[age] ? ageGroupsData[age].count : 0)
  const revenues = ageLabels.map(age => ageGroupsData[age] ? ageGroupsData[age].rev : 0)

  const ctx = document.getElementById('chartAgeGroups').getContext('2d')
  myCharts['chartAgeGroups'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ageLabels,
      datasets: [
        {
          label: 'ຈຳນວນຄົນ',
          data: counts,
          backgroundColor: ageColors,
          borderWidth: 0,
          borderRadius: 6,
          datalabels: {
            align: 'end',
            anchor: 'end',
            color: '#1F2937',
            font: { family: chartFont, size: 12, weight: 'bold' },
            formatter: v => v > 0 ? v : ''
          }
        },
        {
          label: 'ລາຍຮັບ (₭)',
          data: revenues,
          type: 'line',
          borderColor: '#7C3AED',
          backgroundColor: '#7C3AED',
          borderWidth: 3,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#7C3AED',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.3,
          yAxisID: 'y1',
          datalabels: {
            align: 'top',
            anchor: 'end',
            color: '#7C3AED',
            font: { family: chartFont, size: 10, weight: 'bold' },
            formatter: v => v > 0 ? '₭ ' + (v / 1000).toFixed(0) + 'K' : '',
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: 4,
            padding: 4
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: { family: chartFont, size: 11, weight: 'bold' },
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          titleFont: { family: chartFont, size: 13, weight: 'bold' },
          bodyFont: { family: chartFont, size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || ''
              if (label) {
                label += ': '
              }
              if (context.parsed.y !== null) {
                if (context.dataset.type === 'line') {
                  label += '₭ ' + context.parsed.y.toLocaleString()
                } else {
                  label += context.parsed.y
                }
              }
              return label
            }
          }
        }
      },
      scales: {
        y: {
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'ຈຳນວນຄົນ',
            font: { family: chartFont, size: 12, weight: 'bold' },
            color: '#059669'
          },
          ticks: {
            font: { family: chartFont, size: 10 },
            color: '#059669'
          },
          grid: {
            drawOnChartArea: false
          }
        },
        y1: {
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'ລາຍຮັບ (₭)',
            font: { family: chartFont, size: 12, weight: 'bold' },
            color: '#7C3AED'
          },
          ticks: {
            font: { family: chartFont, size: 10 },
            color: '#7C3AED',
            callback: function(value) {
              return '₭ ' + (value / 1000) + 'K'
            }
          },
          grid: {
            drawOnChartArea: false
          }
        },
        x: {
          ticks: {
            font: { family: chartFont, size: 11, weight: 'bold' },
            color: '#1F2937'
          },
          grid: {
            display: false
          }
        }
      }
    }
  })

  // Render Age Groups Summary Table
  renderAgeGroupsSummaryTable(ageGroupsData)
}

function renderAgeGroupsSummaryTable(ageGroupsData) {
  const tbody = document.getElementById('ageGroupsSummaryBody')
  const tfoot = document.getElementById('ageGroupsSummaryFoot')
  if (!tbody || !tfoot) return
  
  const ageLabels = ['0-15', '16-35', '36-55', '56+']
  const ageLabelsLao = ['0-15 ປີ', '16-35 ປີ', '36-55 ປີ', '56+ ປີ']
  
  let html = ''
  let totalCount = 0
  let totalRev = 0
  
  ageLabels.forEach((age, index) => {
    const data = ageGroupsData[age] || { count: 0, rev: 0 }
    const avg = data.count > 0 ? Math.round(data.rev / data.count) : 0
    totalCount += data.count
    totalRev += data.rev
    
    html += `<tr>
      <td class="text-center fw-bold">${ageLabelsLao[index]}</td>
      <td class="text-center">${data.count}</td>
      <td class="text-end">₭ ${data.rev.toLocaleString()}</td>
      <td class="text-end text-muted">₭ ${avg.toLocaleString()}</td>
    </tr>`
  })
  
  tbody.innerHTML = html
  const grandAvg = totalCount > 0 ? Math.round(totalRev / totalCount) : 0
  tfoot.innerHTML = `<tr class="table-light fw-bold">
    <td class="text-end">ລວມທັງໝົດ:</td>
    <td class="text-center text-danger">${totalCount}</td>
    <td class="text-end text-danger">₭ ${totalRev.toLocaleString()}</td>
    <td class="text-end text-muted">₭ ${grandAvg.toLocaleString()}</td>
  </tr>`
}

window.exportDashboardPDF = function() {
  const el = document.getElementById('dashContent'); window.scrollTo(0, 0)
  Swal.fire({ title: 'ກຳລັງສ້າງ PDF...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } })
  setTimeout(() => {
    html2canvas(el, { 
      scale: 1,  // ຫຼຸດ scale ລົງເພື່ອຫຼຸດຂະໜາດ
      useCORS: true, 
      backgroundColor: '#F8FAFC',
      imageTimeout: 0,
      removeContainer: true,
      logging: false,
      width: el.offsetWidth,
      height: el.offsetHeight
    }).then(canvas => {
      // ໃຊ້ JPEG ແທນ PNG ເພື່ອຫຼຸດຂະໜາດ
      const imgData = canvas.toDataURL('image/jpeg', 0.8)  // 0.8 = 80% quality
      const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      let heightLeft = pdfHeight, position = 0; const pageHeight = pdf.internal.pageSize.getHeight()
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST'); heightLeft -= pageHeight
      while (heightLeft > 0) { position = heightLeft - pdfHeight; pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST'); heightLeft -= pageHeight }
      pdf.save('Dashboard_Report_' + new Date().toISOString().split('T')[0] + '.pdf'); Swal.close()
    }).catch(() => Swal.fire('ຜິດພາດ', 'ບໍ່ສາມາດສ້າງ PDF ໄດ້', 'error'))
  }, 500)
}

// ================== MAINTENANCE ==================
window.submitMaintenance = async function() {
  const machine = document.getElementById('maintMachine').value.trim(); const date = document.getElementById('maintDate').value
  const type = document.getElementById('maintType').value; const issues = document.getElementById('maintIssues').value.trim()
  const action = document.getElementById('maintAction').value.trim(); const nextDue = document.getElementById('maintNextDue').value
  if (!machine || !date) { Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນຊື່ເຄື່ອງຈັກ ແລະ ວັນທີ!', 'warning'); return }
  const btn = document.getElementById('btnSubmitMaint'); btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ກຳລັງບັນທຶກ...'; btn.disabled = true
  const res = await api.saveMaintenanceLog({ machine, date, type, issues, action, nextDue }, sessionStorage.getItem('lis_username'))
  document.getElementById('maintMachine').value = ''; document.getElementById('maintIssues').value = ''; document.getElementById('maintAction').value = ''; document.getElementById('maintNextDue').value = ''
  btn.innerHTML = 'ບັນທຶກຂໍ້ມູນ'; btn.disabled = false
  Swal.fire('ສຳເລັດ', res.message, 'success'); loadMaintenanceTable()
}

window.loadMaintenanceTable = async function() {
  const logs = await api.getMaintenanceLogs()
  if ($.fn.DataTable.isDataTable('#maintenanceTable')) { $('#maintenanceTable').DataTable().clear().destroy() }
  let tbody = document.getElementById('maintenanceTableBody'); tbody.innerHTML = ''
  logs.forEach(l => {
    const dateStr = l.date ? new Date(l.date).toLocaleDateString('en-GB') : '-'
    const nextDueStr = l.nextDue ? new Date(l.nextDue).toLocaleDateString('en-GB') : '-'
    let nextDueClass = ''
    if (l.nextDue) { const daysLeft = Math.ceil((new Date(l.nextDue) - new Date()) / (1000 * 60 * 60 * 24)); if (daysLeft < 0) nextDueClass = 'text-danger fw-bold'; else if (daysLeft <= 7) nextDueClass = 'text-warning fw-bold' }
    tbody.innerHTML += `<tr><td class="ps-3"><small>${dateStr}</small></td><td><b>${l.machine}</b></td><td><span class="badge bg-secondary">${l.type}</span></td><td><small>${l.action || '-'}</small></td><td class="${nextDueClass}">${nextDueStr}</td><td><small class="text-muted">${l.user}</small></td><td class="text-center"><button class="btn btn-action btn-outline-danger" onclick="deleteMaintenance('${l.id}')" title="ລຶບ"><i class="bi bi-trash"></i></button></td></tr>`
  })
  initDT('maintenanceTable')
}

window.deleteMaintenance = function(id) { Swal.fire({ title: 'ຢືນຢັນການລຶບ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async result => { if (result.isConfirmed) { await api.deleteMaintenanceLog(id, sessionStorage.getItem('lis_username')); loadMaintenanceTable() } }) }

// ================== INVENTORY ==================
window.submitInventoryLot = async function() {
  const rId = document.getElementById('invSelectReagent').value; const lotNo = document.getElementById('invLotNo').value.trim()
  const expDate = document.getElementById('invExpDate').value; const recDate = document.getElementById('invReceiveDate').value
  const loc = document.getElementById('invLocation').value.trim(); const sup = document.getElementById('invSupplier').value.trim()
  const qty = document.getElementById('invQty').value
  if (!rId || !lotNo || !expDate || !qty) { Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນຂໍ້ມູນສຳຄັນໃຫ້ຄົບ!', 'warning'); return }
  const rName = globalStockList.find(x => String(x.id) === rId).name
  const btn = document.getElementById('btnSubmitInv'); btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ກຳລັງບັນທຶກ...'; btn.disabled = true
  const res = await api.saveInventoryLot({ reagentId: rId, reagentName: rName, lotNo, expDate, receiveDate: recDate, location: loc, supplier: sup, qty }, sessionStorage.getItem('lis_username'))
  document.getElementById('invLotNo').value = ''; document.getElementById('invExpDate').value = ''; document.getElementById('invQty').value = ''
  btn.innerHTML = '<i class="bi bi-check-circle me-1"></i> ບັນທຶກເຂົ້າສາງ'; btn.disabled = false
  if (addLotModalInstance) addLotModalInstance.hide()
  Swal.fire('ສຳເລັດ', res.message, 'success'); loadInventoryTable(); loadStockData()
}

window.loadInventoryTable = async function() {
  const select = document.getElementById('invSelectReagent')
  if (select.options.length <= 1 && globalStockList.length > 0) {
    select.innerHTML = '<option value="" selected disabled>-- ເລືອກນ້ຳຢາ --</option>'
    globalStockList.forEach(s => { select.innerHTML += `<option value="${s.id}">${s.name}</option>` })
  }

  // ຕັ້ງວັນທີ default ເປັນເດືອນນີ້
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  // ຖ້າຊ່ອງວັນທີເປົ່າ ໃຫ້ຕັ້ງຄ່າ default
  if (!document.getElementById('invStartDate').value) {
    document.getElementById('invStartDate').value = firstDay
  }
  if (!document.getElementById('invEndDate').value) {
    document.getElementById('invEndDate').value = todayStr
  }

  loadInventoryDataWithDate(firstDay, todayStr)
}

// ໂຫຼດຂໍ້ມູນທັງໝົດ ບໍ່ຈຳກັດວັນທີ
window.loadAllInventoryData = function() {
  // ລ້າງຊ່ອງວັນທີ
  if (document.getElementById('invStartDate')) document.getElementById('invStartDate').value = ''
  if (document.getElementById('invEndDate')) document.getElementById('invEndDate').value = ''
  if (document.getElementById('stockTypeFilter')) document.getElementById('stockTypeFilter').value = 'all'
  if (document.getElementById('stockSearchText')) document.getElementById('stockSearchText').value = ''

  // ໂຫຼດຂໍ້ມູນທັງໝົດ
  loadInventoryDataWithDate('', '')
}

// ໂຫຼດຂໍ້ມູນ Inventory ຕາມຊ່ວງວັນທີ
window.loadInventoryDataWithDate = async function(startDate, endDate) {
  // ຖ້າບໍ່ມີ parameter ໃຫ້ອ່ານຄ່າຈາກ input
  let useStartDate = startDate
  let useEndDate = endDate
  
  if (!useStartDate && document.getElementById('invStartDate')) {
    useStartDate = document.getElementById('invStartDate').value
  }
  if (!useEndDate && document.getElementById('invEndDate')) {
    useEndDate = document.getElementById('invEndDate').value
  }
  
  // ຖ້າບໍ່ມີວັນທີ ໃຫ້ສົ່ງຄ່າເປົ່າ (ຈະດຶງຂໍ້ມູນທັງໝົດ)
  useStartDate = useStartDate || ''
  useEndDate = useEndDate || ''

  console.log('📊 Loading inventory data from', useStartDate, 'to', useEndDate)

  const res = await api.getInventoryDataWithDate(useStartDate, useEndDate)
  if (!res.success) return

  globalInventoryData = res.data

  // ອັບເດດ KPIs
  document.getElementById('invTotalLots').innerText = res.data.length
  document.getElementById('invExpiringSoon').innerText = res.alerts.expiringSoon
  document.getElementById('invTotalIn').innerText = res.summary.totalIn.toLocaleString()
  document.getElementById('invTotalOut').innerText = res.summary.totalOut.toLocaleString()

  // ສະແດງຕາຕະລາງ Inventory
  if ($.fn.DataTable.isDataTable('#inventoryTable')) { $('#inventoryTable').DataTable().clear().destroy() }
  const tbody = document.getElementById('inventoryTableBody'); tbody.innerHTML = ''
  const isAdmin = sessionStorage.getItem('lis_role') === 'Admin'

  res.data.forEach(d => {
    const expD = d.expDate ? new Date(d.expDate) : null
    const expDateStr = expD ? expD.toLocaleDateString('en-GB') : '-'
    const expDateInputVal = expD ? (expD.getFullYear() + '-' + String(expD.getMonth() + 1).padStart(2, '0') + '-' + String(expD.getDate()).padStart(2, '0')) : ''
    let statusBadge = '', expClass = ''

    if (d.status === 'Empty') { statusBadge = '<span class="badge bg-secondary">Empty</span>'; expClass = 'text-muted' }
    else if (d.status === 'Expired') { statusBadge = '<span class="badge badge-solid-danger">Expired</span>'; expClass = 'text-danger fw-bold' }
    else if (d.status === 'Expiring Soon') { statusBadge = '<span class="badge badge-solid-warning">Expiring Soon</span>'; expClass = 'text-warning fw-bold' }
    else { statusBadge = '<span class="badge badge-solid-success">Active</span>'; expClass = 'text-success' }

    const actionBtns = isAdmin ? `<div class="d-flex justify-content-center gap-1 flex-nowrap">
      <button class="btn btn-action" style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; border: none; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);" onclick="editInvLot('${d.id}','${d.lotNo}','${expDateInputVal}','${d.location}','${d.supplier}','${d.qty}')" title="ແກ້ໄຂ">
        <i class="bi bi-pencil-square"></i>
      </button>
      <button class="btn btn-action" style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; border: none; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);" onclick="deleteInvLot('${d.id}')" title="ລຶບ">
        <i class="bi bi-trash"></i>
      </button>
    </div>` : '-'

    tbody.innerHTML += `<tr style="border-bottom: 1px solid #F1F5F9;">
      <td class="ps-3"><b style="color: #4F46E5;">${d.name}</b></td>
      <td><span class="badge" style="background: linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%); color: #3730A3; border: none; font-weight: 600; padding: 0.4rem 0.75rem; border-radius: 9999px;">${d.lotNo || '-'}</span></td>
      <td><span style="color: #475569;">${expDateStr}</span><br><small style="color: #94A3B8;">(${d.daysLeft > 0 ? d.daysLeft + ' days left' : 'Expired'})</small></td>
      <td><span style="color: #64748B;">${d.location || '-'}</span></td>
      <td><span style="color: #64748B;">${d.supplier || '-'}</span></td>
      <td class="text-center"><span style="color: #10B981; font-weight: 600;">${d.totalIn > 0 ? '+' + d.totalIn.toLocaleString() : '<span style="color: #CBD5E1;">-</span>'}</span></td>
      <td class="text-center"><span style="color: #EF4444; font-weight: 600;">${d.totalOut > 0 ? '-' + d.totalOut.toLocaleString() : '<span style="color: #CBD5E1;">-</span>'}</span></td>
      <td class="text-center"><span style="color: #0891B2; font-weight: 700; font-size: 0.875rem;">${d.qty.toLocaleString()}</span></td>
      <td class="text-center">${statusBadge}</td>
      <td class="text-center admin-only">${actionBtns}</td>
    </tr>`
  })

  initDT('inventoryTable')
}

// ລຽງລຳດັບຂໍ້ມູນ Inventory
window.sortInventoryData = function() {
  const sortOrder = document.getElementById('inventorySortOrder')?.value || 'default'
  
  if (!globalInventoryData || globalInventoryData.length === 0) return

  let sortedData = [...globalInventoryData]

  // Custom Order ຈາກ Excel (ແກ້ໄຂລາຍການນີ້ຕາມໄຟລ໌ຂອງເຈົ້າ)
  const customOrder = [
    'Diluent',
    'Lyse solution',
    'Probe cleanser',
    'Anti A',
    'Anti B',
    'Anti D',
    'Glucose',
    'Urea',
    'BUN',
    'Urea/BUN',
    'Creatinine',
    'Cholesterol',
    'Triglyceride',
    'Triglycerid',
    'AST',
    'GOT',
    'AST/GOT',
    'ALT',
    'GPT',
    'ALT/GPT',
    'HDL',
    'LDL',
    'Total Protein',
    'Bilirubin Total',
    'Bilirubin Direct',
    'Alkaline Phosphatase',
    'Uric Acid',
    'Calcium',
    'Albumin',
    'GGT',
    'Gamma GGT',
    'HBS Ag',
    'HBS Ab',
    'HCV Ab',
    'HIV',
    'Typhoid',
    'VDRL',
    'Rikettsia',
    'Infeuza',
    'RSV',
    'Covid19',
    'Infeuza,RSV,Covid19',
    'H.Pyloric',
    'HAV',
    'DengueNS1gMgG',
    'Dengue',
    'Tuberculosis',
    'TB',
    'Tuberculosis(TB)',
    'CEA',
    'AFP',
    'PSA',
    'HbA1C',
    'HbA1c',
    'T3',
    'T4',
    'TSH',
    'Urine Test',
    'Occult Blood',
    'ກ່ອງຍ່ຽວ',
    'ກ່ອງອາຈົມ',
    'ແຜ່ນ slide',
    'ແຜ່ນ Cover',
    'Wash concentreate',
    'Gram stain',
    'ຫຼອດມ້ວງ EDTA',
    'ຫຼອດເຫຼືອງ ເລືອດກ້າມ',
    'Amphetamine',
    'Ts Tc',
    'Gonorrhea',
    'Chamydia'
  ]

  switch (sortOrder) {
    case 'custom':
      // ລຽງຕາມ Custom Order ຈາກ Excel
      sortedData.sort((a, b) => {
        const idxA = customOrder.findIndex(name => name.toLowerCase().includes(a.name?.toLowerCase() || ''))
        const idxB = customOrder.findIndex(name => name.toLowerCase().includes(b.name?.toLowerCase() || ''))
        
        // ຖ້າບໍ່ພົບໃນ Custom Order ໃຫ້ໄວ້ທ້າຍ
        if (idxA === -1 && idxB === -1) return 0
        if (idxA === -1) return 1
        if (idxB === -1) return -1
        
        return idxA - idxB
      })
      break
    case 'name':
      sortedData.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      break
    case 'name-desc':
      sortedData.sort((a, b) => (b.name || '').localeCompare(a.name || ''))
      break
    case 'exp':
      sortedData.sort((a, b) => (a.expDate || 0) - (b.expDate || 0))
      break
    case 'exp-new':
      sortedData.sort((a, b) => (b.expDate || 0) - (a.expDate || 0))
      break
    case 'qty':
      sortedData.sort((a, b) => b.qty - a.qty)
      break
    case 'qty-asc':
      sortedData.sort((a, b) => a.qty - b.qty)
      break
    default:
      // ລຽງຕາມຄ່າເລີ່ມ (ຕາມທີ່ໂຫຼດມາຈາກ API)
      break
  }

  // ສະແດງຜົນໃໝ່
  const tbody = document.getElementById('inventoryTableBody')
  if (!tbody) return

  const isAdmin = sessionStorage.getItem('lis_role') === 'Admin'
  let html = ''

  sortedData.forEach(d => {
    const expD = d.expDate ? new Date(d.expDate) : null
    const expDateStr = expD ? expD.toLocaleDateString('en-GB') : '-'
    const expDateInputVal = expD ? (expD.getFullYear() + '-' + String(expD.getMonth() + 1).padStart(2, '0') + '-' + String(expD.getDate()).padStart(2, '0')) : ''
    let statusBadge = '', expClass = ''

    if (d.status === 'Empty') { statusBadge = '<span class="badge bg-secondary">Empty</span>'; expClass = 'text-muted' }
    else if (d.status === 'Expired') { statusBadge = '<span class="badge badge-solid-danger">Expired</span>'; expClass = 'text-danger fw-bold' }
    else if (d.status === 'Expiring Soon') { statusBadge = '<span class="badge badge-solid-warning">Expiring Soon</span>'; expClass = 'text-warning fw-bold' }
    else { statusBadge = '<span class="badge badge-solid-success">Active</span>'; expClass = 'text-success' }

    const actionBtns = isAdmin ? `<div class="d-flex justify-content-center gap-1 flex-nowrap"><button class="btn btn-action btn-outline-warning" onclick="editInvLot('${d.id}','${d.lotNo}','${expDateInputVal}','${d.location}','${d.supplier}','${d.qty}')" title="ແກ້ໄຂ"><i class="bi bi-pencil-square"></i></button><button class="btn btn-action btn-outline-danger" onclick="deleteInvLot('${d.id}')" title="ລຶບ"><i class="bi bi-trash"></i></button></div>` : '-'

    html += `<tr>
      <td class="ps-3"><b>${d.name}</b></td>
      <td><span class="badge bg-light border text-dark">${d.lotNo}</span></td>
      <td class="${expClass}">${expDateStr}<br><small>(${d.daysLeft > 0 ? d.daysLeft + ' days left' : 'Expired'})</small></td>
      <td><small>${d.location || '-'}</small></td>
      <td><small>${d.supplier || '-'}</small></td>
      <td class="text-center inventory-in">${d.totalIn > 0 ? '+' + d.totalIn.toLocaleString() : '<span class="text-muted">-</span>'}</td>
      <td class="text-center inventory-out">${d.totalOut > 0 ? '-' + d.totalOut.toLocaleString() : '<span class="text-muted">-</span>'}</td>
      <td class="text-center inventory-qty">${d.qty.toLocaleString()}</td>
      <td class="text-center">${statusBadge}</td>
      <td class="text-center admin-only">${actionBtns}</td>
    </tr>`
  })

  tbody.innerHTML = html
}

// ໂຫຼດ Stock History ໃນ້າ Inventory
/* window.loadStockHistoryInInventory = async function(startDate, endDate) {
  const typeFilter = document.getElementById('stockTypeFilter')?.value || 'all'
  const searchText = document.getElementById('stockSearchText')?.value || ''

  // ໂຫຼດຂໍ້ມູນຈາກ API
  const history = await api.getStockHistory(startDate, endDate, typeFilter)
  globalStockHistory = history

  // ກອງຕາມຊື່ (ຖ້າມີ)
  let filtered = history
  if (searchText) {
    filtered = history.filter(h =>
      h.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (h.note && h.note.toLowerCase().includes(searchText.toLowerCase()))
    )
  }

  // ສະແດງຜົນ
  renderStockHistory(filtered)
} */

// ລ້າງຕົວກອງວັນທີ
window.resetInventoryDateFilter = function() {
  if (document.getElementById('invStartDate')) document.getElementById('invStartDate').value = ''
  if (document.getElementById('invEndDate')) document.getElementById('invEndDate').value = ''
  loadInventoryTable()
}

window.exportInventoryData = function(type) {
  if (globalInventoryData.length === 0) { 
    Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ມີຂໍ້ມູນ', 'warning'); 
    return 
  }
  
  // Format data to match exact table columns
  const exportArr = globalInventoryData.map((d, index) => {
    const expDateStr = d.expDate ? new Date(d.expDate).toLocaleDateString('en-GB') : '-'
    const daysLeft = d.daysLeft !== undefined ? d.daysLeft : 0
    const daysLeftText = daysLeft > 0 ? `(${daysLeft} days left)` : ''
    
    return {
      "#": index + 1,
      "Reagent": d.name,
      "Lot No.": d.lotNo || '-',
      "Exp Date": expDateStr + (daysLeftText ? ' ' + daysLeftText : ''),
      "Location": d.location || '-',
      "Supplier": d.supplier || '-',
      "IN": d.totalIn || 0,
      "OUT": d.totalOut || 0,
      "QTY": d.qty,
      "Status": d.status
    }
  })
  
  const fileName = 'Inventory_List_' + new Date().toISOString().split('T')[0]
  
  if (type === 'excel' || type === 'csv') { 
    const ws = XLSX.utils.json_to_sheet(exportArr, { skipHeader: false })
    
    // Set column widths
    const wscols = [
      { wch: 5 },  // #
      { wch: 25 }, // Reagent
      { wch: 15 }, // Lot No.
      { wch: 20 }, // Exp Date
      { wch: 15 }, // Location
      { wch: 20 }, // Supplier
      { wch: 10 }, // IN
      { wch: 10 }, // OUT
      { wch: 10 }, // QTY
      { wch: 15 }  // Status
    ]
    ws['!cols'] = wscols
    
    // Style header row
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1"
      if (!ws[address]) continue
      ws[address].s = {
        font: { bold: true, color: { RGB: "FFFFFF" } },
        fill: { fgColor: { RGB: "4F46E5" } },
        alignment: { horizontal: "center", vertical: "center" }
      }
    }
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
    XLSX.writeFile(wb, fileName + (type === 'excel' ? '.xlsx' : '.csv'))
  }
  else if (type === 'pdf') { 
    const { jsPDF } = window.jspdf
    const doc = new jsPDF('landscape', 'mm', 'a4')
    
    // Add title
    doc.setFontSize(14)
    doc.text('ລາຍການນ້ຳຢາໃນສາງ (Inventory List)', 14, 15)
    doc.setFontSize(9)
    doc.text('Export Date: ' + new Date().toLocaleDateString('en-GB'), 14, 20)
    
    const cols = ["#", "Reagent", "Lot No.", "Exp Date", "Location", "Supplier", "IN", "OUT", "QTY", "Status"]
    const rows = exportArr.map(d => [
      d["#"],
      d["Reagent"],
      d["Lot No."],
      d["Exp Date"],
      d["Location"],
      d["Supplier"],
      d["IN"],
      d["OUT"],
      d["QTY"],
      d["Status"]
    ])
    
    doc.autoTable({
      head: [cols],
      body: rows,
      startY: 22,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { top: 25 },
      columnStyles: {
        0: { halign: 'center' },
        6: { halign: 'right', textColor: [16, 185, 129] },
        7: { halign: 'right', textColor: [239, 68, 68] },
        8: { halign: 'right', fontStyle: 'bold' },
        9: { halign: 'center' }
      }
    })
    doc.save(fileName + '.pdf')
  }
}

// Export Stock History - ບໍ່ໃຊ້ແລ້ວ
/*
window.exportStockHistory = function(type) {
  if (globalStockHistory.length === 0) { Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ມີຂໍ້ມູນ', 'warning'); return }
  const exportArr = globalStockHistory.map(d => ({
    "Date": new Date(d.date).toLocaleString('en-GB'),
    "Reagent": d.name,
    "Type": d.type,
    "Qty": d.type === 'IN' ? '+' + d.qty : '-' + d.qty,
    "Note": d.note || '',
    "User": d.user
  }))
  const fileName = 'Stock_History_' + new Date().toISOString().split('T')[0]
  if (type === 'excel' || type === 'csv') {
    const ws = XLSX.utils.json_to_sheet(exportArr)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stock History')
    XLSX.writeFile(wb, fileName + (type === 'excel' ? '.xlsx' : '.csv'))
  }
  else if (type === 'pdf') {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF('landscape')
    const cols = ["Date", "Reagent", "Type", "Qty", "Note", "User"]
    const rows = globalStockHistory.map(d => [
      new Date(d.date).toLocaleString('en-GB'),
      d.name,
      d.type,
      d.type === 'IN' ? '+' + d.qty : '-' + d.qty,
      d.note || '',
      d.user
    ])
    doc.text('Stock History Report', 14, 15)
    doc.autoTable({ head: [cols], body: rows, startY: 20 })
    doc.save(fileName + '.pdf')
  }
}
*/

window.editInvLot = function(id, lotNo, expDate, loc, sup, qty) { if (!invEditModalInstance) { invEditModalInstance = new bootstrap.Modal(document.getElementById('inventoryEditModal')) } document.getElementById('editInvLotId').value = id; document.getElementById('editInvLotNo').value = lotNo; document.getElementById('editInvExpDate').value = expDate; document.getElementById('editInvLocation').value = loc !== 'undefined' ? loc : ''; document.getElementById('editInvSupplier').value = sup !== 'undefined' ? sup : ''; document.getElementById('editInvQty').value = qty; invEditModalInstance.show() }
window.saveInvLotEdit = async function() { const id = document.getElementById('editInvLotId').value; const lotNo = document.getElementById('editInvLotNo').value.trim(); const expDate = document.getElementById('editInvExpDate').value; const loc = document.getElementById('editInvLocation').value.trim(); const sup = document.getElementById('editInvSupplier').value.trim(); const qty = document.getElementById('editInvQty').value; const btn = document.getElementById('btnSaveInvEdit'); btn.innerHTML = 'ກຳລັງອັບເດດ...'; btn.disabled = true; const res = await api.updateInventoryLot(id, lotNo, expDate, loc, sup, qty, sessionStorage.getItem('lis_username')); btn.innerHTML = 'ອັບເດດຂໍ້ມູນ'; btn.disabled = false; invEditModalInstance.hide(); Swal.fire('ສຳເລັດ', res.message, 'success'); loadInventoryTable(); loadStockData() }
window.deleteInvLot = function(id) { Swal.fire({ title: 'ລຶບ Lot ນີ້ຖິ້ມ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async result => { if (result.isConfirmed) { const res = await api.deleteInventoryLot(id, sessionStorage.getItem('lis_username')); Swal.fire('ສຳເລັດ!', res.message, 'success'); loadInventoryTable() } }) }

// ================== STOCK ==================
window.loadStockData = async function() {
  const data = await api.getStockMaster()
  globalStockList = data
  const invSelect = document.getElementById('invSelectReagent'); const mapReagent = document.getElementById('mapReagent')
  if (invSelect) invSelect.innerHTML = '<option value="" selected disabled>-- ເລອກນ້ຳາ --</option>'
  if (mapReagent) mapReagent.innerHTML = '<option value="" selected disabled>-- ເລືອກນ້ຳຢາ --</option>'
  if ($.fn.DataTable.isDataTable('#reagentMasterTable')) { $('#reagentMasterTable').DataTable().clear().destroy() }
  const masterTbody = document.getElementById('reagentMasterTableBody'); let htmlMaster = ''
  data.forEach(s => {
    if (invSelect) invSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`
    if (mapReagent) mapReagent.innerHTML += `<option value="${s.id}">${s.name} (${s.unit})</option>`
    if (masterTbody) htmlMaster += `<tr><td class="ps-3 text-muted"><small>${s.id}</small></td><td class="fw-bold text-primary">${s.name}</td><td>${s.unit}</td><td class="text-center"><div class="d-flex justify-content-center gap-1 flex-nowrap"><button class="btn btn-action btn-outline-warning" onclick="editReagent('${s.id}','${s.name}','${s.unit}')" title="ແກ້ໄຂ"><i class="bi bi-pencil-square"></i></button><button class="btn btn-action btn-outline-danger" onclick="deleteReagent('${s.id}')" title="ລຶບ"><i class="bi bi-trash"></i></button></div></td></tr>`
  })
  if (masterTbody) masterTbody.innerHTML = htmlMaster
}

// ໂຫຼດ Stock History ຕາມຊ່ວງວັນທີ
window.loadStockHistory = async function() {
  const startDate = document.getElementById('stockStartDate')?.value
  const endDate = document.getElementById('stockEndDate')?.value
  const typeFilter = document.getElementById('stockTypeFilter')?.value || 'all'
  const searchText = document.getElementById('stockSearchText')?.value || ''

  // ຖ້າບໍ່ມີວັນທີ ຫ້ໃຊ້ວັນທີເລີ່ມເດືອນຫາວັນທີສິ້ນສຸດເດືອນ
  let useStartDate = startDate
  let useEndDate = endDate

  if (!useStartDate || !useEndDate) {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    useStartDate = firstDay.toISOString().split('T')[0]
    useEndDate = today.toISOString().split('T')[0]

    if (document.getElementById('stockStartDate')) document.getElementById('stockStartDate').value = useStartDate
    if (document.getElementById('stockEndDate')) document.getElementById('stockEndDate').value = useEndDate
  }

  // ໂຫດຂໍ້ມູນຈາກ API
  const history = await api.getStockHistory(useStartDate, useEndDate, typeFilter)
  globalStockHistory = history

  // ກອງຕາມຊື່ (ຖ້າມີ)
  let filtered = history
  if (searchText) {
    filtered = history.filter(h =>
      h.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (h.note && h.note.toLowerCase().includes(searchText.toLowerCase()))
    )
  }

  // ສະແດງຜົນ
  renderStockHistory(filtered)

  // ໂຫຼດສະຫຼຸບຍອດ
  loadStockSummary(useStartDate, useEndDate)
}

// ໂຫຼດສະຫຼຸບຍອດຮັບເຂົ້າ/ເບີກອອກ
window.loadStockSummary = async function(startDate, endDate) {
  const summary = await api.getStockSummary(startDate, endDate)

  const totalInEl = document.getElementById('stockTotalIn')
  const totalOutEl = document.getElementById('stockTotalOut')
  const netBalanceEl = document.getElementById('stockNetBalance')

  if (totalInEl) totalInEl.innerText = summary.totalIn.toLocaleString()
  if (totalOutEl) totalOutEl.innerText = summary.totalOut.toLocaleString()
  if (netBalanceEl) {
    const net = summary.totalIn - summary.totalOut
    netBalanceEl.innerText = net.toLocaleString()
    netBalanceEl.className = net >= 0 ? 'mb-0 text-success fw-bold' : 'mb-0 text-danger fw-bold'
  }
}

// ລ້າງຕົວກອງ
window.resetStockFilter = function() {
  if (document.getElementById('stockStartDate')) document.getElementById('stockStartDate').value = ''
  if (document.getElementById('stockEndDate')) document.getElementById('stockEndDate').value = ''
  if (document.getElementById('stockTypeFilter')) document.getElementById('stockTypeFilter').value = 'all'
  if (document.getElementById('stockSearchText')) document.getElementById('stockSearchText').value = ''
  loadStockHistory()
}

function renderStockHistory(historyData) {
  const tbody = document.getElementById('stockHistoryBody')
  if (!tbody) return
  
  const isAdmin = sessionStorage.getItem('lis_role') === 'Admin'
  historyData.sort((a, b) => b.date - a.date)

  if (historyData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4"><i class="bi bi-inbox fs-1"></i><br>ບໍ່ມີຂໍ້ມູນໃນຊ່ວງວັນທີທີ່ເລືອກ</td></tr>'
  } else {
    let htmlHist = ''
    historyData.forEach(h => {
      const typeBadge = h.type === 'IN' ? '<span class="badge bg-success">IN</span>' : '<span class="badge bg-danger">OUT</span>'
      const qtyColor = h.type === 'IN' ? 'text-success' : 'text-danger'; const qtySign = h.type === 'IN' ? '+' : '-'
      const noteText = h.note || '<span class="text-muted">-</span>'
      const actBtn = isAdmin ? `<div class="d-flex justify-content-center gap-1 flex-nowrap"><button class="btn btn-action btn-outline-warning" onclick="editStockHistory('${h.rowIdx}','${h.qty}','${h.note}')" title="ແກ້ໄຂ"><i class="bi bi-pencil-square"></i></button><button class="btn btn-action btn-outline-danger" onclick="deleteStockHistory('${h.rowIdx}')" title="ລຶບ"><i class="bi bi-trash"></i></button></div>` : '-'
      htmlHist += `<tr>
        <td class="ps-3"><small>${new Date(h.date).toLocaleString('en-GB')}</small></td>
        <td><b>${h.name}</b></td>
        <td><small class="text-muted">${noteText}</small></td>
        <td>${typeBadge}</td>
        <td class="text-end fw-bold ${qtyColor}">${qtySign}${h.qty}</td>
        <td><small class="text-muted">${h.user}</small></td>
        <td class="text-center admin-only">${actBtn}</td>
      </tr>`
    })
    tbody.innerHTML = htmlHist
  }

  // Re-initialize DataTable
  initDT('stockHistoryTable')
}

window.editStockHistory = function(rowIdx, qty, note) { if (!stockEditModalInstance) { stockEditModalInstance = new bootstrap.Modal(document.getElementById('stockHistoryEditModal')) } document.getElementById('editStockRowIdx').value = rowIdx; document.getElementById('editStockQty').value = qty; document.getElementById('editStockNote').value = note !== 'undefined' ? note : ''; stockEditModalInstance.show() }
window.saveStockHistoryEdit = async function() { const rIdx = document.getElementById('editStockRowIdx').value; const qty = document.getElementById('editStockQty').value; const note = document.getElementById('editStockNote').value.trim(); const btn = document.getElementById('btnSaveStockEdit'); btn.innerHTML = 'ກຳລັງອັບເດດ...'; btn.disabled = true; const res = await api.updateStockTransaction(rIdx, qty, note, sessionStorage.getItem('lis_username')); btn.innerHTML = 'ອັບເດດປະຫວັດ'; btn.disabled = false; stockEditModalInstance.hide(); Swal.fire('ສຳເລັດ', res.message, 'success'); loadStockData() }
window.deleteStockHistory = function(rowIdx) { Swal.fire({ title: 'ຢືນຢັນການລຶບ?', text: 'ການລຶບ ຈະບໍ່ຄືນຍອດໃນສາງໃຫ້ອັດຕະໂນມັດ!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async result => { if (result.isConfirmed) { const res = await api.deleteStockTransaction(rowIdx, sessionStorage.getItem('lis_username')); Swal.fire('ສຳເລັດ!', res.message, 'success'); loadStockData() } }) }

window.saveReagentMaster = async function() {
  const id = document.getElementById('editReagentId').value; const name = document.getElementById('newReagentName').value.trim(); const unit = document.getElementById('newReagentUnit').value.trim()
  if (!name || !unit) { Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນຊື່ ແລະ ຫົວໜ່ວຍ!', 'warning'); return }
  const btn = document.getElementById('btnSaveReagent'); btn.innerHTML = '...'; btn.disabled = true
  if (id) { const res = await api.updateReagentMaster(id, name, unit, sessionStorage.getItem('lis_username')); cancelEditReagent(); Swal.fire('ສຳເລັດ', res.message, 'success'); loadStockData(); loadInventoryTable() }
  else { const res = await api.addNewReagent(name, unit); document.getElementById('newReagentName').value = ''; document.getElementById('newReagentUnit').value = ''; btn.innerHTML = '<i class="bi bi-plus-circle"></i> ບັນທຶກ'; btn.disabled = false; Swal.fire('ສຳເລັດ', res.message, 'success'); loadStockData(); loadInventoryTable() }
}
window.editReagent = function(id, name, unit) { document.getElementById('editReagentId').value = id; document.getElementById('newReagentName').value = name; document.getElementById('newReagentUnit').value = unit; document.getElementById('btnSaveReagent').innerHTML = '<i class="bi bi-check-lg"></i> ອັບເດດ'; document.getElementById('btnSaveReagent').classList.replace('btn-success', 'btn-warning'); document.getElementById('btnCancelReagent').classList.remove('d-none') }
window.cancelEditReagent = function() { document.getElementById('editReagentId').value = ''; document.getElementById('newReagentName').value = ''; document.getElementById('newReagentUnit').value = ''; document.getElementById('btnSaveReagent').innerHTML = '<i class="bi bi-plus-circle"></i> ບັນທຶກ'; document.getElementById('btnSaveReagent').classList.replace('btn-warning', 'btn-success'); document.getElementById('btnSaveReagent').disabled = false; document.getElementById('btnCancelReagent').classList.add('d-none') }
window.deleteReagent = function(id) { Swal.fire({ title: 'ລຶບລາຍຊື່ນ້ຳຢານີ້?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async result => { if (result.isConfirmed) { const res = await api.deleteReagentMaster(id, sessionStorage.getItem('lis_username')); if (res.success) { Swal.fire('ສຳເລັດ!', res.message, 'success'); loadStockData() } else { Swal.fire('ຜິດພາດ!', res.message, 'error') } } }) }

// ================== TEST SETUP ==================
window.loadTestCheckboxes = async function() {
  const container = document.getElementById('dynamicTestContainer'); container.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div></div>'
  const tests = await api.getTestMaster()
  container.innerHTML = ''; if (tests.length === 0) return
  const grouped = {}; tests.forEach(t => { const cat = t.category || 'Other'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(t) })
  const catOrder = ["Hematology", "Biochemistry", "Immunoserology", "Stool/Urine", "ultrasound", "Cardiology", "X-ray", "ENT", "Pathology", "Lab", "Other"]
  const sortedCats = Object.keys(grouped).sort((a, b) => { let ia = catOrder.indexOf(a); if (ia === -1) ia = 99; let ib = catOrder.indexOf(b); if (ib === -1) ib = 99; return ia - ib })
  sortedCats.forEach(cat => {
    let html = `<div class="col-12 test-category-group" data-category="${cat.toLowerCase()}"><h6 class="fw-bold category-header"><i class="bi bi-tag-fill me-2"></i>${cat}</h6><div class="row g-2">`
    grouped[cat].forEach(x => { html += `<div class="col-xl-3 col-lg-4 col-md-4 col-sm-6 col-6 test-item-wrapper" data-name="${x.name.toLowerCase()}"><div class="test-item-card"><input class="form-check-input test-item border-primary shadow-none m-0" type="checkbox" data-name="${x.name}" data-cat="${x.category}" value="${x.price}" id="chk_${x.id}"><label class="form-check-label test-item-label text-truncate" for="chk_${x.id}" title="${x.name}">${x.name} <br><span class="test-price">₭ ${x.price.toLocaleString()}</span></label></div></div>` })
    html += `</div></div>`; container.innerHTML += html
  })
  document.querySelectorAll('.test-item').forEach(b => b.addEventListener('change', calculateCart))
  if (document.getElementById('searchTestInput')) document.getElementById('searchTestInput').value = ''
  // Load package selector
  loadPackageSelector()
}

window.filterTestItems = function() {
  const input = document.getElementById('searchTestInput').value.toLowerCase()
  document.querySelectorAll('.test-item-wrapper').forEach(w => { w.style.display = w.getAttribute('data-name').includes(input) ? '' : 'none' })
  document.querySelectorAll('.test-category-group').forEach(g => { const visible = g.querySelectorAll('.test-item-wrapper:not([style*="display: none"])'); g.style.display = (visible.length === 0 && input !== '') ? 'none' : '' })
}

window.calculateCart = function() {
  const isP = document.getElementById('testType').value === 'Package'
  const packagePriceEl = document.getElementById('packagePrice')
  const packageNameEl = document.getElementById('packageName')

  document.getElementById('packageInputDiv').style.display = isP ? 'block' : 'none'
  
  const cList = document.getElementById('cartList'); cList.innerHTML = ''; cartItems = []; let sum = 0
  document.querySelectorAll('.test-item').forEach(b => { if (b.checked) { const p = isP ? 0 : parseInt(b.value); sum += p; cartItems.push({ name: b.getAttribute('data-name'), price: p, category: b.getAttribute('data-cat') }); cList.innerHTML += `<li class="list-group-item d-flex justify-content-between py-1 small bg-transparent"><span>${b.getAttribute('data-name')}</span> <span class="price-text">₭ ${p.toLocaleString()}</span></li>` } })
  if (cartItems.length === 0) cList.innerHTML = '<li class="list-group-item text-center text-muted small border-0 mt-4 bg-transparent">ຍັງບໍ່ມີລາຍການ</li>'
  if (isP) { finalTotal = packagePriceEl ? (parseInt(packagePriceEl.value) || 0) : 0; if (packageNameEl && packageNameEl.value) cartItems.push({ name: packageNameEl.value, price: finalTotal, category: 'Package' }) } else { finalTotal = sum }
  document.getElementById('totalPriceDisplay').innerText = '₭ ' + finalTotal.toLocaleString()
}

window.submitData = async function() {
  if (!document.getElementById('patientId').value.trim()) { 
    Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນ Patient ID!', 'warning'); 
    return 
  }
  if (!document.getElementById('patientName').value.trim()) { 
    Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນຊື່ ແລະ ນາມສະກຸນ!', 'warning'); 
    return 
  }
  if (!document.getElementById('age').value.trim()) { 
    Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນອາຍຸ!', 'warning'); 
    return 
  }
  
  const testType = document.getElementById('testType').value
  const packageSelector = document.getElementById('packageSelector')
  
  // ກວດສອບວ່າເລືອກ Package ຫຼື ບໍ່
  if (testType === 'Package') {
    if (!packageSelector || !packageSelector.value) {
      Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາເລືອກ Package!', 'warning'); 
      return 
    }
    // ຖ້າເລືອກ Package ແລ້ວ ແຕ່ cartItems ຍັງເປົ່າ (ກຳລັງໂຫຼດ)
    if (cartItems.length === 0) {
      Swal.fire('ແຈ້ງເຕືອນ', 'ກຳລັງໂຫຼດຂໍ້ມູນ Package... ກະລຸນາລໍຖ້າຊົ່ວຄູ້!', 'warning'); 
      return 
    }
  } else {
    // Normal mode - ຕ້ອງເລືອກລາຍການກວດ
    if (cartItems.length === 0) { 
      Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາເລືອກລາຍການກວດ!', 'warning'); 
      return 
    }
  }
  
  const payload = {
    loggedUser: sessionStorage.getItem('lis_username'), existingOrderId: currentEditOrderId,
    orderDateTime: document.getElementById('orderDateTime').value, timeSlot: document.getElementById('timeSlot').value,
    visitType: document.getElementById('visitType').value, insite: document.getElementById('insite').value,
    patientId: document.getElementById('patientId').value, patientName: document.getElementById('patientName').value,
    age: document.getElementById('age').value, gender: document.getElementById('gender').value,
    doctor: document.getElementById('doctor').value, department: document.getElementById('department').value,
    testType: document.getElementById('testType').value,
    labDest: document.getElementById('isOutlab').checked ? document.getElementById('labDest').value : 'In-house',
    sender: document.getElementById('sender').value, cart: cartItems, totalPrice: finalTotal
  }
  document.getElementById('submitBtn').innerHTML = '<span class="spinner-border spinner-border-sm"></span> ກຳລັງບັນທຶກ...'
  const res = await api.submitTestOrder(payload)
  if (res.success) { Swal.fire('ສຳເລັດ!', res.message, 'success'); cancelEdit(); loadTable(); loadStockData(); loadInventoryTable(); if (sessionStorage.getItem('lis_role') === 'Admin') loadDashboard() }
  else { Swal.fire('ຜິດພາດ!', res.message, 'error') }
  document.getElementById('submitBtn').innerHTML = '<i class="bi bi-save me-2"></i> ບັນທຶກການສັ່ງກວດ'
}

window.toggleOutlab = function() {
  const labDestDiv = document.getElementById('labDestDiv')
  const isOutlab = document.getElementById('isOutlab')
  if (labDestDiv && isOutlab) {
    labDestDiv.style.display = isOutlab.checked ? 'block' : 'none'
  }
}

window.resetForm = function() {
  const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.value = val }
  const safeChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val }
  
  safeSet('orderDateTime', new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  safeSet('patientId', '')
  safeSet('patientName', '')
  safeSet('age', '')
  safeSet('packageName', '')
  safeSet('packagePrice', '0')
  safeChk('isOutlab', false)
  toggleOutlab()
  document.querySelectorAll('.test-item').forEach(b => b.checked = false)
  calculateCart()
  safeSet('timeSlot', '')
  safeSet('visitType', '')
  safeSet('insite', '')
  safeSet('doctor', '')
  safeSet('department', '')
  safeSet('sender', '')
  safeSet('labDest', '')
}

window.loadTable = async function() { const orders = await api.getRecentOrders(); globalOrders = orders; renderTable(orders) }

window.renderTable = function(orders) {
  if ($.fn.DataTable.isDataTable('#orderHistoryTable')) { $('#orderHistoryTable').DataTable().clear().destroy() }
  const tbody = document.getElementById('orderTableBody'); if (!tbody) return; let html = ''
  orders.sort((a, b) => b.dateTime - a.dateTime)
  orders.forEach(order => {
    const dateStr = new Date(order.dateTime).toLocaleString('en-GB')
    const labDestValue = (!order.labDest || order.labDest === 'In-Lab' || order.labDest === 'In-house') ? 'In-house' : order.labDest
    const labBadge = (!order.labDest || order.labDest === 'In-Lab' || order.labDest === 'In-house') ? `<span class="badge badge-solid-success">In-house</span>` : `<span class="badge badge-solid-danger">${labDestValue}</span>`

    // Badge ປະເພດ Order: Package ຫຼ Normal
    const isPackage = order.testType === 'Package'
    const typeBadge = isPackage
      ? `<span class="badge badge-solid-primary"><i class="bi bi-box-seam me-1"></i>Package</span>`
      : `<span class="badge badge-solid-secondary"><i class="bi bi-list-check me-1"></i>Normal</span>`
    
    let resultEntryBtn, viewResultBtn
    if (order.status === 'Completed') {
      resultEntryBtn = `<button class="btn btn-sm btn-warning py-0 text-dark fw-bold shadow-sm" onclick="openResultModal('${order.orderId}')" title="ແກ້ໄຂຜົນກວດ"><i class="bi bi-pencil-square"></i></button>`
      viewResultBtn = `<button class="btn btn-sm btn-primary py-0 shadow-sm" onclick="viewLabResults('${order.orderId}')" title="ເບິ່ງ/ພິມ ຜົນກວດ"><i class="bi bi-printer"></i></button>`
    } else {
      resultEntryBtn = `<button class="btn btn-sm btn-success py-0 fw-bold shadow-sm" onclick="openResultModal('${order.orderId}')" title="ປ້ອນຜົນກວດໃໝ່"><i class="bi bi-clipboard2-pulse"></i></button>`
      viewResultBtn = `<button class="btn btn-sm btn-secondary py-0 opacity-50" disabled title="ຍັງບໍ່ມີຜົນກວດ"><i class="bi bi-printer"></i></button>`
    }
    html += `<tr><td><small class="text-muted">${dateStr}</small></td><td><span class="fw-bold" style="color:var(--primary-med);">${order.patientId}</span><br><small class="text-muted" style="font-size: 0.7rem;">${order.orderId}</small></td><td><span class="fw-bold">${order.patientName}</span></td><td class="text-center">${order.age}</td><td class="text-center">${order.gender}</td><td>${labBadge}</td><td class="text-center">${typeBadge}</td><td class="text-end price-text text-danger">₭ ${order.totalPrice.toLocaleString()}</td><td class="text-center"><div class="d-flex justify-content-center gap-1 flex-nowrap">${resultEntryBtn}${viewResultBtn}<button class="btn btn-action btn-outline-info" onclick="viewOrder('${order.orderId}')" title="ເບິ່ງລາຍລະອຽດ"><i class="bi bi-eye"></i></button><button class="btn btn-action btn-outline-dark" onclick="editOrder('${order.orderId}')" title="ແກ້ໄຂ"><i class="bi bi-gear"></i></button><button class="btn btn-action btn-outline-danger" onclick="deleteOrder('${order.orderId}')" title="ຍົກເລີກ"><i class="bi bi-trash"></i></button></div></td></tr>`
  })
  tbody.innerHTML = html; initDT('orderHistoryTable', '550px')
}

window.viewOrder = function(orderId) {
  const order = globalOrders.find(o => o.orderId === orderId); if (!order) return
  let testList = '<ul class="list-group list-group-flush border rounded mb-0">'
  order.tests.forEach(t => { testList += `<li class="list-group-item d-flex justify-content-between align-items-center py-1 px-2"><span class="small">${t.name}</span> <span class="fw-bold price-text small">₭ ${t.price.toLocaleString()}</span></li>` })
  testList += '</ul>'
  const labDestValue = (!order.labDest || order.labDest === 'In-Lab' || order.labDest === 'In-house') ? 'In-house' : order.labDest
  const labDestHtml = (!order.labDest || order.labDest === 'In-Lab' || order.labDest === 'In-house') ? `<span class="badge badge-solid-success">In-house</span>` : `<span class="badge badge-solid-danger">${labDestValue}</span>`

  // Badge ປະເພດ Order: Package ຫຼ Normal
  const isPackage = order.testType === 'Package'
  const typeBadgeHtml = isPackage
    ? `<span class="badge badge-solid-primary"><i class="bi bi-box-seam me-1"></i>Package</span>`
    : `<span class="badge badge-solid-secondary"><i class="bi bi-list-check me-1"></i>Normal</span>`
  
  Swal.fire({ title: '<i class="bi bi-file-earmark-medical text-primary"></i> ຂໍ້ມູນໃບສັ່ງກວດ', html: `<div class="text-start mt-3"><table class="table table-bordered table-sm"><tr><th class="bg-light w-25">ລະຫັດບິນ:</th><td><b>${order.orderId}</b></td></tr><tr><th class="bg-light">ເວລາ:</th><td>${new Date(order.dateTime).toLocaleString('en-GB')}</td></tr><tr><th class="bg-light">ຄົນເຈັບ:</th><td><span class="text-primary fw-bold">${order.patientId}</span> - ${order.patientName} (${order.gender}, ${order.age} ປີ)</td></tr><tr><th class="bg-light">ແພດ / ພະແນກ:</th><td>${order.doctor} / ${order.department}</td></tr><tr><th class="bg-light">ສະຖານະ:</th><td>${labDestHtml}</td></tr><tr><th class="bg-light">ປະເພດ:</th><td>${typeBadgeHtml}</td></tr><tr><th class="bg-light">ລາຍການ:</th><td class="p-2">${testList}</td></tr><tr><th class="bg-light align-middle">ຍອດລວມ:</th><td><h3 class="price-text m-0">₭ ${order.totalPrice.toLocaleString()}</h3></td></tr></table></div>`, width: 600, showCloseButton: true, showConfirmButton: false })
}

window.viewLabResults = async function(orderId) {
  const order = globalOrders.find(o => o.orderId === orderId); if (!order) return
  Swal.fire({ title: 'ກຳລັງໂຫຼດ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
  const savedResults = await api.getSavedResults(orderId)
  const labDestValue = (!order.labDest || order.labDest === 'In-Lab' || order.labDest === 'In-house') ? 'In-house' : order.labDest
  const labDestHtml = (!order.labDest || order.labDest === 'In-Lab' || order.labDest === 'In-house') ? `<span class="badge badge-solid-success">In-house</span>` : `<span class="badge badge-solid-danger">${labDestValue}</span>`
  let html = `<div class="text-start mt-3"><table class="table table-bordered table-sm mb-3"><tr><th class="bg-light w-25">ລະຫັດບິນ:</th><td><b>${order.orderId}</b></td></tr><tr><th class="bg-light">ຄົນເຈັບ:</th><td><span class="text-primary fw-bold">${order.patientId}</span> - ${order.patientName}</td></tr><tr><th class="bg-light">ສະຖານະ:</th><td>${labDestHtml} <span class="badge ${order.status === 'Completed' ? 'bg-success' : 'bg-secondary'}">${order.status}</span></td></tr></table>`
  if (savedResults && savedResults.length > 0) {
    html += `<h6 class="fw-bold text-success border-bottom pb-1"><i class="bi bi-clipboard2-check"></i> ຜົນການກວດ</h6><div class="table-responsive"><table class="table table-sm table-bordered text-center align-middle" style="font-size:0.85rem;"><thead class="table-light"><tr><th>Test</th><th class="text-start">Parameter</th><th>Result</th><th>Flag</th><th>Unit</th><th>Reference</th></tr></thead><tbody>`
    savedResults.forEach(r => {
      let flagHtml = ''; let valClass = ''
      if (r.flag === 'H') { flagHtml = '<span class="badge bg-danger">H</span>'; valClass = 'text-danger fw-bold' }
      else if (r.flag === 'L') { flagHtml = '<span class="badge bg-warning text-dark">L</span>'; valClass = 'text-warning fw-bold' }
      else if (r.flag === 'Normal' && r.value !== '') { flagHtml = '<span class="text-success" style="font-size:0.7rem;">Normal</span>' }
      html += `<tr><td class="text-secondary">${r.testName}</td><td class="text-start fw-bold">${r.paramName}</td><td class="${valClass} fs-6">${r.value}</td><td>${flagHtml}</td><td><small class="text-muted">${r.unit}</small></td><td><small class="text-muted">${r.normalRange}</small></td></tr>`
    })
    html += '</tbody></table></div>'
  } else { html += `<div class="alert alert-warning small"><i class="bi bi-info-circle"></i> ຍັງບໍ່ທັນໄດ້ປ້ອນຜົນກວດ.</div>` }
  html += '</div>'
  Swal.fire({ title: '<i class="bi bi-file-earmark-medical text-primary"></i> ໃບລາຍງານຜົນກວດ', html, width: 750, showCloseButton: true, showConfirmButton: savedResults && savedResults.length > 0, confirmButtonText: '<i class="bi bi-printer"></i> ພິມ', confirmButtonColor: '#2563EB' })
}

window.filterTable = function() { const d = document.getElementById('searchDate').value; const filtered = globalOrders.filter(o => d ? new Date(o.dateTime).toISOString().startsWith(d) : true); renderTable(filtered) }
window.deleteOrder = function(orderId) { Swal.fire({ title: 'ຢືນຢັນຍົກເລີກບິນ?', text: 'ປ່ຽນສະຖານະ ' + orderId + ' ເປັນ Cancelled?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async result => { if (result.isConfirmed) { const res = await api.deleteOrder(orderId, sessionStorage.getItem('lis_username')); Swal.fire('ສຳເລັດ!', res.message, 'success'); loadTable() } }) }

window.editOrder = function(orderId) {
  const order = globalOrders.find(o => o.orderId === orderId); if (!order) return
  currentEditOrderId = order.orderId; showPage(null, 'orderForm')
  document.getElementById('editAlert').classList.remove('d-none'); document.getElementById('editOrderIdDisplay').innerText = order.orderId
  document.getElementById('submitBtn').innerHTML = '<i class="bi bi-arrow-repeat me-2"></i> ອັບເດດບິນ'; document.getElementById('submitBtn').classList.replace('btn-primary', 'btn-warning')
  document.getElementById('orderDateTime').value = new Date(order.dateTime - (new Date()).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  document.getElementById('timeSlot').value = order.timeSlot; document.getElementById('visitType').value = order.visitType
  document.getElementById('insite').value = order.insite; document.getElementById('patientId').value = order.patientId
  document.getElementById('patientName').value = order.patientName; document.getElementById('age').value = order.age
  document.getElementById('gender').value = order.gender; document.getElementById('doctor').value = order.doctor
  document.getElementById('department').value = order.department; document.getElementById('sender').value = order.sender
  document.getElementById('testType').value = order.testType
  if (order.labDest && order.labDest !== 'In-house') { document.getElementById('isOutlab').checked = true; toggleOutlab(); document.getElementById('labDest').value = order.labDest }
  else { document.getElementById('isOutlab').checked = false; toggleOutlab() }
  document.querySelectorAll('.test-item').forEach(b => b.checked = false)
  order.tests.forEach(t => { const box = document.querySelector(`.test-item[data-name="${t.name}"]`); if (box) box.checked = true })
  calculateCart(); window.scrollTo(0, 0)
}

window.cancelEdit = function() { currentEditOrderId = null; document.getElementById('editAlert').classList.add('d-none'); document.getElementById('submitBtn').innerHTML = '<i class="bi bi-save me-2"></i> ບັນທຶກການສັ່ງກວດ'; document.getElementById('submitBtn').classList.replace('btn-warning', 'btn-primary'); resetForm() }

window.exportHistoryData = function(type) {
  const d = document.getElementById('searchDate').value; const filtered = globalOrders.filter(o => d ? new Date(o.dateTime).toISOString().startsWith(d) : true)
  if (filtered.length === 0) { Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ມີຂໍ້ມູນ', 'warning'); return }
  const exportArr = filtered.map(o => ({ "Order_ID": o.orderId, "Date_Time": new Date(o.dateTime).toLocaleString('en-GB'), "Patient_ID": o.patientId, "Patient_Name": o.patientName, "Lab_Destination": (!o.labDest || o.labDest === 'In-Lab' || o.labDest === 'In-house') ? 'In-house' : o.labDest, "Tests": o.tests.map(t => t.name).join(', '), "Total_Kip": o.totalPrice, "Status": o.status }))
  const fileName = 'Order_History_' + new Date().toISOString().split('T')[0]
  if (type === 'excel' || type === 'csv') { const ws = XLSX.utils.json_to_sheet(exportArr); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'History'); XLSX.writeFile(wb, fileName + (type === 'excel' ? '.xlsx' : '.csv')) }
  else if (type === 'pdf') { const { jsPDF } = window.jspdf; const doc = new jsPDF('landscape'); const cols = ["Order ID", "Date", "Patient ID", "Name", "Lab", "Tests", "Total", "Status"]; const rows = filtered.map(o => [o.orderId, new Date(o.dateTime).toLocaleString('en-GB'), o.patientId, o.patientName, (!o.labDest || o.labDest === 'In-Lab' || o.labDest === 'In-house') ? 'In-house' : o.labDest, o.tests.map(t => t.name).join(', '), o.totalPrice.toLocaleString(), o.status]); doc.text('Order History', 14, 15); doc.autoTable({ head: [cols], body: rows, startY: 20, styles: { fontSize: 8 } }); doc.save(fileName + '.pdf') }
}

// ================== OUTLAB ==================
window.loadOutlabTable = async function() {
  const orders = await api.getOutlabOrders()
  if ($.fn.DataTable.isDataTable('#outlabTable')) { $('#outlabTable').DataTable().clear().destroy() }
  const tbody = document.getElementById('outlabTableBody'); let html = ''
  orders.forEach(o => {
    const badgeColor = o.status === 'Received' ? 'bg-success' : 'bg-warning text-dark'; const recDateStr = o.receivedDate ? new Date(o.receivedDate).toLocaleString('en-GB') : '-'
    const noteHtml = o.note ? `<small class="text-info"><i class="bi bi-chat-text"></i> ${o.note}</small>` : '-'
    html += `<tr><td><span class="badge border text-dark">${o.orderId}</span></td><td><small>${new Date(o.dateTime).toLocaleString('en-GB')}</small></td><td><b class="text-primary">${o.patientId}</b><br><small>${o.patientName}</small></td><td><span class="badge bg-danger">${o.labDest}</span></td><td><small class="fw-bold">${o.sender}</small></td><td><small>${o.tests.map(t => t.name).join(', ')}</small></td><td><span class="badge ${badgeColor}">${o.status || 'Pending'}</span></td><td><small class="text-success fw-bold">${recDateStr}</small></td><td>${noteHtml}</td><td><select class="form-select form-select-sm" onchange="updateStatus('${o.orderId}', this.value)"><option value="" disabled selected>ປ່ຽນສະຖານະ</option><option value="Pending">Pending</option><option value="Received">Received</option></select></td></tr>`
  })
  tbody.innerHTML = html; initDT('outlabTable')
}

window.updateStatus = function(orderId, status) {
  if (!status) return
  if (status === 'Received') {
    Swal.fire({ title: 'ຢືນຢັນການຮັບຜົນ', input: 'text', inputPlaceholder: 'ປ້ອນໝາຍເຫດ (ຖ້າມີ)...', showCancelButton: true, confirmButtonText: 'ບັນທຶກ', confirmButtonColor: '#10b981' })
      .then(async result => { if (result.isConfirmed) { const res = await api.updateOrderStatus(orderId, status, sessionStorage.getItem('lis_username'), result.value || ''); Swal.fire('ອັບເດດແລ້ວ', res.message, 'success'); loadOutlabTable() } else { loadOutlabTable() } })
  } else { api.updateOrderStatus(orderId, status, sessionStorage.getItem('lis_username'), '').then(res => { Swal.fire('ອັບເດດແລ້ວ', res.message, 'success'); loadOutlabTable() }) }
}

// ================== TEST MASTER TABLE ==================
window.loadTestMasterTable = async function() {
  const tests = await api.getTestMaster()
  if ($.fn.DataTable.isDataTable('#testMasterTable')) { $('#testMasterTable').DataTable().clear().destroy() }
  const tb = document.getElementById('masterTableBody'); let html = ''
  tests.forEach(x => {
    const catClass = getCategoryBadgeClass(x.category)
    html += `<tr><td><small>${x.name}</small></td><td><span class="badge ${catClass}">${x.category}</span></td><td class="price-text small">₭ ${x.price.toLocaleString()}</td><td class="text-center"><div class="d-flex justify-content-center gap-1 flex-nowrap"><button class="btn btn-action btn-outline-warning" onclick="editTest('${x.id}','${x.name}','${x.price}','${x.category}')" title="ແກ້ໄຂ"><i class="bi bi-pencil-square"></i></button><button class="btn btn-action btn-outline-danger" onclick="deleteTestMaster('${x.id}')" title="ລຶບ"><i class="bi bi-trash"></i></button></div></td></tr>`
  })
  tb.innerHTML = html; initDT('testMasterTable')
}

window.editTest = function(id, name, price, cat) { document.getElementById('editTestId').value = id; document.getElementById('setupTestName').value = name; document.getElementById('setupTestPrice').value = price; document.getElementById('setupTestCat').value = cat; const btn = document.getElementById('btnSaveTest'); btn.innerHTML = '<i class="bi bi-check-lg"></i> ອັບເດດ'; btn.classList.replace('btn-success', 'btn-warning'); document.getElementById('btnCancelTest').classList.remove('d-none') }
window.cancelEditTest = function() { document.getElementById('editTestId').value = ''; document.getElementById('setupTestName').value = ''; document.getElementById('setupTestPrice').value = ''; document.getElementById('setupTestCat').selectedIndex = 0; const btn = document.getElementById('btnSaveTest'); btn.innerHTML = '<i class="bi bi-plus-circle"></i> ບັນທຶກ'; btn.classList.replace('btn-warning', 'btn-success'); document.getElementById('btnCancelTest').classList.add('d-none') }

window.saveTestMaster = async function() {
  const id = document.getElementById('editTestId').value; const name = document.getElementById('setupTestName').value.trim(); const price = document.getElementById('setupTestPrice').value.trim(); const cat = document.getElementById('setupTestCat').value
  if (!name || !price) { Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ!', 'warning'); return }
  const btn = document.getElementById('btnSaveTest'); btn.innerHTML = 'ກຳລັງບັນທຶກ...'; btn.disabled = true
  if (id) { const res = await api.updateTestMaster(id, name, price, cat, sessionStorage.getItem('lis_username')); btn.disabled = false; if (res.success) { cancelEditTest(); loadTestMasterTable(); loadTestCheckboxes(); loadMappingData(); Swal.fire('ສຳເລັດ', res.message, 'success') } else { Swal.fire('ຜິດພາດ', res.message, 'error'); cancelEditTest() } }
  else { const res = await api.saveTestMaster({ name, price, category: cat }); btn.disabled = false; if (res.success) { cancelEditTest(); loadTestMasterTable(); loadTestCheckboxes(); loadMappingData(); Swal.fire('ສຳເລັດ', 'ເພີ່ມລາຍການແລ້ວ', 'success') } else { Swal.fire('ຜິດພາດ', 'ເກີດຂໍ້ຜິດພາດ', 'error') } }
}

window.deleteTestMaster = function(id) { Swal.fire({ title: 'ລຶບລາຍການນີ້?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async res => { if (res.isConfirmed) { await api.deleteTestMaster(id); Swal.fire('ສຳເລັດ', 'ລຶບແລ້ວ!', 'success'); loadTestMasterTable(); loadTestCheckboxes(); loadMappingData() } }) }

// ==================== CSV IMPORT/EXPORT ====================
let csvImportModal

// Show Import CSV Modal
window.showImportCSVModal = function() {
  if (!csvImportModal) {
    csvImportModal = new bootstrap.Modal(document.getElementById('importCSVModal'))
  }
  document.getElementById('csvFileInput').value = ''
  document.getElementById('csvDataPaste').value = ''
  document.getElementById('importPreviewBody').innerHTML = ''
  csvImportModal.show()
}

// Preview CSV from file
document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'csvFileInput') {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = function(e) {
        document.getElementById('csvDataPaste').value = e.target.result
        previewCSVData(e.target.result)
      }
      reader.readAsText(file)
    }
  }
})

// Preview CSV data
function previewCSVData(csvText) {
  const tbody = document.getElementById('importPreviewBody')
  if (!tbody) return
  
  const lines = csvText.trim().split('\n')
  let html = ''
  let count = 0
  
  lines.forEach(line => {
    if (line.trim() && count < 10) { // Preview first 10 rows
      const parts = line.split(',').map(p => p.trim())
      if (parts.length >= 2) {
        const name = parts[0] || '-'
        const price = parts[1] || '0'
        const category = parts[2] || 'Other'
        html += `<tr><td>${name}</td><td>${price}</td><td>${category}</td></tr>`
        count++
      }
    }
  })
  
  tbody.innerHTML = html
  if (lines.length > 10) {
    tbody.innerHTML += `<tr><td colspan="3" class="text-center text-muted">... and ${lines.length - 10} more rows</td></tr>`
  }
}

// Process CSV Import
window.processCSVImport = async function() {
  const csvText = document.getElementById('csvDataPaste').value.trim()
  if (!csvText) {
    Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາອັບໂຫຼດໄຟລ໌ CSV ຫຼື າງຂໍ້ມູນ CSV!', 'warning')
    return
  }
  
  const lines = csvText.trim().split('\n')
  const csvData = []
  
  lines.forEach(line => {
    if (line.trim()) {
      const parts = line.split(',').map(p => p.trim())
      if (parts.length >= 2) {
        csvData.push({
          name: parts[0],
          price: parts[1],
          category: parts[2] || 'Other'
        })
      }
    }
  })
  
  if (csvData.length === 0) {
    Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ພົບຂໍ້ມູນທີ່ຖືກຕ້ອງໃນ CSV!', 'warning')
    return
  }
  
  Swal.fire({
    title: 'ຢືນຢັນການນຳເຂົ້າ',
    html: `ທ່ານກຳລັງຈະນຳເຂົ້າ <b>${csvData.length}</b> ລາຍການ.<br><br><span class="text-danger">ຂໍ້ມູນເກົ່າຈະຖືກລຶບທັງໝົດ!</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ນຳເຂົ້າ',
    cancelButtonText: 'ຍົກເລີກ'
  })
  
  const result = await Swal.fire({
    title: 'ກຳລັງນຳເຂົ້າ...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading() }
  })
  
  try {
    const res = await api.importTestMasterFromCSV(csvData, sessionStorage.getItem('lis_username'))
    if (res.success) {
      Swal.fire('ສຳເລັດ', res.message, 'success')
      csvImportModal.hide()
      loadTestMasterTable()
      loadTestCheckboxes()
      loadMappingData()
    } else {
      Swal.fire('ຜິດພາດ', res.message, 'error')
    }
  } catch (e) {
    Swal.fire('ຜິດພາດ', e.message, 'error')
  }
}

// Export Test Master to CSV
window.exportTestMasterCSV = async function() {
  const tests = await api.getTestMaster()
  if (tests.length === 0) {
    Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ມີຂໍ້ມູນສຳລັບ Export!', 'warning')
    return
  }
  
  // Create CSV content
  let csv = 'name,price,category\n'
  tests.forEach(t => {
    csv += `"${t.name}",${t.price},"${t.category}"\n`
  })
  
  // Download file
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `test_master_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ================== SUMMARY REPORT ==================
window.loadSummaryReport = async function() {
  // Function ນີ້ຖືກເອີ້ນໃນ checkLogin() ແຕ່ບໍ່ຈຳເປັນຕ້ອງໂຫດທັນທີ
  // ຈະໂຫຼດເມື່ອຜູ້ໃຊ້ເປີດໜ້າ Summary Report
  return
}

// ================== MAPPING ==================
window.loadMappingData = async function() {
  const tests = await api.getTestMaster()
  const selTest = document.getElementById('mapTestName'); const spTest = document.getElementById('spTestName')
  if (selTest) { selTest.innerHTML = '<option value="" selected disabled>-- ເລືອກ --</option>'; tests.forEach(t => { selTest.innerHTML += `<option value="${t.name}">${t.name}</option>` }) }
  if (spTest) { spTest.innerHTML = '<option value="" selected disabled>-- ເລືອກ --</option>'; tests.forEach(t => { spTest.innerHTML += `<option value="${t.name}">${t.name}</option>` }) }
  const mappings = await api.getTestReagentMapping()
  if ($.fn.DataTable.isDataTable('#mappingTable')) { $('#mappingTable').DataTable().clear().destroy() }
  const tbody = document.getElementById('mappingTableBody'); if (!tbody) return; tbody.innerHTML = ''
  mappings.forEach(m => { tbody.innerHTML += `<tr><td class="fw-bold text-primary">${m.testName}</td><td>${m.reagentName}</td><td class="text-center fw-bold">${m.qty}</td><td class="text-center"><button class="btn btn-action btn-outline-danger" onclick="deleteMapping(${m.rowIdx})" title="ລຶບ"><i class="bi bi-trash"></i></button></td></tr>` })
  initDT('mappingTable')
}

window.saveMapping = async function() {
  const testName = document.getElementById('mapTestName').value; const reagentId = document.getElementById('mapReagent').value; const qty = document.getElementById('mapQty').value
  if (!testName || !reagentId || !qty) { Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ!', 'warning'); return }
  const reagentName = globalStockList.find(r => String(r.id) === reagentId).name
  const res = await api.addTestReagentMapping(testName, reagentId, reagentName, qty, sessionStorage.getItem('lis_username'))
  if (res.success) { Swal.fire('ສຳເລັດ', res.message, 'success'); document.getElementById('mapQty').value = ''; loadMappingData() }
  else { Swal.fire('ຜິດພາດ', res.message, 'error') }
}

window.deleteMapping = function(id) { Swal.fire({ title: 'ລຶບການຕັ້ງຄ່ານີ້?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async result => { if (result.isConfirmed) { const res = await api.deleteTestReagentMapping(id, sessionStorage.getItem('lis_username')); if (res.success) { Swal.fire('ສຳເລັດ', res.message, 'success'); loadMappingData() } else { Swal.fire('ຜິດພາດ', res.message, 'error') } } }) }

// ================== PARAMETERS ==================
window.loadParamSetupData = async function() {
  const params = await api.getTestParameters()
  if ($.fn.DataTable.isDataTable('#paramTable')) { $('#paramTable').DataTable().clear().destroy() }
  const tbody = document.getElementById('paramTableBody'); if (!tbody) return; tbody.innerHTML = ''
  params.forEach(p => {
    const rangeText = p.inputType === 'Number' ? `${p.min || 0} - ${p.max || 0}` : (p.inputType === 'Dropdown' ? `<small class="text-muted">${p.options}</small>` : '-')
    const typeBadge = p.inputType === 'Number' ? '<span class="badge bg-info text-dark">Number</span>' : (p.inputType === 'Dropdown' ? '<span class="badge bg-warning text-dark">Dropdown</span>' : '<span class="badge bg-secondary">Text</span>')
    tbody.innerHTML += `<tr><td class="fw-bold text-primary">${p.testName}</td><td class="fw-bold">${p.paramName}</td><td>${typeBadge}</td><td>${rangeText}</td><td>${p.unit || '-'}</td><td class="text-center"><button class="btn btn-action btn-outline-danger" onclick="deleteParameter(${p.rowIdx})" title="ລຶບ"><i class="bi bi-trash"></i></button></td></tr>`
  })
  initDT('paramTable', '450px')
}

window.toggleParamInputFields = function() { const type = document.getElementById('spInputType').value; document.getElementById('divNumberSetup').style.display = (type === 'Number') ? 'flex' : 'none'; document.getElementById('divDropdownSetup').style.display = (type === 'Dropdown') ? 'flex' : 'none' }

window.saveParameter = async function() {
  const tName = document.getElementById('spTestName').value; const pName = document.getElementById('spParamName').value.trim()
  const iType = document.getElementById('spInputType').value; const pUnit = document.getElementById('spUnit').value.trim()
  let pMin = '', pMax = '', pOpt = ''
  if (!tName || !pName) { Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາເລືອກລາຍການກວດ ແລະ ໃສ່ຊື່ Parameter!', 'warning'); return }
  if (iType === 'Number') { pMin = document.getElementById('spMin').value; pMax = document.getElementById('spMax').value }
  else if (iType === 'Dropdown') { pOpt = document.getElementById('spOptions').value.trim(); if (!pOpt) { Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນ Options!', 'warning'); return } }
  const res = await api.saveTestParameter({ testName: tName, paramName: pName, inputType: iType, unit: pUnit, min: pMin, max: pMax, options: pOpt }, sessionStorage.getItem('lis_username'))
  if (res.success) { Swal.fire('ສຳເລັດ', res.message, 'success'); document.getElementById('spParamName').value = ''; document.getElementById('spMin').value = ''; document.getElementById('spMax').value = ''; document.getElementById('spOptions').value = ''; loadParamSetupData() }
  else { Swal.fire('ຜິດພາດ', res.message, 'error') }
}

window.deleteParameter = function(id) { Swal.fire({ title: 'ລຶບການຕັ້ງຄ່ານີ້?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async result => { if (result.isConfirmed) { const res = await api.deleteTestParameter(id, sessionStorage.getItem('lis_username')); Swal.fire('ສຳເລັດ', res.message, 'success'); loadParamSetupData() } }) }

// ================== LAB RESULTS ==================
window.applyFastEntry = function(testName, inputEl) {
  const values = inputEl.value.trim().split(/[\s,]+/)
  const inputs = document.querySelectorAll(`.result-input[data-test="${testName}"]`)
  let valIdx = 0
  inputs.forEach(inp => { if (valIdx < values.length && inp.tagName === 'INPUT') { inp.value = values[valIdx]; valIdx++ } })
  inputEl.value = ''
}

// ==========================================
// RESULT FILE UPLOAD/DOWNLOAD (NEW SYSTEM)
// ==========================================
let uploadedFiles = []  // ເກັບລາຍການໄຟລ໌ທີ່ອັບໂຫຼດ
let allResultsData = []  // ເກັບຂໍ້ມູນຜົນກວດທັງໝົດ (Excel ເທົ່ານັ້ນ)
let showSummaryTable = true  // ສະຖານະການສະແດງຕາຕະລາງ

window.openResultModal = async function(orderId) {
  if (!resultModalInstance) { resultModalInstance = new bootstrap.Modal(document.getElementById('resultEntryModal')) }
  document.getElementById('resOrderIdDisplay').innerText = orderId
  document.getElementById('currentResultOrderId').value = orderId
  
  // Reset ຂໍ້ມູນເກົ່າ
  uploadedFiles = []
  allResultsData = []
  showSummaryTable = true
  document.getElementById('resultFileInput').value = ''
  document.getElementById('uploadedFilesList').innerHTML = ''
  document.getElementById('noFilesMessage').style.display = 'block'
  document.getElementById('resultsSummaryCard').style.display = 'none'
  
  resultModalInstance.show()
  
  // ໂຫຼດໄຟລ໌ເກົ່າຈາກ Database (ຖ້າມີ)
  try {
    console.log('Loading attachments for order:', orderId)
    const attachments = await api.getOrderAttachments(orderId)
    console.log('Loaded attachments:', attachments)
    
    if (attachments && attachments.length > 0) {
      attachments.forEach(att => {
        uploadedFiles.push({
          id: att.id || Date.now() + Math.random(),
          name: att.file_name,
          size: att.file_size || 0,
          data: att.file_url,
          type: att.file_type
        })
      })

      console.log('Uploaded files:', uploadedFiles)

      // ສະແດງໄຟລ໌ເກົ່າ
      renderUploadedFiles()

      // ສະແດງຕາຕະລາງຜົນກວດ (ຖ້າມີ Excel)
      mergeAllResults()
      if (allResultsData.length > 0 && showSummaryTable) {
        renderResultsSummary()
      }
    } else {
      console.log('No attachments found for this order')
    }
  } catch (err) {
    console.error('Error loading attachments:', err)
    Swal.fire('ຜິດພາດ', 'ບໍ່ສາມາດໂຫຼດໄຟລ໌ເກົ່າໄດ້: ' + err.message, 'error')
  }
}

window.toggleSummaryTable = function() {
  showSummaryTable = !showSummaryTable
  const card = document.getElementById('resultsSummaryCard')
  const icon = card.querySelector('.btn i')
  
  if (showSummaryTable) {
    card.style.display = 'block'
    icon.className = 'bi bi-eye-slash'
  } else {
    card.style.display = 'none'
    icon.className = 'bi bi-eye'
  }
}

window.downloadResultTemplate = function() {
  const orderId = document.getElementById('currentResultOrderId').value
  if (!orderId) { Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ພົບລະຫັດບິນ!', 'warning'); return }
  
  // ສ້າງ Template ວ່າງ
  const templateData = [
    { 'Test Name': 'Creatinine', 'Parameter': 'Crea', 'Result': '', 'Unit': 'mg/dl' },
    { 'Test Name': 'AST(SGOT)', 'Parameter': 'AST', 'Result': '', 'Unit': 'U/L' },
    { 'Test Name': 'ALT(SGPT)', 'Parameter': 'ALT', 'Result': '', 'Unit': 'U/L' }
  ]
  
  // Export ເປັນ Excel
  const ws = XLSX.utils.json_to_sheet(templateData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template')
  XLSX.writeFile(wb, `Result_Template_${orderId}.xlsx`)
}

window.handleFileSelect = async function(fileInput) {
  const files = Array.from(fileInput.files)
  if (files.length === 0) return

  Swal.fire({ title: 'ກຳລັງອ່ານໄຟລ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })

  let successCount = 0

  for (const file of files) {
    try {
      const fileName = file.name
      const fileSize = file.size
      const fileType = file.type || ''

      // ກຳນົດປະເພດໄຟລ໌
      const isExcel = fileType.includes('excel') || fileType.includes('spreadsheetml') || fileName.toLowerCase().endsWith('.csv')
      const isImage = fileType.includes('image') || /\.(png|jpg|jpeg|gif|heic|heif)$/i.test(fileName)
      const isPDF = fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')

      if (isImage) {
        // ສຳລັບຮູບພາບ: ອ່ານເປັນ Base64 ເພື່ອດາວໂຫຼດຄືນໄດ້
        try {
          const base64Data = await readFileAsBase64(file)
          uploadedFiles.push({
            id: Date.now() + Math.random(),
            name: fileName,
            size: fileSize,
            data: base64Data,  // ເກັບ Base64 ເຕັມໆ
            type: 'image'
          })
          successCount++
          console.log('✓ Image added:', fileName)
        } catch (readErr) {
          console.error('Error reading image:', fileName, readErr)
        }
      } else if (isPDF) {
        // ສຳລັບ PDF: ອ່ານເປັນ Base64 ເພື່ອດາວໂຫຼດຄືນໄດ້
        try {
          const base64Data = await readFileAsBase64(file)
          uploadedFiles.push({
            id: Date.now() + Math.random(),
            name: fileName,
            size: fileSize,
            data: base64Data,  // ເກັບ Base64 ເຕັມໆ
            type: 'pdf'
          })
          successCount++
          console.log('✓ PDF added:', fileName)
        } catch (readErr) {
          console.error('Error reading PDF:', fileName, readErr)
        }
      } else if (isExcel) {
        // ສຳລັບ Excel: ອ່ານຂໍ້ມູນ
        try {
          const excelData = await readFile(file)
          if (excelData && excelData.length > 0) {
            uploadedFiles.push({
              id: Date.now() + Math.random(),
              name: fileName,
              size: fileSize,
              data: excelData,
              type: 'excel'
            })
            successCount++
            console.log('✓ Excel added:', fileName, 'with', excelData.length, 'rows')
          } else {
            console.log('⚠ Excel has no data:', fileName)
          }
        } catch (excelErr) {
          console.error('Error reading Excel:', fileName, excelErr)
        }
      } else {
        console.log('⚠ Unknown file type:', fileName, fileType)
      }
    } catch (fileErr) {
      console.error('Error processing file:', file.name, fileErr)
      // ບໍ່ຢຸດທຳງານ, ຂ້າມໄປໄຟລ໌ຖັດໄປ
    }
  }

  // ລວມຂໍ້ມູນທັງໝົດ (ສຳລັບ Excel ເທົ່ານັ້ນ)
  mergeAllResults()

  // ສະແດງລາຍການໄຟລ໌
  renderUploadedFiles()

  // ສະແດງຕາຕະລາງຜົນກວດ (ຖ້າມີ Excel)
  if (allResultsData.length > 0 && showSummaryTable) {
    renderResultsSummary()
  }

  // ປິດ Loading
  Swal.close()

  // ສະແດງຜົນວ່າອັບໂຫຼດໄດ້ຈັກໄຟລ໌
  if (successCount > 0) {
    Swal.fire({
      icon: 'success',
      title: 'ສຳເລັດ',
      html: `<div style="text-align: left;">
        <p>✅ ອັບໂຫຼດໄດ້ <b>${successCount}</b> ໄຟລ໌</p>
        <ul style="margin-top: 10px; font-size: 0.85rem;">
          ${uploadedFiles.slice(-3).map(f => `<li>${f.name}</li>`).join('')}
          ${uploadedFiles.length > 3 ? `<li>... ແລະ ອື່ນໆ ${uploadedFiles.length - 3} ໄຟລ໌</li>` : ''}
        </ul>
      </div>`,
      timer: 2000
    })
  } else {
    Swal.fire({
      icon: 'warning',
      title: 'ແຈ້ງເຕືອນ',
      text: 'ບໍ່ສາມາດອັບໂຫຼດໄຟລ໌ໄດ້. ກະລຸນາກວດສອບປະເພດໄຟລ໌.',
      timer: 3000
    })
  }

  fileInput.value = ''
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet)

        if (jsonData.length === 0) {
          resolve(null)
          return
        }

        // ກວດສອບ columns
        const requiredCols = ['Test Name', 'Parameter', 'Result']
        const firstRow = jsonData[0]
        const missingCols = requiredCols.filter(col => !(col in firstRow))

        if (missingCols.length > 0) {
          Swal.fire('ແຈ້ງເຕືອນ', `ໄຟລ໌ "${file.name}" ຂາດ column: ${missingCols.join(', ')}`, 'warning')
          resolve(null)
          return
        }

        resolve(jsonData.map(row => ({
          testName: String(row['Test Name']).trim(),
          paramName: String(row['Parameter']).trim(),
          result: String(row['Result']).trim(),
          unit: String(row['Unit'] || '').trim()
        })))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // ເອົາສະເພາະ Base64 ສ່ວນ (ຫຼັງຄຳວ່າ data:...;base64,)
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function mergeAllResults() {
  allResultsData = []
  uploadedFiles.forEach(file => {
    // ກວດສອບວ່າເປັນ Excel ແລະ ມີຂໍ້ມູນ array
    if (file.type === 'excel' && Array.isArray(file.data)) {
      file.data.forEach(item => {
        allResultsData.push({
          ...item,
          fileId: file.id,
          id: Date.now() + Math.random()
        })
      })
    }
    // ຮູບພາບ ແລະ PDF ບໍ່ມີຂໍ້ມູນທີ່ຕ້ອງ merge
  })
}

window.renderUploadedFiles = function() {
  const container = document.getElementById('uploadedFilesList')

  if (uploadedFiles.length === 0) {
    container.innerHTML = ''
    document.getElementById('noFilesMessage').style.display = 'block'
    return
  }

  document.getElementById('noFilesMessage').style.display = 'none'

  container.innerHTML = '<h6 class="fw-bold text-muted mb-2"><i class="bi bi-files"></i> ໄຟລ໌ທີ່ອັບໂຫຼດ (' + uploadedFiles.length + '):</h6>' +
    uploadedFiles.map(f => {
      const sizeKB = (f.size / 1024).toFixed(1)
      let iconHtml = ''

      if (f.type === 'excel') {
        iconHtml = '<i class="bi bi-file-earmark-excel text-success"></i>'
      } else if (f.type === 'pdf') {
        iconHtml = '<i class="bi bi-file-earmark-pdf text-danger"></i>'
      } else if (f.type === 'image') {
        iconHtml = '<i class="bi bi-file-earmark-image text-primary"></i>'
      } else {
        iconHtml = '<i class="bi bi-file-earmark text-secondary"></i>'
      }

      return `
        <div class="alert alert-success d-flex justify-content-between align-items-center mb-2 py-2">
          <div>
            ${iconHtml}
            <span class="fw-bold">${f.name}</span>
            <small class="text-muted ms-2">(${sizeKB} KB)</small>
          </div>
          <div class="d-flex gap-1">
            <button class="btn btn-action btn-outline-primary" onclick="downloadAttachment('${f.id}')" title="ດາວໂຫຼດ">
              <i class="bi bi-download"></i>
            </button>
            <button class="btn btn-action btn-outline-danger" onclick="removeFile('${f.id}')" title="ລົບໄຟລ">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `
    }).join('')
}

window.downloadAttachment = function(fileId) {
  fileId = parseFloat(fileId)
  const file = uploadedFiles.find(f => f.id === fileId)
  if (!file) {
    Swal.fire('ຜິດພາດ', 'ບໍ່ພົບໄຟລ໌!', 'error')
    return
  }

  console.log('Downloading file:', file)

  // ຖ້າເປັນ Excel
  if (file.type === 'excel') {
    // Parse ຂໍ້ມູນຖ້າເປັນ String
    let excelData = file.data
    if (typeof file.data === 'string') {
      try {
        excelData = JSON.parse(file.data)
      } catch (e) {
        console.error('Error parsing Excel data:', e)
      }
    }
    
    if (Array.isArray(excelData) && excelData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Results')
      XLSX.writeFile(wb, file.name)
    } else {
      Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ມີຂໍ້ມູນໃນໄຟລ໌ Excel', 'warning')
    }
    return
  }
  
  // ຖ້າເປັນຮູບພາບ
  if (file.type === 'image') {
    // ຖ້າເປັນ Base64, ໃຫ້ດາວໂຫຼດ
    if (typeof file.data === 'string') {
      try {
        // ແປງ Base64 ເປັນ Blob
        const byteCharacters = atob(file.data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'image/jpeg' })
        
        // ສ້າງ URL ຈາກ Blob
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // ປົດ URL ອອກ
        setTimeout(() => URL.revokeObjectURL(url), 100)
      } catch (err) {
        console.error('Error downloading image:', err)
        Swal.fire('ຜິດພາດ', 'ບໍ່ສາມາດດາວໂຫຼດຮູບພາບໄດ້: ' + err.message, 'error')
      }
    } else {
      Swal.fire('ແຈ້ງເຕືອນ', 'ຂໍ້ມູນຮູບພາບບໍ່ຖືກຕ້ອງ', 'warning')
    }
    return
  }
  
  // ຖ້າເປັນ PDF
  if (file.type === 'pdf') {
    // ຖ້າເປັນ Base64, ໃຫ້ດາວໂຫຼດ
    if (typeof file.data === 'string') {
      try {
        // ແປງ Base64 ເປັນ Blob
        const byteCharacters = atob(file.data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'application/pdf' })
        
        // ສ້າງ URL ຈາກ Blob
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // ປົດ URL ອອກ
        setTimeout(() => URL.revokeObjectURL(url), 100)
      } catch (err) {
        console.error('Error downloading PDF:', err)
        Swal.fire('ຜິດພາດ', 'ບໍ່ສາມາດດາວໂຫຼດ PDF ໄດ້: ' + err.message, 'error')
      }
    } else {
      Swal.fire('ແຈ້ງເຕືອນ', 'ຂໍ້ມູນ PDF ບໍ່ຖືກຕ້ອງ', 'warning')
    }
    return
  }

  // ປະເພດອື່ນໆ
  Swal.fire({
    icon: 'info',
    title: 'ແຈ້ງເຕືອນ',
    text: 'ບໍ່ຮອງຮັບການດາວໂຫຼດໄຟລ໌ປະເພດນີ້',
    timer: 3000
  })
}

window.renderResultsSummary = function() {
  const tbody = document.getElementById('resultsSummaryBody')
  const summaryCard = document.getElementById('resultsSummaryCard')
  
  if (allResultsData.length === 0) {
    summaryCard.style.display = 'none'
    return
  }
  
  summaryCard.style.display = 'block'
  
  tbody.innerHTML = allResultsData.map((item, index) => `
    <tr>
      <td class="fw-bold text-primary">${item.testName}</td>
      <td>${item.paramName}</td>
      <td><input type="text" class="form-control form-control-sm" value="${item.result}" onchange="updateResult('${item.id}', 'result', this.value)" style="min-width: 100px;"></td>
      <td><input type="text" class="form-control form-control-sm" value="${item.unit}" onchange="updateResult('${item.id}', 'unit', this.value)" style="min-width: 80px;"></td>
      <td class="text-center">
        <button class="btn btn-action btn-outline-danger" onclick="removeResult('${item.id}')" title="ລົບ">
          <i class="bi bi-x"></i>
        </button>
      </td>
    </tr>
  `).join('')
}

window.removeFile = function(fileId) {
  fileId = parseFloat(fileId)
  uploadedFiles = uploadedFiles.filter(f => f.id !== fileId)
  mergeAllResults()
  renderUploadedFiles()
  renderResultsSummary()
}

window.updateResult = function(resultId, field, value) {
  resultId = parseFloat(resultId)
  const item = allResultsData.find(r => r.id === resultId)
  if (item) {
    item[field] = value
  }
}

window.removeResult = function(resultId) {
  resultId = parseFloat(resultId)
  allResultsData = allResultsData.filter(r => r.id !== resultId)
  renderResultsSummary()
}

window.submitLabResultsFromFiles = async function() {
  const orderId = document.getElementById('currentResultOrderId').value
  
  if (uploadedFiles.length === 0) {
    Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາອັບໂຫຼດໄຟລ໌ຜົນກວດ!', 'warning')
    return
  }
  
  const btn = document.getElementById('btnSaveResult')
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ບັນທຶກ...'; btn.disabled = true
  
  try {
    // ກຽມຂໍ້ມູນສຳລັບບັນທຶກ
    let results = []
    let attachments = []
    
    // ຖ້າມີຂໍ້ມູນ Excel
    if (allResultsData.length > 0) {
      results = allResultsData.map(item => ({
        testName: item.testName,
        paramName: item.paramName,
        value: item.result,
        unit: item.unit
      }))
    }
    
    // ກຽມຂໍ້ມູນໄຟລ໌ສຳລັບບັນທຶກ
    attachments = uploadedFiles.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      data: f.data  // ຖ້າເປັນຮູບ ຫຼື ຕ້ອງການເກັບ Base64
    }))
    
    // ບັນທຶກຜົນກວດ + ໄຟລ໌
    const res = await api.saveLabResults(orderId, results, sessionStorage.getItem('lis_username'), attachments)
    btn.innerHTML = '<i class="bi bi-check-circle me-1"></i> ບັນທຶກຜົນກວດ'; btn.disabled = false
    
    if (res.success) {
      Swal.fire('ສຳເລັດ', res.message, 'success')
      resultModalInstance.hide()
      loadTable()
    } else {
      Swal.fire('ຜິດພາດ', res.message, 'error')
    }
  } catch (err) {
    btn.innerHTML = '<i class="bi bi-check-circle me-1"></i> ບັນທຶກຜົນກວດ'; btn.disabled = false
    Swal.fire('ຜິດພາດ', err.message, 'error')
  }
}

// ຍັງຮັກສາ function ເກົ່າໄວ້ສຳລັບ backward compatibility
window.uploadResultFile = async function(fileInput) {
  await handleFileSelect(fileInput)
}

// ==========================================
// TEST PACKAGES MANAGEMENT
// ==========================================
let packageModalInst
let currentPackageItems = []
let globalTestMaster = []

window.openPackageModal = async function() {
  if (!packageModalInst) {
    packageModalInst = new bootstrap.Modal(document.getElementById('packageModal'))
  }
  document.getElementById('editPackageId').value = ''
  document.getElementById('pkgName').value = ''
  document.getElementById('pkgPrice').value = '0'
  document.getElementById('pkgDescription').value = ''
  document.getElementById('pkgActive').value = 'true'
  currentPackageItems = []
  renderPackageItems()
  document.getElementById('packageModalTitle').innerText = 'ສ້າງ Package ໃໝ່'
  document.getElementById('btnSavePackage').innerText = 'ບັນທຶກ Package'
  
  // Load test master if not loaded
  if (globalTestMaster.length === 0) {
    globalTestMaster = await api.getTestMaster()
  }
  
  packageModalInst.show()
}

window.addPackageTestItem = function() {
  if (globalTestMaster.length === 0) {
    Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ພົບລາຍການກວດ. ກະລຸນາເພີ່ມໃນ Test Master ກ່ອນ.', 'warning')
    return
  }
  
  const testOptions = globalTestMaster.map(t => `<option value="${t.id}" data-price="${t.price}">${t.name}</option>`).join('')
  
  Swal.fire({
    title: 'ເພີ່ມລາຍການກວດ',
    html: `
      <label class="form-label small fw-bold">ລາຍການກວດ</label>
      <select id="swalTestSelect" class="form-select form-select-sm mb-2">${testOptions}</select>
    `,
    showCancelButton: true,
    confirmButtonText: 'ເພີ່ມ',
    cancelButtonText: 'ຍົກເລີກ',
    preConfirm: () => {
      const select = document.getElementById('swalTestSelect')
      const testId = select.value
      const testName = select.options[select.selectedIndex].text
      const price = parseFloat(select.options[select.selectedIndex].dataset.price) || 0
      
      if (currentPackageItems.find(i => i.testId == testId)) {
        Swal.showValidationMessage('ລາຍການນີ້ມີຢູ່ແລ້ວ!')
        return false
      }
      
      currentPackageItems.push({ testId, testName, price })
      renderPackageItems()
      return true
    }
  })
}

window.renderPackageItems = function() {
  const tbody = document.getElementById('packageItemsBody')
  if (currentPackageItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">ຍັງບໍ່ມີລາຍການ</td></tr>'
    return
  }
  
  tbody.innerHTML = currentPackageItems.map((item, idx) => {
    const testName = item.testName || 'Unknown'
    const price = item.price || 0
    return `
    <tr>
      <td>${testName}</td>
      <td>${price.toLocaleString()}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-danger" onclick="removePackageItem(${idx})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `}).join('')
}

window.removePackageItem = function(idx) {
  currentPackageItems.splice(idx, 1)
  renderPackageItems()
}

window.savePackage = async function() {
  const pkgId = document.getElementById('editPackageId').value
  const name = document.getElementById('pkgName').value.trim()
  const price = parseFloat(document.getElementById('pkgPrice').value) || 0
  const description = document.getElementById('pkgDescription').value.trim()
  const isActive = document.getElementById('pkgActive').value === 'true'
  
  if (!name) {
    Swal.fire('ຂໍ້ມູນບໍ່ຄົບ', 'ກະລຸນາປ້ອນຊື່ Package', 'warning')
    return
  }
  
  console.log('Saving package:', { name, price, items: currentPackageItems })
  
  const btn = document.getElementById('btnSavePackage')
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ບັນທກ...'; btn.disabled = true
  
  const pkgData = { name, description, price, isActive, items: currentPackageItems }
  const user = sessionStorage.getItem('lis_username')
  
  let res
  if (pkgId) {
    res = await api.updateTestPackage(parseInt(pkgId), pkgData, user)
  } else {
    res = await api.saveTestPackage(pkgData, user)
  }
  
  btn.innerHTML = '<i class="bi bi-check-circle me-1"></i> ບັນທຶກ Package'; btn.disabled = false
  
  if (res.success) {
    Swal.fire('ສຳເລັດ', res.message, 'success')
    packageModalInst.hide()
    loadPackagesTable()
  } else {
    Swal.fire('ຜິດພາດ', res.message, 'error')
  }
}

window.editPackage = async function(pkgId) {
  if (!packageModalInst) {
    packageModalInst = new bootstrap.Modal(document.getElementById('packageModal'))
  }
  
  const packages = await api.getAllTestPackages()
  const pkg = packages.find(p => p.id == pkgId)
  if (!pkg) return
  
  document.getElementById('editPackageId').value = pkg.id
  document.getElementById('pkgName').value = pkg.name
  document.getElementById('pkgPrice').value = pkg.price || 0
  document.getElementById('pkgDescription').value = pkg.description || ''
  document.getElementById('pkgActive').value = pkg.is_active ? 'true' : 'false'
  
  // Load items - fix: use correct field names from API
  const items = await api.getPackageItems(pkgId)
  console.log('Package items:', items)
  currentPackageItems = items.map(i => ({ 
    testId: i.testId || i.test_id, 
    testName: i.testName || i.test_name, 
    price: i.price 
  }))
  renderPackageItems()
  
  document.getElementById('packageModalTitle').innerText = 'ແກ້ໄຂ Package'
  document.getElementById('btnSavePackage').innerText = 'ອັບເດດ Package'
  
  if (globalTestMaster.length === 0) {
    globalTestMaster = await api.getTestMaster()
  }
  
  packageModalInst.show()
}

window.deletePackage = async function(pkgId) {
  const result = await Swal.fire({
    title: 'ຢືນຢັນການລຶບ?',
    text: 'ທ່ານແນ່ໃຈບໍ່ທີ່ຈະລຶບ Package ນີ້?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ລຶບ',
    cancelButtonText: 'ຍົກເລີກ'
  })
  
  if (result.isConfirmed) {
    const user = sessionStorage.getItem('lis_username')
    const res = await api.deleteTestPackage(pkgId, user)
    if (res.success) {
      Swal.fire('ສຳເລັດ', res.message, 'success')
      loadPackagesTable()
    } else {
      Swal.fire('ຜິດພາດ', res.message, 'error')
    }
  }
}

window.loadPackagesTable = async function() {
  const packages = await api.getAllTestPackages()
  const tbody = document.getElementById('packagesTableBody')
  
  if (packages.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">ຍັງບໍ່ມີ Package</td></tr>'
    return
  }
  
  // Load items count for each package
  const packagesWithCount = await Promise.all(packages.map(async pkg => {
    const items = await api.getPackageItems(pkg.id)
    return {
      ...pkg,
      item_count: items.length
    }
  }))
  
  tbody.innerHTML = packagesWithCount.map(pkg => `
    <tr>
      <td><b>${pkg.name}</b></td>
      <td>${pkg.description || '-'}</td>
      <td>${(pkg.price || 0).toLocaleString()}</td>
      <td>${pkg.item_count || 0}</td>
      <td><span class="badge ${pkg.is_active ? 'bg-success' : 'bg-secondary'}">${pkg.is_active ? 'ໃຊ້ງານ' : 'ບໍ່ໃຊ້ງານ'}</span></td>
      <td class="text-center">
        <button class="btn btn-sm btn-primary me-1" onclick="editPackage(${pkg.id})" title="ແກ້ໄຂ">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="deletePackage(${pkg.id})" title="ລຶບ">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('')
}

// Package selector in Order Form
window.loadPackageSelector = async function() {
  const packages = await api.getTestPackages()
  const selector = document.getElementById('packageSelector')

  if (!selector) return

  console.log('Loaded packages:', packages)

  selector.innerHTML = '<option value="">-- ເລືອກ Package --</option>' +
    packages.map(p => {
      console.log(`Package: ${p.name}, ID: ${p.id}, Price: ${p.price}`)
      return `<option value="${p.id}" data-price="${p.price}">${p.name}</option>`
    }).join('')
}

window.onPackageSelect = async function() {
  const selector = document.getElementById('packageSelector')
  const pkgId = selector.value
  const pkgItemsList = document.getElementById('packageItemsList')
  const packagePriceInput = document.getElementById('packagePrice')

  if (!pkgId) {
    pkgItemsList.innerHTML = ''
    packagePriceInput.value = '0'
    finalTotal = 0
    document.getElementById('totalPriceDisplay').innerText = '₭ ' + finalTotal.toLocaleString()
    renderCart()
    return
  }

  const selectedOption = selector.options[selector.selectedIndex]
  const pkgPrice = parseFloat(selectedOption.dataset.price) || 0

  console.log('Package selected:', selectedOption.text, 'ID:', pkgId, 'Price:', pkgPrice)

  const items = await api.getPackageItems(pkgId)
  console.log('Selected package items:', items)

  if (items.length === 0) {
    pkgItemsList.innerHTML = '<li class="list-group-item small text-muted">ບໍ່ມີລາຍການ</li>'
  } else {
    pkgItemsList.innerHTML = items.map(i => {
      const testName = i.testName || i.test_name || 'Unknown'
      return `<li class="list-group-item small d-flex justify-content-between"><span>${testName}</span><span class="text-muted">${(i.price || 0).toLocaleString()}</span></li>`
    }).join('')
  }

  packagePriceInput.value = pkgPrice

  // Trigger calculateCart to update checkboxes and total
  if (window.calculateCart) {
    await window.calculateCart()
  }
}

// Override calculateCart to handle packages
const originalCalculateCart = window.calculateCart
window.calculateCart = async function() {
  const testType = document.getElementById('testType').value
  const packageDiv = document.getElementById('packageInputDiv')
  const packageSelector = document.getElementById('packageSelector')

  if (testType === 'Package') {
    packageDiv.style.display = 'block'

    // Load package selector if not already loaded
    if (!packageSelector || packageSelector.options.length <= 1) {
      console.log('📦 Loading package selector...')
      await loadPackageSelector()
    }

    // When Package is selected, auto-add items to cart
    const pkgId = packageSelector ? packageSelector.value : ''
    const packagePriceEl = document.getElementById('packagePrice')

    if (pkgId) {
      console.log('🔄 Loading package items for ID:', pkgId)
      const items = await api.getPackageItems(pkgId)
      const selectedOption = packageSelector.options[packageSelector.selectedIndex]
      // ໃຊ້ລາຄາຈາກ package ໂດຍກົງ (ຈາກ database)
      const pkgPrice = parseFloat(selectedOption.dataset.price) || 0

      console.log('Package Price from dataset:', pkgPrice)
      console.log('Selected package:', selectedOption.text, 'Price:', pkgPrice)

      // Uncheck all checkboxes first
      document.querySelectorAll('.test-item').forEach(cb => cb.checked = false)

      cartItems = items.map(i => ({
        id: i.testId || i.test_id,
        name: i.testName || i.test_name || 'Unknown',
        price: i.price,
        category: ''
      }))

      console.log('Cart items from package:', cartItems)

      // Check the corresponding checkboxes - case insensitive match
      let checkedCount = 0
      cartItems.forEach(item => {
        const itemNameLower = item.name.toLowerCase().trim()
        // Try exact match first
        let checkbox = document.querySelector(`.test-item[data-name="${itemNameLower}"]`)

        // If not found, try partial match
        if (!checkbox) {
          const allCheckboxes = document.querySelectorAll('.test-item')
          allCheckboxes.forEach(cb => {
            const cbName = cb.getAttribute('data-name').toLowerCase().trim()
            if (cbName === itemNameLower) {
              checkbox = cb
            } else if (!checkbox && (cbName.includes(itemNameLower) || itemNameLower.includes(cbName))) {
              checkbox = cb
            }
          })
        }

        if (checkbox) {
          checkbox.checked = true
          checkedCount++
        }
      })

      console.log(`✓ Checked ${checkedCount}/${cartItems.length} items`)

      // ຄິດໄລ່ລາຄາ: ໃຊ້ລາຄາ Package ທີ່ຕັ້ງໄວ້ (ບໍ່ແມ່ນຜົນບວກຂອງ items)
      // ອ່ານຄ່າຈາກ packagePriceEl ທີ່ຖືກຕັ້ງໄວ້ແລ້ວ
      const displayedPkgPrice = packagePriceEl ? parseFloat(packagePriceEl.value) || 0 : 0
      finalTotal = pkgPrice > 0 ? pkgPrice : (displayedPkgPrice > 0 ? displayedPkgPrice : cartItems.reduce((sum, item) => sum + (item.price || 0), 0))

      console.log('Final Total (Package Price):', finalTotal)
      console.log('Package price from input:', displayedPkgPrice)

      // Render cart in summary
      renderCart()
      document.getElementById('totalPriceDisplay').innerText = '₭ ' + finalTotal.toLocaleString()
      return
    } else {
      // ຍັງບໍ່ທັນເລືອກ Package - Uncheck ທຸກ checkboxes ແລະ ໃຫ້ຍອດເປັນ 0
      document.querySelectorAll('.test-item').forEach(cb => cb.checked = false)
      cartItems = []
      finalTotal = packagePriceEl ? (parseFloat(packagePriceEl.value) || 0) : 0
      renderCart()
      document.getElementById('totalPriceDisplay').innerText = '₭ ' + finalTotal.toLocaleString()
      return
    }
  } else {
    packageDiv.style.display = 'none'
  }

  // Call original for Normal mode
  if (originalCalculateCart) {
    originalCalculateCart()
  }
}

// Helper to render cart
function renderCart() {
  const cartList = document.getElementById('cartList')
  const testType = document.getElementById('testType').value
  const isPackage = testType === 'Package'
  const packagePriceEl = document.getElementById('packagePrice')
  const pkgPrice = isPackage && packagePriceEl ? (parseFloat(packagePriceEl.value) || 0) : 0

  if (cartItems.length === 0) {
    cartList.innerHTML = '<li class="list-group-item text-center text-muted small">ຍັງບໍ່ມີລາຍການ</li>'
    return
  }

  if (isPackage && pkgPrice > 0) {
    // ສະແດງແບບ Package: ສະແດງລາຍການຍ່ອຍ ແຕ່ບໍ່ສະແດງລາຄາແຕ່ລະໂຕ
    cartList.innerHTML = cartItems.map((item, idx) => `
      <li class="list-group-item d-flex justify-content-between align-items-center small">
        <span>${item.name}</span>
        <div>
          <span class="text-muted me-2 small">(ໃນ Package)</span>
          <button class="btn btn-sm text-danger py-0" onclick="removeFromCart(${idx})"><i class="bi bi-x"></i></button>
        </div>
      </li>
    `).join('')
  } else {
    // ສະແດງແບບ Normal: ສະແດງລາຄາແຕ່ລະໂຕ
    cartList.innerHTML = cartItems.map((item, idx) => `
      <li class="list-group-item d-flex justify-content-between align-items-center small">
        <span>${item.name}</span>
        <div>
          <span class="text-muted me-2">₭${(item.price || 0).toLocaleString()}</span>
          <button class="btn btn-sm text-danger py-0" onclick="removeFromCart(${idx})"><i class="bi bi-x"></i></button>
        </div>
      </li>
    `).join('')
  }
}

window.removeFromCart = function(idx) {
  const testType = document.getElementById('testType').value
  const isPackage = testType === 'Package'
  const packagePriceEl = document.getElementById('packagePrice')
  const pkgPrice = isPackage && packagePriceEl ? (parseFloat(packagePriceEl.value) || 0) : 0

  cartItems.splice(idx, 1)
  renderCart()

  // ຖ້າເປັນ Package ໃຫ້ໃຊ້ລາຄາ Package, ຖ້າບໍ່ແມ່ນໃຫ້ບວກລາຄາຈາກ items
  if (isPackage && pkgPrice > 0) {
    finalTotal = pkgPrice
  } else {
    finalTotal = cartItems.reduce((sum, item) => sum + (item.price || 0), 0)
  }
  document.getElementById('totalPriceDisplay').innerText = '₭ ' + finalTotal.toLocaleString()
}
