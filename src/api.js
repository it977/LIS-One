// ==========================================
// SUPABASE API LAYER
// ==========================================
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Table Constants - Reverting to 'lis_' as validated in active DB
const T = {
  AUDIT: 'lis_audit_log',
  USERS: 'lis_users',
  SETTINGS: 'lis_settings',
  TESTS: 'lis_test_master',
  ORDERS: 'lis_test_orders',
  RESULTS: 'lis_test_results',
  PARAM: 'lis_test_parameters',
  PACKAGE: 'lis_test_packages',
  PKG_ITEM: 'lis_test_package_items',
  STOCK: 'lis_stock_master',
  TRANS: 'lis_stock_transactions',
  LOTS: 'lis_inventory_lots',
  MAINT: 'lis_maintenance_log',
  REAGENT: 'lis_test_reagent_mapping',
  PATIENTS: 'Patients'
}

export { supabase }

// HELPER: Log
export async function logActivity(user, action, target, details) {
  try { await supabase.from(T.AUDIT).insert([{ user_name: user, action, target, details }]) } catch (e) {}
}
export async function logActivityFrontend(user, action, target, details) {
  await logActivity(user, action, target, details)
}

// Auth
export async function loginUser(username, password) {
  const { data, error } = await supabase.from(T.USERS).select('*').eq('username', username.trim()).eq('password', password.trim()).single()
  if (error || !data) return { success: false, message: 'Invalid credentials' }
  return { success: true, username: data.username, role: data.role }
}

// Settings
export async function getSettings() {
  const { data } = await supabase.from(T.SETTINGS).select('*').order('id')
  const settings = { VisitType: [], Insite: [], Doctor: [], Department: [], Sender: [], LabDest: [] }
  if (data) data.forEach(row => { if (settings[row.type]) settings[row.type].push({ row: row.id, val: row.value }) })
  return settings
}
export async function addSetting(type, value) {
  await supabase.from(T.SETTINGS).insert([{ type, value }])
  return { success: true }
}
export async function deleteSetting(id) {
  await supabase.from(T.SETTINGS).delete().eq('id', id)
  return { success: true }
}

// Analytics / Dashboard
export async function getDashboardData() {
  try {
    const { data } = await supabase.from(T.ORDERS).select('order_datetime, status')
    return { orders: data || [] }
  } catch (e) { return { orders: [] } }
}

// Master Data
export async function getTestMaster() {
  const { data } = await supabase.from(T.TESTS).select('*').order('category').order('test_name')
  return data || []
}
export async function saveTestMaster(entry) {
  await supabase.from(T.TESTS).insert([entry])
  return { success: true }
}
export async function updateTestMaster(id, name, price, category) {
  await supabase.from(T.TESTS).update({ test_name: name, price, category }).eq('id', id)
  return { success: true }
}
export async function deleteTestMaster(id) {
  await supabase.from(T.TESTS).delete().eq('id', id)
  return { success: true }
}
export async function importTestMasterFromCSV(csvData) {
  await supabase.from(T.TESTS).delete().neq('id', 0)
  await supabase.from(T.TESTS).insert(csvData)
  return { success: true }
}

// Patients
export async function searchPatientById(id) {
  const { data } = await supabase.from(T.PATIENTS).select('*').eq('Patient_ID', id).maybeSingle()
  return data ? { patientId: data.Patient_ID, fullName: `${data.First_Name || ''} ${data.Last_Name || ''}`.trim(), gender: data.Gender, age: data.Age } : null
}
export async function getAllPatients(term) {
  const { data } = await supabase.from(T.PATIENTS).select('Patient_ID, First_Name, Last_Name').ilike('Patient_ID', term + '%').limit(10)
  return (data || []).map(d => ({ patientId: d.Patient_ID, fullName: `${d.First_Name || ''} ${d.Last_Name || ''}`.trim() }))
}
export async function getPatientReportProfile(id) {
  const { data } = await supabase.from(T.PATIENTS).select('*').eq('Patient_ID', id).maybeSingle()
  return data || {}
}

// Orders
export async function submitTestOrder(order) {
  await supabase.from(T.ORDERS).insert([order])
  return { success: true }
}
export async function getRecentOrders() {
  const { data } = await supabase.from(T.ORDERS).select('*').order('order_datetime', { ascending: false }).limit(200)
  return data || []
}
export async function updateOrderStatus(id, status) {
  await supabase.from(T.ORDERS).update({ status }).eq('order_id', id)
  return { success: true }
}
export async function deleteOrder(id) {
  await supabase.from(T.ORDERS).delete().eq('order_id', id)
  return { success: true }
}

// Results
export async function saveLabResults(results) {
  await supabase.from(T.RESULTS).insert(results)
  return { success: true }
}
export async function getSavedResults(orderId) {
  const { data } = await supabase.from(T.RESULTS).select('*').eq('order_id', orderId)
  return data || []
}

// Inventory
export async function getStockMaster() {
  const { data } = await supabase.from(T.STOCK).select('*').order('reagent_name')
  return data || []
}
export async function getStockHistory() {
  const { data } = await supabase.from(T.TRANS).select('*').order('created_at', { ascending: false })
  return data || []
}
export async function getInventoryLots() {
  const { data } = await supabase.from(T.LOTS).select('*').order('exp_date')
  return data || []
}

// Maintenance
export async function getMaintenanceLogs() {
  const { data } = await supabase.from(T.MAINT).select('*').order('log_date', { ascending: false })
  return data || []
}

// Parameters
export async function getTestParameters() {
  const { data } = await supabase.from(T.PARAM).select('*').order('test_name')
  return data || []
}

// Reagent Mapping
export async function getTestReagentMapping() {
  const { data } = await supabase.from(T.REAGENT).select('*').order('test_name')
  return data || []
}

// Packages
export async function getTestPackages() {
  const { data } = await supabase.from(T.PACKAGE).select('*').eq('is_active', true)
  return data || []
}
export async function getPackageItems(id) {
  const { data } = await supabase.from(T.PKG_ITEM).select('*').eq('package_id', id)
  return data || []
}
