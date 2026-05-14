import * as api from './api.js';

// --- Global Function definitions ---
async function performLogin() {
    console.log('performLogin execution started');
    const userEl = document.getElementById('loginUser');
    const passEl = document.getElementById('loginPass');
    const btn = document.getElementById('btnLogin');
    
    if (!userEl || !passEl || !btn) return;

    const u = userEl.value;
    const p = passEl.value;
    
    if (!u || !p) {
        alert('Please enter username and password');
        return;
    }

    btn.disabled = true;
    btn.innerText = 'ກຳລັງເຂົ້າລະບົບ...';

    try {
        const res = await api.loginUser(u, p);
        if (res && res.success) {
            sessionStorage.setItem('lis_user', JSON.stringify(res));
            bootApp(res);
        } else {
            alert(res?.message || 'Login failed: Invalid credentials');
        }
    } catch (e) {
        console.error('Login error:', e);
        alert('Connection error. Please try again.');
    } finally {
        btn.disabled = false;
        btn.innerText = 'ເຂົ້າສູ່ລະບົບ (Login)';
    }
}

function performLogout() {
    sessionStorage.removeItem('lis_user');
    window.location.reload();
}

function showPage(ev, id) {
    if (ev) ev.preventDefault();
    console.log('Navigating to:', id);
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
    }
    
    if (ev && ev.currentTarget) {
        ev.currentTarget.classList.add('active');
    }

    if (id === 'dashboard') {
        loadDashboard();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

function bootApp(user) {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const roleDisplay = document.getElementById('displayRole');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'flex';
    if (roleDisplay) roleDisplay.innerText = user.role || 'User';
    
    loadDashboard();
}

async function loadDashboard() {
    console.log('Init Dashboard Data...');
    try {
        const data = await api.getDashboardData();
        if (data && data.success) {
            const kpis = data.kpis;
            const pEl = document.getElementById('kpiPatients');
            const rEl = document.getElementById('kpiRev');
            if (pEl) pEl.innerText = kpis.totalPatients.toLocaleString();
            if (rEl) rEl.innerText = '₭ ' + kpis.totalRevenue.toLocaleString();
        }
    } catch (e) {
        console.error('Dashboard error:', e);
    }
}

// --- Explicit Window Attachment (Required for index.html onclick) ---
window.performLogin = performLogin;
window.performLogout = performLogout;
window.showPage = showPage;
window.toggleSidebar = toggleSidebar;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Ready. Initializing App State...');
    const savedUser = sessionStorage.getItem('lis_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            bootApp(user);
        } catch (e) {
            sessionStorage.removeItem('lis_user');
            console.error('Session parse error');
        }
    }
});
