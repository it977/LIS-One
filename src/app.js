import * as api from './api.js';

// --- AUTH LOGIC ---
window.performLogin = async function() {
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    const btn = document.getElementById('btnLogin');
    
    if(!u || !p) return Swal.fire('Error', 'Please enter username and password', 'error');
    
    btn.disabled = true;
    btn.innerText = 'Logging in...';
    
    try {
        const res = await api.loginUser(u, p);
        if(res.success) {
            sessionStorage.setItem('lis_user', JSON.stringify(res));
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            document.getElementById('displayRole').innerText = res.role || 'User';
            initDashboard();
        } else {
            Swal.fire('Login Failed', res.message || 'Invalid credentials', 'error');
        }
    } catch(e) {
        console.error(e);
        Swal.fire('System Error', 'Could not connect to auth server', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'ເຂົ້າສູ່ລະບົບ (Login)';
    }
};

window.performLogout = function() {
    sessionStorage.removeItem('lis_user');
    window.location.reload();
};

// --- UI NAVIGATION ---
window.showPage = function(event, id) {
    if(event) event.preventDefault();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    
    const activeLink = event?.currentTarget;
    if(activeLink) activeLink.classList.add('active');
    
    if(id === 'dashboard') initDashboard();
    if(id === 'trackResult') window.loadOutlabTable();
    if(id === 'inventoryPage') window.loadInventoryDataWithDate();
};

window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('collapsed');
};

// --- DASHBOARD ---
async function initDashboard() {
    const loader = document.getElementById('dashLoader');
    if(loader) loader.style.display = 'block';
    
    try {
        const data = await api.getDashboardData();
        if(data.success) {
            updateKPIs(data.kpis);
        }
    } catch(e) { console.error(e); }
    finally { if(loader) loader.style.display = 'none'; }
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

// --- DATA LOADERS ---
window.loadOutlabTable = async function() {
    const orders = await api.getRecentOrders();
    const outlab = Array.isArray(orders) ? orders.filter(o => o.lab_dest !== 'In-house') : [];
    // DataTable rendering should go here
    console.log('Outlab Data:', outlab);
};

window.loadInventoryDataWithDate = async function() {
    const lots = await api.getInventoryLots();
    console.log('Inventory Data:', lots);
};

// --- STARTUP ---
document.addEventListener('DOMContentLoaded', () => {
    const user = sessionStorage.getItem('lis_user');
    if(user) {
        const u = JSON.parse(user);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('displayRole').innerText = u.role || 'User';
        initDashboard();
    }
});
