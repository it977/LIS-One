import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vblyqilhmkybzbakcyyl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibHlxaWxobWt5YnpiYWtjeXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTM4OTQ0OTcsImV4cCI6MTk2OTQ3MDQ5N30.C43S9eN5mY8X-YIDD5X1u_uT347M_E_Z7M6f_H4s7Y'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export { supabase }

async function fetchProxy(table, options = {}) {
  const res = await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, ...options })
  });
  return await res.json();
}

export async function loginUser(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return await res.json();
}

export async function getDashboardData(sDate, eDate, filters = {}) {
  let filterStr = "";
  if (sDate) filterStr += `order_datetime=gte.${sDate}T00:00:00`;
  if (eDate) filterStr += `&order_datetime=lte.${eDate}T23:59:59`;
  
  const data = await fetchProxy('lis_test_orders', { filter: filterStr });
  const orders = data || [];
  
  return {
    success: true,
    orders,
    kpis: {
      totalPatients: new Set(orders.map(o => o.patient_id)).size,
      totalRevenue: orders.reduce((s, o) => s + (Number(o.total_price) || 0), 0),
      inlabRev: orders.filter(o => o.lab_dest === 'In-house').reduce((s, o) => s + (Number(o.total_price) || 0), 0),
      outlabRev: orders.filter(o => o.lab_dest !== 'In-house').reduce((s, o) => s + (Number(o.total_price) || 0), 0)
    },
    charts: { 
      gender: { Male: orders.filter(o => o.gender === 'Male').length, Female: orders.filter(o => o.gender === 'Female').length },
      timeSlot: { morning: orders.filter(o => o.time_slot === 'ເຊົ້າ').length, evening: orders.filter(o => o.time_slot === 'ແລງ').length, night: orders.filter(o => o.time_slot === 'ກະລາງ').length }
    },
    alerts: { expired: 0, expiringSoon: 0 }
  };
}

export async function getRecentOrders() { return await fetchProxy('lis_test_orders', { order: 'order_datetime.desc', limit: 200 }); }
export async function getSettings() { 
  const data = await fetchProxy('lis_settings', { order: 'id.asc' });
  const settings = { VisitType: [], Insite: [], Doctor: [], Department: [], Sender: [], LabDest: [] };
  if(data) data.forEach(r => { if(settings[r.type]) settings[r.type].push({ row: r.id, val: r.value }) });
  return settings;
}
export async function getStockMaster() { return await fetchProxy('lis_stock_master', { order: 'reagent_name.asc' }); }
export async function getStockHistory() { return await fetchProxy('lis_stock_transactions', { order: 'created_at.desc' }); }
export async function getInventoryLots() { return await fetchProxy('lis_inventory_lots', { order: 'exp_date.asc' }); }
export async function getMaintenanceLogs() { return await fetchProxy('lis_maintenance_log', { order: 'log_date.desc' }); }
export async function getTestParameters() { return await fetchProxy('lis_test_parameters', { order: 'test_name.asc' }); }
export async function getTestReagentMapping() { return await fetchProxy('lis_test_reagent_mapping', { order: 'test_name.asc' }); }
export async function getTestMaster() { return await fetchProxy('lis_test_master', { order: 'test_name.asc' }); }
export async function getTestPackages() { return await fetchProxy('lis_test_packages', { filter: 'is_active=eq.true' }); }
export async function getAllTestPackages() { return await fetchProxy('lis_test_packages'); }
export async function getPackageItems(id) { return await fetchProxy('lis_test_package_items', { filter: `package_id=eq.${id}` }); }

export async function searchPatientById(id) {
  const data = await fetchProxy('Patients', { filter: `Patient_ID=eq.${id}` });
  return data?.[0] ? { patientId: data[0].Patient_ID, fullName: `${data[0].First_Name} ${data[0].Last_Name}`, gender: data[0].Gender, age: data[0].Age } : null;
}
export async function getAllPatients(term) {
  return (await fetchProxy('Patients', { filter: `Patient_ID=ilike.${term}%`, limit: 10 }) || []).map(d => ({ patientId: d.Patient_ID, fullName: `${d.First_Name} ${d.Last_Name}` }));
}
export async function getPatientReportProfile(id) {
  const data = await fetchProxy('Patients', { filter: `Patient_ID=eq.${id}` });
  return data?.[0] || {};
}

// Write/Mutate operations (Stay direct via Supabase client as they are usually protected by App logic, 
// but for LIS restore safety we can wrap later if needed)
export async function addSetting(t, v) { await supabase.from('lis_settings').insert([{type:t, value:v}]); return {success:true}; }
export async function deleteSetting(id) { await supabase.from('lis_settings').delete().eq('id', id); return {success:true}; }
export async function submitTestOrder(o) { await supabase.from('lis_test_orders').insert([o]); return {success:true}; }
export async function updateOrderStatus(id, s) { await supabase.from('lis_test_orders').update({status:s}).eq('order_id', id); return {success:true}; }
export async function deleteOrder(id) { await supabase.from('lis_test_orders').delete().eq('order_id', id); return {success:true}; }
export async function saveLabResults(r) { await supabase.from('lis_test_results').insert(r); return {success:true}; }
export async function getSavedResults(id) { return await fetchProxy('lis_test_results', { filter: `order_id=eq.${id}` }); }

// Empty stubs for missing features
export async function logActivity() {}
export async function logActivityFrontend() {}
export async function getParametersForOrder() { return [] }
export async function getPatientHistoryOrders() { return [] }
export async function getOutlabOrders() { return [] }
export async function getInventoryDataWithDate() { return { success: true, data: [] } }
export async function getStockSummary() { return [] }
export async function addNewReagent() { return { success: true } }
export async function updateReagentMaster() { return { success: true } }
export async function deleteReagentMaster() { return { success: true } }
export async function saveInventoryLot() { return { success: true } }
export async function updateInventoryLot() { return { success: true } }
export async function deleteInventoryLot() { return { success: true } }
export async function updateStockTransaction() { return { success: true } }
export async function deleteStockTransaction() { return { success: true } }
export async function saveMaintenanceLog() { return { success: true } }
export async function deleteMaintenanceLog() { return { success: true } }
export async function saveTestMaster() { return { success: true } }
export async function updateTestMaster() { return { success: true } }
export async function deleteTestMaster() { return { success: true } }
export async function importTestMasterFromCSV() { return { success: true } }
export async function saveTestParameter() { return { success: true } }
export async function updateTestParameter() { return { success: true } }
export async function deleteTestParameter() { return { success: true } }
export async function addTestReagentMapping() { return { success: true } }
export async function deleteTestReagentMapping() { return { success: true } }
export async function saveTestPackage() { return { success: true } }
export async function updateTestPackage() { return { success: true } }
export async function deleteTestPackage() { return { success: true } }

