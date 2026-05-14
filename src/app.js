import * as api from './api.js';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('App Initializing...');
    
    // Bind Login
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
        btnLogin.addEventListener('click', performLogin);
    }

    // Check existing session
    const user = JSON.parse(sessionStorage.getItem('lis_user') || 'null');
    if (user) {
        showMainApp(user);
    }
});

async function performLogin() {
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    if (!username || !password) return;

    try {
        const res = await api.loginUser(username, password);
        if (res.success) {
            sessionStorage.setItem('lis_user', JSON.stringify(res));
            showMainApp(res);
        } else {
            alert(res.message || 'Login Failed');
        }
    } catch (e) {
        console.error('Login Error:', e);
    }
}

function showMainApp(user) {
    document.getElementById('loginScreen').style.display = 'none';
    const mainApp = document.getElementById('mainApp');
    mainApp.style.display = 'flex';
    document.getElementById('displayRole').innerText = user.role || 'User';
    
    // Default to dashboard
    loadDashboard();
}

async function loadDashboard() {
    console.log('Loading Dashboard...');
    const res = await api.getDashboardData();
    // For now, just ensure UI is stable.
}

// Sidebar Navigation
window.showPage = (e, id) => {
    if (e) e.preventDefault();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
};

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
};

window.performLogout = () => {
    sessionStorage.removeItem('lis_user');
    location.reload();
};
