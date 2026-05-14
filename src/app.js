console.log('LIS-ONE APP.JS LOADED: ' + new Date().toISOString());

import * as api from './api.js';

// Global error capture
window.onerror = function(message, source, lineno, colno, error) {
    console.error('GLOBAL ERROR:', message, 'at', source, lineno, colno);
    // Force show app if crashed but loggged in
    const user = sessionStorage.getItem('lis_user');
    if(user) {
        const main = document.getElementById('mainApp');
        if(main) main.style.display = 'block';
    }
};

async function initDashboard() {
    console.log('initDashboard()');
    const loader = document.getElementById('dashLoader');
    if(loader) loader.style.display = 'block';
    
    try {
        const data = await api.getDashboardData();
        console.log('api.getDashboardData() success:', !!data);
        if(data && data.success) {
            updateKPIs(data.kpis);
        }
    } catch(e) {
        console.error('initDashboard Error:', e);
    } finally {
        if(loader) loader.style.display = 'none';
        const content = document.getElementById('dashContent');
        if(content) content.style.display = 'block';
    }
}

function updateKPIs(kpis) {
    if(!kpis) return;
    const targets = {
        'kpiPatients': kpis.totalPatients,
        'kpiRev': '₭ ' + (kpis.totalRevenue || 0).toLocaleString(),
        'kpiInlab': '₭ ' + (kpis.inlabRev || 0).toLocaleString(),
        'kpiOutlab': '₭ ' + (kpis.outlabRev || 0).toLocaleString()
    };
    for(const [id, val] of Object.entries(targets)) {
        const el = document.getElementById(id);
        if(el) el.innerText = val;
    }
}

window.bootApp = function(user) {
    console.log('bootApp() for user:', user.username);
    const login = document.getElementById('loginScreen');
    const app = document.getElementById('mainApp');
    const role = document.getElementById('displayRole');
    
    if(login) login.style.display = 'none';
    if(app) {
        app.style.display = 'flex'; // Use flex as per style.css
        console.log('mainApp display set to flex');
    }
    if(role) role.innerText = user.role || 'User';
    
    initDashboard();
}

window.performLogin = async function() {
    const btn = document.getElementById('btnLogin');
    const u = document.getElementById('loginUser')?.value;
    const p = document.getElementById('loginPass')?.value;
    
    if(!u || !p) return alert('Enter credentials');
    
    if(btn) {
        btn.disabled = true;
        btn.innerText = 'ກຳລັງກວດສອບ...';
    }

    try {
        const res = await api.loginUser(u, p);
        if(res && res.success) {
            sessionStorage.setItem('lis_user', JSON.stringify(res));
            window.bootApp(res);
        } else {
            alert(res?.message || 'Login Failed');
        }
    } catch(e) {
        console.error('Login Error:', e);
        alert('Server Error');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerText = '[V6_FIX] [SECURE_API] ເຂົ້າສູ່ລະບົບ (Login)';
        }
    }
}

window.showPage = function(ev, id) {
    if(ev) ev.preventDefault();
    console.log('showPage:', id);
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    
    if(ev?.currentTarget) ev.currentTarget.classList.add('active');
    
    if(id === 'dashboard') initDashboard();
}

window.toggleSidebar = function() {
    const s = document.getElementById('sidebar');
    if(s) s.classList.toggle('collapsed');
}

window.performLogout = function() {
    sessionStorage.removeItem('lis_user');
    window.location.reload();
}

// Entry Point
(function init() {
    console.log('Self-invoking init()');
    const user = sessionStorage.getItem('lis_user');
    if(user) {
        try {
            console.log('Stored session found');
            const data = JSON.parse(user);
            // We use a slight delay to ensure DOM is fully ready since we are a module
            setTimeout(() => window.bootApp(data), 100);
        } catch(e) {
            sessionStorage.removeItem('lis_user');
        }
    } else {
        console.log('No stored session');
    }
})();
