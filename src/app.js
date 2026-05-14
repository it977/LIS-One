import * as api from './api.js';

// Global exports for index.html
window.performLogin = async () => {
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    const btn = document.getElementById('btnLogin');
    
    if(!u || !p) return;
    btn.disabled = true;

    try {
        const res = await api.loginUser(u, p);
        if (res && res.success) {
            sessionStorage.setItem('lis_user', JSON.stringify(res));
            bootApp(res);
        } else {
            alert(res?.message || 'Login failed');
        }
    } catch (e) {
        console.error(e);
    } finally {
        btn.disabled = false;
    }
};

window.showPage = (e, id) => {
    if (e) e.preventDefault();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    if(e?.currentTarget) e.currentTarget.classList.add('active');
};

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
};

window.performLogout = () => {
    sessionStorage.removeItem('lis_user');
    window.location.reload();
};

function bootApp(user) {
    document.getElementById('loginScreen').style.display = 'none';
    const mainApp = document.getElementById('mainApp');
    mainApp.style.display = 'flex';
    document.getElementById('displayRole').innerText = user.role || 'User';
}

// Check session on load
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(sessionStorage.getItem('lis_user') || 'null');
    if (user) bootApp(user);
});
