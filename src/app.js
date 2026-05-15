import * as api from './api.js';

const Pages = { active: 'dashboard', setupTab: 'tests' };

async function bootApp(user) {
    document.getElementById('loginScreen').style.display = 'none';
    const mainApp = document.getElementById('mainApp');
    mainApp.style.display = 'flex';
    document.getElementById('displayRole').innerText = (user.username || 'User') + ' (' + (user.role || 'Admin') + ')';
    
    loadDashboard();
    window.loadTestCheckboxes();
}

window.performLogin = async () => {
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    const btn = document.getElementById('btnLogin');
    if(!u || !p) return;
    btn.disabled = true;
    try {
        const res = await api.loginUser(u, p);
        if(res && res.success) {
            sessionStorage.setItem('lis_user', JSON.stringify(res));
            bootApp(res);
        } else alert(res?.message || 'Login failed');
    } catch(e) { console.error(e); }
    finally { btn.disabled = false; }
};

window.showPage = (e, id) => {
    if (e) e.preventDefault();
    Pages.active = id;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => {
       if(l.getAttribute('onclick')?.includes(id)) l.classList.add('active');
    });

    if(id === 'dashboard') loadDashboard();
    if(id === 'inventoryPage') loadInventoryTable();
    if(id === 'testSetup') window.setSetupTab(Pages.setupTab);
    if(id === 'trackResult') window.loadOutlabTable();
    if(id === 'orderForm') window.loadTestCheckboxes();
};

window.setSetupTab = (tabId = 'tests') => {
    Pages.setupTab = tabId;
    document.querySelectorAll('.setup-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.setupTab === tabId));
    document.querySelectorAll('.setup-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.setupPanel === tabId));
    
    if(tabId === 'tests') loadTestMasterTable();
    if(tabId === 'mapping') loadMappingData();
    if(tabId === 'packages') loadPackagesTable();
    if(tabId === 'dropdowns') loadSettings();
};

window.performLogout = () => { sessionStorage.removeItem('lis_user'); window.location.reload(); };
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('collapsed');

// --- RENDERERS ---

async function loadDashboard() {
    const data = await api.getDashboardData();
    if(data.success && data.kpis) {
        if(document.getElementById('kpiPatients')) document.getElementById('kpiPatients').innerText = data.kpis.totalPatients.toLocaleString();
        if(document.getElementById('kpiRev')) document.getElementById('kpiRev').innerText = '₭ ' + data.kpis.totalRevenue.toLocaleString();
    }
}

window.loadTestCheckboxes = async function() {
    const container = document.getElementById('dynamicTestContainer');
    if(!container) return;
    container.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div></div>';
    const tests = await api.getTestMaster();
    container.innerHTML = '';
    if(!tests || tests.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted">ຍັງບໍ່ມີລາຍການກວດ</div>';
        return;
    }
    const grouped = {};
    tests.forEach(t => {
        const cat = t.category || 'Other';
        if(!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(t);
    });
    Object.keys(grouped).forEach(cat => {
        let h = `<div class="col-12"><h6 class="fw-bold mt-2"><i class="bi bi-tag-fill text-primary"></i> ${cat}</h6><div class="row g-2">`;
        grouped[cat].forEach(t => {
            h += `<div class="col-6 col-md-4 col-xl-3"><div class="border p-2 rounded"><input class="form-check-input test-item" type="checkbox" data-name="${t.name}" value="${t.price}" id="chk_${t.id}"><label class="form-check-label ms-2" for="chk_${t.id}">${t.name}</label></div></div>`;
        });
        h += '</div></div>'; container.innerHTML += h;
    });
};

async function loadTestMasterTable() {
    const data = await api.getTestMaster();
    const body = document.getElementById('masterTableBody');
    if(!body) return;
    body.innerHTML = (data || []).map(t => `<tr><td>${t.name}</td><td>${t.category}</td><td>₭ ${Number(t.price).toLocaleString()}</td></tr>`).join('');
}

async function loadInventoryTable() {
    const data = await api.getInventoryLots();
    const body = document.getElementById('inventoryTableBody');
    if(!body) return;
    body.innerHTML = (data || []).map(l => `<tr><td>${l.lot_no}</td><td>${l.reagent_name}</td><td>${l.exp_date}</td><td>${Number(l.qty).toLocaleString()}</td></tr>`).join('');
}

async function loadMappingData() {
    const data = await api.getTestReagentMapping();
    const body = document.getElementById('mappingTableBody');
    if(!body) return;
    body.innerHTML = (data || []).map(m => `<tr><td>${m.test_name}</td><td>${m.reagent_name}</td><td>${m.qty}</td></tr>`).join('');
}

async function loadPackagesTable() {
    const data = await api.getAllTestPackages();
    const body = document.getElementById('packagesTableBody');
    if(!body) return;
    body.innerHTML = (data || []).map(p => `<tr><td>${p.name}</td><td>${Number(p.price).toLocaleString()}</td><td>${p.is_active ? 'Yes' : 'No'}</td></tr>`).join('');
}

async function loadSettings() {
    const t = await api.getSettings();
    const map = { 'listVisitType':'VisitType', 'listInsite':'Insite', 'listDoctor':'Doctor', 'listDepartment':'Department', 'listSender':'Sender', 'listLabDest':'LabDest' };
    Object.entries(map).forEach(([id, type]) => {
        const el = document.getElementById(id);
        if(el) {
            el.innerHTML = '';
            (t || []).filter(s => s.type === type).forEach(s => {
                el.innerHTML += `<li class="list-group-item d-flex justify-content-between p-1 small">${s.value}</li>`;
            });
        }
    });
}

const stubs = ['addPackageTestItem','addSetting','cancelEdit','cancelEditReagent','cancelEditTest','cancelParameterEdit','closePatientHistoryDetail','exportDashboardPDF','exportHistoryData','exportInventoryData','exportTestMasterCSV','filterOutlabByDate','loadAllInventoryData','loadInventoryDataWithDate','loadMaintenanceTable','loadPatientHistoryPage','loadTimeSlotReport','openAddLotModal','openPackageModal','openReagentModal','printTubeLabel','processCSVImport','reloadLabResultFrame','resetDashboardFilters','resetInventoryDateFilter','resetOutlabFilter','saveInvLotEdit','saveMapping','savePackage','saveParameter','saveReagentMaster','saveStockHistoryEdit','saveTestMaster','setDashDate','showImportCSVModal','showInventoryAlerts','submitData','submitInventoryLot','submitMaintenance','toggleSummaryTableDashboard'];
stubs.forEach(s => { if(!window[s]) window[s] = () => console.log('STUB:', s); });

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(sessionStorage.getItem('lis_user') || 'null');
    if (user) bootApp(user);
});
