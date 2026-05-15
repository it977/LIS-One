import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vblyqilhmkybzbakcyyl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibHlxaWxobWt5YnpiYWtjeXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTM4OTQ0OTcsImV4cCI6MTk2OTQ3MDQ5N30.C43S9eN5mY8X-YIDD5X1u_uT347M_E_Z7M6f_H4s7Y'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export { supabase }

async function fetchProxy(table, options = {}) {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, ...options })
    });
    if (!res.ok) return { success: false, data: [] };
    const json = await res.json();
    return { success: json.success, data: Array.isArray(json.data) ? json.data : [] };
  } catch (e) {
    console.error('API Fetch Error:', e);
    return { success: false, data: [] };
  }
}

async function mutateProxy(action, table, payload) {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, table, payload })
    });
    return await res.json();
  } catch (e) { return { success: false, error: e.message }; }
}

export async function loginUser(username, password) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return await res.json();
  } catch (e) { return { success: false }; }
}

export async function getDashboardData(sDate, eDate, filters = {}) {
  let filterStr = "";
  if (sDate) filterStr += `order_datetime=gte.${sDate}T00:00:00`;
  if (eDate) filterStr += `&order_datetime=lte.${eDate}T23:59:59`;
  
  const res = await fetchProxy('lis_one_test_orders', { filter: filterStr });
  const orders = res.data;
  
  return { 
    success: true, 
    orders,
    kpis: {
      totalPatients: new Set(orders.map(o => o.patient_id)).size,
      totalRevenue: orders.reduce((s, o) => s + (Number(o.total_price) || 0), 0),
      inlabRev: orders.filter(o => o.lab_dest === 'In-house').reduce((s, o) => s + (Number(o.total_price) || 0), 0),
      outlabRev: orders.filter(o => o.lab_dest !== 'In-house').reduce((s, o) => s + (Number(o.total_price) || 0), 0)
    }
  };
}

export async function getRecentOrders() { const res = await fetchProxy('lis_one_test_orders', { order: 'order_datetime.desc', limit: 200 }); return res.data; }
export async function getSettings() { const res = await fetchProxy('lis_one_settings', { order: 'id.asc' }); return res.data; }
export async function getStockMaster() { const res = await fetchProxy('lis_one_stock_master', { order: 'name.asc' }); return res.data; }
export async function getInventoryLots() { const res = await fetchProxy('lis_one_inventory_lots', { order: 'exp_date.asc' }); return res.data; }
export async function getMaintenanceLogs() { const res = await fetchProxy('lis_one_maintenance_log', { order: 'log_date.desc' }); return res.data; }
export async function getTestParameters() { const res = await fetchProxy('lis_one_test_parameters', { order: 'test_name.asc' }); return res.data; }
export async function getTestMaster() { const res = await fetchProxy('lis_one_test_master', { order: 'name.asc' }); return res.data; }
export async function getAllTestPackages() { const res = await fetchProxy('lis_one_test_packages'); return res.data; }
export async function getTestReagentMapping() { const res = await fetchProxy('lis_one_test_reagent_mapping', { order: 'test_name.asc' }); return res.data; }

// Mutators via Proxy
export async function addSetting(t, v) { return await mutateProxy('insert', 'lis_one_settings', [{type:t, value:v}]); }
export async function deleteSetting(id) { return await mutateProxy('delete', 'lis_one_settings', { id }); }
export async function saveTestMaster(data) { return await mutateProxy('insert', 'lis_one_test_master', [data]); }

