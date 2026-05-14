import * as api from './api.js';

// Global error tracking
window.errors = [];
window.onerror = function(msg) { window.errors.push(msg); console.error('[APP]', msg); };

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('LIS-One Initialize...');
    if(window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
        initDashboard();
    }
});

async function initDashboard() {
    const loader = document.getElementById('dashLoader');
    if(loader) loader.style.display = 'block';
    
    try {
        const data = await api.getDashboardData();
        console.log('Dashboard Data Loaded:', data);
        
        if(data.success) {
            updateKPIs(data.kpis);
            renderDashboardCharts(data.charts);
        }
    } catch(e) {
        console.error('Dash Init Failed:', e);
    } finally {
        if(loader) loader.style.display = 'none';
        const content = document.getElementById('dashContent');
        if(content) content.style.display = 'block';
    }
}

function updateKPIs(kpis) {
    if(!kpis) return;
    const map = {
        'kpiPatients': kpis.totalPatients,
        'kpiRev': '₭ ' + (kpis.totalRevenue || 0).toLocaleString(),
        'kpiInlab': '₭ ' + (kpis.inlabRev || 0).toLocaleString(),
        'kpiOutlab': '₭ ' + (kpis.outlabRev || 0).toLocaleString()
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if(el) el.innerText = val;
    });
}

function renderDashboardCharts(charts) {
    // Placeholder - assuming Chart.js is used or simple bars
    console.log('Charts to render:', charts);
}

// Global Exports
window.loadOutlabTable = async () => {
    const orders = await api.getRecentOrders();
    const outlab = Array.isArray(orders) ? orders.filter(o => o.lab_dest !== 'In-house') : [];
    renderTable('outlabTableBody', outlab);
};

window.loadInventoryDataWithDate = async () => {
    const lots = await api.getInventoryLots();
    renderTable('inventoryTableBody', Array.isArray(lots) ? lots : []);
};

window.loadPackagesTable = async () => {
    const pkgs = await api.getAllTestPackages();
    renderTable('packagesTableBody', Array.isArray(pkgs) ? pkgs : []);
};

function renderTable(id, data) {
    const body = document.getElementById(id);
    if(!body) return;
    if(!Array.isArray(data)) {
        body.innerHTML = '<tr><td colspan="100%" class="text-center">No data found</td></tr>';
        return;
    }
    body.innerHTML = data.length ? '' : '<tr><td colspan="100%" class="text-center">No data loaded</td></tr>';
    // Table content generation logic goes here
}

export { initDashboard };
