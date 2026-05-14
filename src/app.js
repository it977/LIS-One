import * as api from './api.js';

// --- STATE ---
const Pages = { active: 'dashboard', setupTab: 'tests' };

// --- BOOT ---
async function bootApp(user) {
    document.getElementById('loginScreen').style.display = 'none';
    const mainApp = document.getElementById('mainApp');
    mainApp.style.display = 'flex';
    document.getElementById('displayRole').innerText = (user.username || 'User') + ' (' + (user.role || 'Admin') + ')';
    
    // Initial Load
    loadDashboard();
}

// --- GLOBAL EXPORTS (index.html) ---
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
    if(id === 'trackResult') loadOutlabTable();
    if(id === 'paramSetupPage') loadParamSetupData();
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

window.performLogout = () => {
    sessionStorage.removeItem('lis_user');
    window.location.reload();
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('collapsed');

// --- DATA RENDERERS ---
async function loadDashboard() {
    const data = await api.getDashboardData();
    if(data.success) {
        document.getElementById('kpiPatients').innerText = data.kpis.totalPatients.toLocaleString();
        document.getElementById('kpiRev').innerText = '₭ ' + data.kpis.totalRevenue.toLocaleString();
    }
}

async function loadTestMasterTable() {
    const data = await api.getTestMaster();
    const body = document.getElementById('testMasterTableBody');
    if(!body) return;
    body.innerHTML = (data || []).map(t => `
        <tr>
            <td class="ps-3">${t.id}</td>
            <td>${t.name}</td>
            <td>${t.category}</td>
            <td class="text-end pe-3">${Number(t.price).toLocaleString()} ₭</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary py-0" onclick="editTestMaster(${t.id})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger py-0" onclick="deleteTestMaster(${t.id})"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// STUBS
const stubs = [
  'addPackageTestItem','addSetting','cancelEdit','cancelEditReagent','cancelEditTest',
  'cancelParameterEdit','closePatientHistoryDetail','exportDashboardPDF','exportHistoryData',
  'exportInventoryData','exportTestMasterCSV','filterOutlabByDate','loadAllInventoryData',
  'loadDashboard','loadInventoryDataWithDate','loadMaintenanceTable',
  'loadPatientHistoryPage','loadTestCheckboxes','loadTimeSlotReport','openAddLotModal',
  'openPackageModal','openReagentModal','printTubeLabel','processCSVImport',
  'reloadLabResultFrame','resetDashboardFilters','resetInventoryDateFilter','resetOutlabFilter',
  'saveInvLotEdit','saveMapping','savePackage','saveParameter','saveReagentMaster',
  'saveStockHistoryEdit','saveTestMaster','setDashDate','showImportCSVModal',
  'showInventoryAlerts','submitData','submitInventoryLot','submitMaintenance',
  'toggleSummaryTableDashboard'
];
stubs.forEach(s => { window[s] = () => console.log('STUB:', s); });

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(sessionStorage.getItem('lis_user') || 'null');
    if (user) bootApp(user);
});

// Real data loaders used by showPage
async function loadInventoryTable() {
    const data = await api.getInventoryLots();
    const body = document.getElementById('inventoryTableBody');
    if(!body) return;
    body.innerHTML = (data || []).map(l => `
        <tr>
            <td>${l.lot_number}</td>
            <td>${l.reagent_name}</td>
            <td>${l.exp_date}</td>
            <td>${l.stock_qty}</td>
        </tr>
    `).join('');
}
async function loadOutlabTable() { await api.getRecentOrders(); }
async function loadMappingData() { await api.getTestReagentMapping(); }
async function loadPackagesTable() { await api.getAllTestPackages(); }
async function loadSettings() { await api.getSettings(); }
async function loadParamSetupData() { await api.getTestParameters(); }
