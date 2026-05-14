import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export { supabase }

// Activity Log
export async function logActivity(user, action, target, details) {
  try {
    await supabase.from('lis_one_audit_log').insert([{ user_name: user, action, target, details }])
  } catch (e) { console.error(e) }
}
export async function logActivityFrontend(user, action, target, details) {
  await logActivity(user, action, target, details)
}

// Auth
export async function loginUser(username, password) {
  const { data, error } = await supabase.from('lis_one_users').select('*').eq('username', username.trim()).eq('password', password.trim()).single()
  if (error || !data) return { success: false, message: 'Invalid credentials' }
  return { success: true, username: data.username, role: data.role }
}

// Settings
export async function getSettings() {
  const { data, error } = await supabase.from('lis_one_settings').select('*').order('id')
  if (error) return {}
  const settings = { VisitType: [], Insite: [], Doctor: [], Department: [], Sender: [], LabDest: [] }
  data.forEach(row => { if (settings[row.type]) settings[row.type].push({ row: row.id, val: row.value }) })
  return settings
}
export async function addSetting(type, value) {
  await supabase.from('lis_one_settings').insert([{ type, value }])
  return { success: true }
}
export async function deleteSetting(id) {
  await supabase.from('lis_one_settings').delete().eq('id', id)
  return { success: true }
}

// Test Master
export async function getTestMaster() {
  const { data, error } = await supabase.from('lis_one_test_master').select('*').order('category').order('name')
  return data || []
}
export async function saveTestMaster(entry) {
  await supabase.from('lis_one_test_master').insert([entry])
  return { success: true }
}
export async function updateTestMaster(id, name, price, category) {
  await supabase.from('lis_one_test_master').update({ name, price, category }).eq('id', id)
  return { success: true }
}
export async function deleteTestMaster(id) {
  await supabase.from('lis_one_test_master').delete().eq('id', id)
  return { success: true }
}
export async function importTestMasterFromCSV(csvData) {
  await supabase.from('lis_one_test_master').delete().neq('id', 0)
  await supabase.from('lis_one_test_master').insert(csvData)
  return { success: true }
}

// Patients (HIS)
export async function searchPatientById(id) {
  const { data } = await supabase.from('HIS_One_Patients').select('*').eq('Patient_ID', id).maybeSingle()
  return data ? { patientId: data.Patient_ID, fullName: `${data.First_Name} ${data.Last_Name}`, gender: data.Gender, age: data.Age } : null
}
export async function getAllPatients(term) {
  const { data } = await supabase.from('HIS_One_Patients').select('*').ilike('Patient_ID', term + '%').limit(10)
  return (data || []).map(d => ({ patientId: d.Patient_ID, fullName: `${d.First_Name} ${d.Last_Name}` }))
}
export async function getPatientReportProfile(id) {
  const { data } = await supabase.from('HIS_One_Patients').select('*').eq('Patient_ID', id).maybeSingle()
  return data || {}
}

// Packages
export async function getTestPackages() {
  const { data } = await supabase.from('lis_one_test_packages').select('*').eq('is_active', true)
  return data || []
}
export async function getAllTestPackages() {
  const { data } = await supabase.from('lis_one_test_packages').select('*')
  return data || []
}
export async function saveTestPackage(pkg) {
  const { data } = await supabase.from('lis_one_test_packages').insert([pkg]).select().single()
  return { success: true, data }
}
export async function updateTestPackage(id, pkg) {
  await supabase.from('lis_one_test_packages').update(pkg).eq('id', id)
  return { success: true }
}
export async function deleteTestPackage(id) {
  await supabase.from('lis_one_test_packages').delete().eq('id', id)
  return { success: true }
}
export async function getPackageItems(id) {
  const { data } = await supabase.from('lis_one_test_package_items').select('*').eq('package_id', id)
  return data || []
}

// Inventory/Stock (Placeholders for missing exports)
export async function getStockMaster() { return [] }
export async function addNewReagent() { return { success: true } }
export async function updateReagentMaster() { return { success: true } }
export async function deleteReagentMaster() { return { success: true } }
export async function saveInventoryLot() { return { success: true } }
export async function getInventoryDataWithDate() { return [] }
export async function updateInventoryLot() { return { success: true } }
export async function deleteInventoryLot() { return { success: true } }
export async function getStockHistory() { return [] }
export async function getStockSummary() { return [] }
export async function updateStockTransaction() { return { success: true } }
export async function deleteStockTransaction() { return { success: true } }

// Maintenance
export async function getMaintenanceLogs() { return [] }
export async function saveMaintenanceLog() { return { success: true } }
export async function deleteMaintenanceLog() { return { success: true } }

// Orders/Results
export async function submitTestOrder() { return { success: true } }
export async function getRecentOrders() { return [] }
export async function getOutlabOrders() { return [] }
export async function updateOrderStatus() { return { success: true } }
export async function deleteOrder() { return { success: true } }
export async function getPatientHistoryOrders() { return [] }
export async function getSavedResults() { return [] }
export async function saveLabResults() { return { success: true } }
export async function getTestParameters() { return [] }
export async function saveTestParameter() { return { success: true } }
export async function updateTestParameter() { return { success: true } }
export async function deleteTestParameter() { return { success: true } }
export async function getParametersForOrder() { return [] }
export async function getTestReagentMapping() { return [] }
export async function addTestReagentMapping() { return { success: true } }
export async function deleteTestReagentMapping() { return { success: true } }
export async function getDashboardData() { return {} }