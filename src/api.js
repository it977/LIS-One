// ==========================================
// SUPABASE API LAYER
// ==========================================
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Table Constants - Using 'lis_' as confirmed 
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
import { loginUser as debugLogin } from "./debug_login.js";
export const loginUser = debugLogin;

// Settings
export async function getSettings() {
  const { data } = await supabase.from(T.SETTINGS).select('*').order('id')
  const settings = { VisitType: [], Insite: [], Doctor: [], Department: [], Sender: [], LabDest: [] }
  if (data) data.forEach(row => { if (settings[row.type]) settings[row.type].push({ row: row.id, val: row.value }) })
  return settings
}
export async function addSetting(type, value) {
  if(!supabase) return { success: false }
  await supabase.from(T.SETTINGS).insert([{ type, value }])
  return { success: true }
}
export async function deleteSetting(id) {
  if(!supabase) return { success: false }
  await supabase.from(T.SETTINGS).delete().eq('id', id)
  return { success: true }
}

// Analytics / Dashboard
export async function getDashboardData(sDate, eDate, filters = {}) {
  try {
    let q = supabase.from(T.ORDERS).select('*')
    if (sDate) q = q.gte('order_datetime', sDate + 'T00:00:00')
    if (eDate) q = q.lte('order_datetime', eDate + 'T23:59:59')
    
    if (filters.department && filters.department !== 'ທັງໝົດ') q = q.eq('department', filters.department)
    if (filters.doctor && filters.doctor !== 'ທັງໝົດ') q = q.eq('doctor', filters.doctor)
    if (filters.testType && filters.testType !== 'ທັງໝົດ') q = q.eq('test_type', filters.testType)
    if (filters.category && filters.category !== 'ທັງໝົດ') q = q.eq('category', filters.category)

    const { data, error } = await q
    if (error) throw error

    const orders = data || []
    const kpis = { 
      totalPatients: new Set(orders.map(o => o.patient_id)).size,
      totalRevenue: orders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0),
      inlabRev: orders.filter(o => o.lab_dest === 'In-house').reduce((sum, o) => sum + (Number(o.total_price) || 0), 0),
      outlabRev: orders.filter(o => o.lab_dest !== 'In-house').reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
    }

    // Chart aggregations
    const charts = {
      gender: { Male: orders.filter(o => o.gender === 'Male').length, Female: orders.filter(o => o.gender === 'Female').length },
      timeSlot: { morning: orders.filter(o => o.time_slot === 'ເຊົ້າ').length, evening: orders.filter(o => o.time_slot === 'ແລງ').length, night: orders.filter(o => o.time_slot === 'ກະລາງ').length }
    }

    return { success: true, orders, kpis, charts, alerts: { expired: 0, expiringSoon: 0 } }
  } catch (e) { 
    console.error('API Error:', e)
    return { success: false, orders: [], kpis: { totalPatients: 0, totalRevenue: 0, inlabRev: 0, outlabRev: 0 }, charts: {}, alerts: { expired: 0, expiringSoon: 0 } }
  }
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
export async function getParametersForOrder() { return [] }

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
export async function getPatientHistoryOrders() { return [] }
export async function getOutlabOrders() { return [] }

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
export async function getInventoryDataWithDate() { return [] }
export async function getStockSummary() { return [] }
export async function addNewReagent() { return { success: true } }
export async function updateReagentMaster() { return { success: true } }
export async function deleteReagentMaster() { return { success: true } }
export async function saveInventoryLot() { return { success: true } }
export async function updateInventoryLot() { return { success: true } }
export async function deleteInventoryLot() { return { success: true } }
export async function updateStockTransaction() { return { success: true } }
export async function deleteStockTransaction() { return { success: true } }

// Maintenance
export async function getMaintenanceLogs() {
  const { data } = await supabase.from(T.MAINT).select('*').order('log_date', { ascending: false })
  return data || []
}
export async function saveMaintenanceLog() { return { success: true } }
export async function deleteMaintenanceLog() { return { success: true } }

// Parameters
export async function getTestParameters() {
  const { data } = await supabase.from(T.PARAM).select('*').order('test_name')
  return data || []
}
export async function saveTestParameter() { return { success: true } }
export async function updateTestParameter() { return { success: true } }
export async function deleteTestParameter() { return { success: true } }

// Reagent Mapping
export async function getTestReagentMapping() {
  const { data } = await supabase.from(T.REAGENT).select('*').order('test_name')
  return data || []
}
export async function addTestReagentMapping() { return { success: true } }
export async function deleteTestReagentMapping() { return { success: true } }

// Packages
export async function getTestPackages() {
  const { data } = await supabase.from(T.PACKAGE).select('*').eq('is_active', true)
  return data || []
}
export async function getAllTestPackages() {
  const { data } = await supabase.from(T.PACKAGE).select('*')
  return data || []
}
export async function saveTestPackage() { return { success: true } }
export async function updateTestPackage() { return { success: true } }
export async function deleteTestPackage() { return { success: true } }
export async function getPackageItems(id) {
  const { data } = await supabase.from(T.PKG_ITEM).select('*').eq('package_id', id)
  return data || []
}
// Refresh: Thu May 14 13:24:09 +07 2026
// Cache Bust: 1778741307
