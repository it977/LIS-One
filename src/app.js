import * as api from './api.js';

// --- STATE ---
const Pages = { active: 'dashboard', setupTab: 'tests' };

// --- BOOT ---
async function bootApp(user) {
    document.getElementById('loginScreen').style.display = 'none';
    const mainApp = document.getElementById('mainApp');
    mainApp.style.display = 'flex';
    document.getElementById('displayRole').innerText = (user.username || 'User') + ' (' + (user.role || 'Admin') + ')';
    
    // Initial Loaders
    loadDashboard();
    loadTestCheckboxes();
}

// --- GLOBAL EXPORTS (index.html onclick handlers) ---
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
    
    // Activate nav link
    document.querySelectorAll('.nav-link').forEach(l => {
       if(l.getAttribute('onclick')?.includes(id)) l.classList.add('active');
    });

    if(id === 'dashboard') loadDashboard();
    if(id === 'inventoryPage') loadInventoryTable();
    if(id === 'testSetup') window.setSetupTab(Pages.setupTab);
    if(id === 'trackResult') loadOutlabTable();
    if(id === 'paramSetupPage') loadParamSetupData();
    if(id === 'orderForm') loadTestCheckboxes();
};

window.setSetupTab = (tabId = 'tests') => {
    console.log('setSetupTab:', tabId);
    Pages.setupTab = tabId;
    
    // Switch button appearance
    document.querySelectorAll('.setup-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.setupTab === tabId);
    });
    
    // Switch panel visibility
    document.querySelectorAll('.setup-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.setupPanel === tabId);
    });
    
    // Load data for the active tab
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
    if(data.success && data.kpis) {
        if(document.getElementById('kpiPatients')) document.getElementById('kpiPatients').innerText = data.kpis.totalPatients.toLocaleString();
        if(document.getElementById('kpiRev')) document.getElementById('kpiRev').innerText = '₭ ' + data.kpis.totalRevenue.toLocaleString();
    }
}

window.loadTestCheckboxes = async function() {
    console.log('loadTestCheckboxes()');
    const container = document.getElementById('dynamicTestContainer');
    if(!container) return;
    
    container.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div></div>';
    
    const tests = await api.getTestMaster();
    container.innerHTML = '';
    
    if(!tests || tests.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted">ຍັງບໍ່ມີລາຍການກວດ</div>';
        return;
    }
    
    // Group by category
    const grouped = {};
    tests.forEach(t => {
        const cat = t.category || 'Other';
        if(!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(t);
    });
    
    Object.keys(grouped).forEach(cat => {
        let html = `<div class="col-12 test-category-group"><h6 class="fw-bold"><i class="bi bi-tag-fill me-2"></i>${cat}</h6><div class="row g-2">`;
        grouped[cat].forEach(t => {
            html += `
                <div class="col-xl-3 col-lg-4 col-md-6 col-6">
                    <div class="test-item-card border p-2 rounded">
                        <input class="form-check-input test-item" type="checkbox" data-name="${t.name}" data-cat="${t.category}" value="${t.price}" id="chk_${t.id}">
                        <label class="form-check-label" for="chk_${t.id}">${t.name} <br> <small class="text-danger">₭ ${Number(t.price).toLocaleString()}</small></label>
                    </div>
                </div>`;
        });
        html += `</div></div>`;
        container.innerHTML += html;
    });
    
    // Attach event listeners to checkboxes for cart calculation
    document.querySelectorAll('.test-item').forEach(chk => {
        chk.addEventListener('change', () => {
            if(window.calculateCart) window.calculateCart();
        });
    });
};

// Cart Calculation Stub (to be implemented more fully later)
window.calculateCart = function() {
    let total = 0;
    const cartList = document.getElementById('cartList');
    if(cartList) cartList.innerHTML = '';
    
    document.querySelectorAll('.test-item:checked').forEach(chk => {
        const price = Number(chk.value);
        total += price;
        if(cartList) {
            cartList.innerHTML += `<li class="list-group-item d-flex justify-content-between"><span>${chk.dataset.name}</span> <span>₭ ${price.toLocaleString()}</span></li>`;
        }
    });
    
    const display = document.getElementById('totalPriceDisplay');
    if(display) display.innerText = '₭ ' + total.toLocaleString();
};

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
                <button class="btn btn-sm btn-outline-primary py-0"><i class="bi bi-pencil"></i></button>
            </td>
        </tr>
    `).join('');
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
    body.innerHTML = (data || []).map(p => `<tr><td>${p.name}</td><td>${p.price.toLocaleString()}</td><td>${p.is_active ? 'Active':'Inactive'}</td></tr>`).join('');
}

async function loadSettings() {
    const data = await api.getSettings();
    // settings render logic...
}

async function loadParamSetupData() {
    const data = await api.getTestParameters();
    const body = document.getElementById('paramTableBody');
    if(!body) return;
    body.innerHTML = (data || []).map(p => `<tr><td>${p.test_name}</td><td>${p.param_name}</td><td>${p.unit}</td><td>${p.normal_min}-${p.normal_max}</td></tr>`).join('');
}

// OTHER STUBS
const stubs = ['addPackageTestItem','addSetting','cancelEdit','cancelEditReagent','cancelEditTest','cancelParameterEdit','closePatientHistoryDetail','exportDashboardPDF','exportHistoryData','exportInventoryData','exportTestMasterCSV','filterOutlabByDate','loadAllInventoryData','loadInventoryDataWithDate','loadMaintenanceTable','loadPatientHistoryPage','loadTimeSlotReport','openAddLotModal','openPackageModal','openReagentModal','printTubeLabel','processCSVImport','reloadLabResultFrame','resetDashboardFilters','resetInventoryDateFilter','resetOutlabFilter','saveInvLotEdit','saveMapping','savePackage','saveParameter','saveReagentMaster','saveStockHistoryEdit','saveTestMaster','setDashDate','showImportCSVModal','showInventoryAlerts','submitData','submitInventoryLot','submitMaintenance','toggleSummaryTableDashboard'];
stubs.forEach(s => { if(!window[s]) window[s] = () => console.log('STUB:', s); });

// --- STARTUP ---
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(sessionStorage.getItem('lis_user') || 'null');
    if (user) bootApp(user);
});
