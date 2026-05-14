import * as api from './api.js';

// --- CORE UI LOGIC ---
const Pages = {
  current: 'dashboard',
  setupTab: 'tests'
};

async function bootApp(user) {
    document.getElementById('loginScreen').style.display = 'none';
    const mainApp = document.getElementById('mainApp');
    mainApp.style.display = 'flex';
    document.getElementById('displayRole').innerText = (user.username || 'User') + ' (' + (user.role || 'Admin') + ')';
    
    // Initial Loaders
    loadDashboard();
    loadTable();
    loadSettings();
}

// --- GLOBAL EXPORTS ---
window.performLogin = async () => {
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    const btn = document.getElementById('btnLogin');
    
    if(!u || !p) return;
    btn.disabled = true;
    btn.innerText = 'Logging in...';

    try {
        const res = await api.loginUser(u, p);
        if (res && res.success) {
            sessionStorage.setItem('lis_user', JSON.stringify(res));
            bootApp(res);
        } else {
            alert(res?.message || 'Login failed');
        }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; btn.innerText = 'ເຂົ້າສູ່ລະບົບ (Login)'; }
};

window.showPage = (e, id) => {
    if (e) e.preventDefault();
    Pages.current = id;
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    
    // Find nav link to activate
    document.querySelectorAll('.nav-link').forEach(l => {
       if(l.getAttribute('onclick')?.includes(id)) l.classList.add('active');
    });

    // Page Specific Loaders
    if(id === 'dashboard') loadDashboard();
    if(id === 'inventoryPage') loadInventoryTable();
    if(id === 'testSetup') window.setSetupTab(Pages.setupTab);
    if(id === 'trackResult') window.loadOutlabTable();
};

window.setSetupTab = (tabId = 'tests') => {
    Pages.setupTab = tabId;
    document.querySelectorAll('.setup-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.setupTab === tabId);
    });
    document.querySelectorAll('.setup-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.setupPanel === tabId);
    });
    
    if(tabId === 'tests') loadTestMasterTable();
    if(tabId === 'mapping') loadMappingData();
    if(tabId === 'packages') loadPackagesTable();
    if(tabId === 'dropdowns') loadSettings();
};

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
};

window.performLogout = () => {
    sessionStorage.removeItem('lis_user');
    window.location.reload();
};

// --- DATA LOADERS ---
async function loadDashboard() {
    console.log('Dash Load...');
    const data = await api.getDashboardData();
    if(data.success) {
        document.getElementById('kpiPatients').innerText = data.kpis.totalPatients.toLocaleString();
        document.getElementById('kpiRev').innerText = '₭ ' + data.kpis.totalRevenue.toLocaleString();
    }
}

async function loadTable() { console.log('Table Load...'); await api.getRecentOrders(); }
async function loadSettings() { console.log('Settings Load...'); await api.getSettings(); }
async function loadInventoryTable() { console.log('Inventory Load...'); await api.getInventoryLots(); }
async function loadTestMasterTable() { console.log('Test Master Load...'); await api.getTestMaster(); }
async function loadMappingData() { console.log('Mapping Load...'); await api.getTestReagentMapping(); }
async function loadPackagesTable() { console.log('Packages Load...'); await api.getAllTestPackages(); }
window.loadOutlabTable = async () => { console.log('Outlab Load...'); await api.getRecentOrders(); };

// --- STUBS FOR REMAINING ONCLICK HANDLERS ---
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

stubs.forEach(s => { window[s] = () => console.log('STUB Called:', s); });

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(sessionStorage.getItem('lis_user') || 'null');
    if (user) bootApp(user);
});
