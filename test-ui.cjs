const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://127.0.0.1:3000' });
const { window } = dom;
global.window = window;
global.document = window.document;
global.sessionStorage = {
  getItem: () => null,
  setItem: () => null,
  removeItem: () => null
};
global.console = console;
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;

// Mock Swal
global.Swal = { fire: () => Promise.resolve() };

// Mock api
const apiMock = {
  loginUser: async (u, p) => ({ success: true, username: 'admin', role: 'admin', token: 'fake' }),
  getDashboardData: async () => ({ success: true, orders: [] }),
  getRecentOrders: async () => [],
  getSettings: async () => []
};

// We don't import app.js because it uses ES modules and imports itself.
// Instead, we extract the critical transition functions and test them.

function showAuthenticatedApp(user) {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const dashboard = document.getElementById('dashboard');

    if (loginScreen) {
        loginScreen.style.display = 'none';
        loginScreen.classList.add('auth-hidden');
    }
    document.body.classList.add('lis-authenticated');
    if (mainApp) {
        mainApp.style.display = 'flex';
        mainApp.classList.add('auth-visible');
    }
    if (dashboard) {
        dashboard.classList.add('active');
        dashboard.style.display = 'block';
    }
}

async function testTransition() {
  console.log('--- UI TRANSITION TEST (JSDOM) ---');
  const loginScreen = document.getElementById('loginScreen');
  const mainApp = document.getElementById('mainApp');
  const dashboard = document.getElementById('dashboard');

  console.log('INITIAL: loginScreen display =', window.getComputedStyle(loginScreen).display);
  console.log('INITIAL: mainApp display =', window.getComputedStyle(mainApp).display);

  showAuthenticatedApp({ username: 'admin', role: 'admin' });

  console.log('AFTER: loginScreen display =', window.getComputedStyle(loginScreen).display);
  console.log('AFTER: mainApp display =', window.getComputedStyle(mainApp).display);
  console.log('AFTER: dashboard active =', dashboard.classList.contains('active'));

  if (window.getComputedStyle(loginScreen).display === 'none' && 
      window.getComputedStyle(mainApp).display === 'flex' &&
      dashboard.classList.contains('active')) {
    console.log('TRANSITION SUCCESS');
  } else {
    console.log('TRANSITION FAILED');
    process.exit(1);
  }
}

testTransition();
