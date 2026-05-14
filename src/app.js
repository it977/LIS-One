// Total frontend repair V6.2
import * as api from './api.js';

// Global error handlers
window.addEventListener('error', (e) => { console.error('[GLOBAL-ERROR]', e.message); });

// Dashboard Load logic
window.loadDashboard = async function() {
  const sDate = document.getElementById('dashStartDate')?.value;
  const eDate = document.getElementById('dashEndDate')?.value;
  const loader = document.getElementById('dashLoader');
  const content = document.getElementById('dashContent');
  
  if(loader) loader.style.display = 'block';
  if(content) content.style.display = 'none';

  const res = await api.getDashboardData(sDate, eDate);
  console.log('API: Dashboard Response:', res);
  
  if(loader) loader.style.display = 'none';
  if(content) content.style.display = 'block';
  
  if(res.success && Array.isArray(res.orders)) {
     document.getElementById('kpiPatients').innerText = res.kpis.totalPatients.toLocaleString();
     document.getElementById('kpiRev').innerText = '₭ ' + res.kpis.totalRevenue.toLocaleString();
  }
};

window.loadTable = async function() {
  const orders = await api.getRecentOrders();
  if (Array.isArray(orders)) {
     // render logic for datatable
  }
};

window.loadInventoryDataWithDate = async function() {
  const res = await api.getInventoryLots();
  if (res && Array.isArray(res)) {
      // update table
  }
};
