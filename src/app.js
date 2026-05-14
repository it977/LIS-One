import * as api from './api.js';

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
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    
    if(id === 'dashboard') loadDashboard();
    if(id === 'inventoryPage') loadInventoryTable();
    if(id === 'testSetup') loadTestMasterTable();
};

window.performLogout = () => { sessionStorage.removeItem('lis_user'); window.location.reload(); };
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('collapsed');

function bootApp(user) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    document.getElementById('displayRole').innerText = (user.username || 'User') + ' (' + (user.role || 'Admin') + ')';
    loadDashboard();
}

async function loadDashboard() {
    const data = await api.getDashboardData();
    if(data.success && data.kpis) {
        if(document.getElementById('kpiPatients')) document.getElementById('kpiPatients').innerText = data.kpis.totalPatients.toLocaleString();
        if(document.getElementById('kpiRev')) document.getElementById('kpiRev').innerText = '₭ ' + data.kpis.totalRevenue.toLocaleString();
    }
}

async function loadInventoryTable() {
    const data = await api.getInventoryLots();
    const body = document.getElementById('inventoryTableBody');
    if(!body) return;
    body.innerHTML = (data || []).map(l => `
        <tr>
            <td>${l.lot_no}</td>
            <td>${l.reagent_name}</td>
            <td>${l.exp_date}</td>
            <td>${Number(l.qty).toLocaleString()}</td>
        </tr>
    `).join('');
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
                <button class="btn btn-sm btn-outline-primary py-0"><i class="bi bi-pencil"></i></button>
            </td>
        </tr>
    `).join('');
}

// STUBS
const stubs = ['addPackageTestItem','addSetting','cancelEdit','cancelEditReagent','cancelEditTest','setSetupTab','openReagentModal','loadOutlabTable'];
stubs.forEach(s => { window[s] = () => console.log('STUB:', s); });

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(sessionStorage.getItem('lis_user') || 'null');
    if (user) bootApp(user);
});
