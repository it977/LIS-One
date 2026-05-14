console.log('--- LIS-ONE BOOT SEQUENCE START ---');

import * as api from './api.js';

// --- ROBUSTNESS WRAPPER ---
try {
    window.api = api;
    console.log('--- API MODULE LOADED ---');

    // Authentication
    window.performLogin = async function() {
        console.log('performLogin called');
        const userEl = document.getElementById('loginUser');
        const passEl = document.getElementById('loginPass');
        const btn = document.getElementById('btnLogin');
        
        if(!userEl || !passEl) {
            console.error('Login elements missing');
            return;
        }

        const u = userEl.value;
        const p = passEl.value;
        
        if(!u || !p) {
            if(window.Swal) Swal.fire('Error', 'Please enter credentials', 'error');
            else alert('Please enter credentials');
            return;
        }
        
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Logging in...';
        
        try {
            const res = await api.loginUser(u, p);
            console.log('Login Result:', res);
            if(res && res.success) {
                sessionStorage.setItem('lis_user', JSON.stringify(res));
                bootApp(res);
            } else {
                const msg = res?.message || 'Invalid credentials';
                if(window.Swal) Swal.fire('Login Failed', msg, 'error');
                else alert('Login Failed: ' + msg);
            }
        } catch(e) {
            console.error('Login Exception:', e);
        } finally {
            btn.disabled = false;
            btn.innerText = 'ເຂົ້າສູ່ລະບົບ (Login)';
        }
    };

    window.performLogout = function() {
        sessionStorage.removeItem('lis_user');
        window.location.reload();
    };

    // Navigation
    window.showPage = function(event, id) {
        console.log('Navigating to:', id);
        if(event) event.preventDefault();
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        // Deactivate all links
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        const target = document.getElementById(id);
        if(target) {
            target.classList.add('active');
            console.log('Page shown:', id);
        } else {
            console.warn('Page ID not found:', id);
        }
        
        const activeLink = event?.currentTarget;
        if(activeLink) activeLink.classList.add('active');
        
        // Contextual Loaders
        if(id === 'dashboard') initDashboard();
        if(id === 'trackResult') {
            if(window.loadOutlabTable) window.loadOutlabTable();
        }
        if(id === 'inventoryPage') {
            if(window.loadInventoryDataWithDate) window.loadInventoryDataWithDate();
        }
    };

    window.toggleSidebar = function() {
        const sb = document.getElementById('sidebar');
        if(sb) sb.classList.toggle('collapsed');
    };

    // Initialization Logic
    async function initDashboard() {
        console.log('initDashboard start');
        const loader = document.getElementById('dashLoader');
        if(loader) loader.style.display = 'block';
        
        try {
            const data = await api.getDashboardData();
            console.log('Dash Data:', data);
            if(data && data.success) {
                updateKPIs(data.kpis);
            }
        } catch(e) { console.error('Dashboard Error:', e); }
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

    function bootApp(user) {
        console.log('Booting App for:', user.username);
        const loginEl = document.getElementById('loginScreen');
        const appEl = document.getElementById('mainApp');
        const roleEl = document.getElementById('displayRole');
        
        if(loginEl) loginEl.style.display = 'none';
        if(appEl) appEl.style.display = 'block';
        if(roleEl) roleEl.innerText = user.role || 'User';
        
        initDashboard();
    }

    // Event Binding
    document.addEventListener('DOMContentLoaded', () => {
        console.log('--- DOM READY ---');
        const userStr = sessionStorage.getItem('lis_user');
        if(userStr) {
            try {
                const user = JSON.parse(userStr);
                bootApp(user);
            } catch(e) {
                console.error('Session restore failed:', e);
                sessionStorage.removeItem('lis_user');
            }
        }
    });

    console.log('--- LIS-ONE BOOT SEQUENCE DONE ---');

} catch (globalError) {
    console.error('CRITICAL BOOT FAILURE:', globalError);
}
