import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vblyqilhmkybzbakcyyl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibHlxaWxobWt5YnpiYWtjeXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTM4OTQ0OTcsImV4cCI6MTk2OTQ3MDQ5N30.C43S9eN5mY8X-YIDD5X1u_uT347M_E_Z7M6f_H4s7Y'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export { supabase }

export async function loginUser(u, p) {
  console.log('[PROD-FORCE-V7] AUTH ON:', SUPABASE_URL)
  const { data, error } = await supabase.from('lis_users').select('*').eq('username', u.trim()).eq('password', p.trim()).single()
  if (error || !data) return { success: false, message: 'Invalid credentials' }
  return { success: true, username: data.username, role: data.role }
}

export async function getDashboardData() {
  const { data } = await supabase.from('lis_test_orders').select('*')
  return { success: true, orders: data || [], kpis: { totalPatients: 0, totalRevenue: 0, inlabRev: 0, outlabRev: 0 }, charts: {} }
}
export async function logActivity() {}
export async function logActivityFrontend() {}
export async function getSettings() { return { VisitType: [], Insite: [], Doctor: [], Department: [], Sender: [], LabDest: [] } }
export async function addSetting() {}
export async function deleteSetting() {}
export async function getTestMaster() { return [] }
export async function searchPatientById() { return null }
export async function getAllPatients() { return [] }
export async function getPatientReportProfile() { return {} }
export async function submitTestOrder() {}
export async function getRecentOrders() { return [] }
export async function updateOrderStatus() {}
export async function deleteOrder() {}
export async function saveLabResults() {}
export async function getSavedResults() { return [] }
export async function getStockMaster() { return [] }
export async function getStockHistory() { return [] }
export async function getInventoryLots() { return [] }
export async function getMaintenanceLogs() { return [] }
export async function getTestParameters() { return [] }
export async function getTestReagentMapping() { return [] }
export async function getTestPackages() { return [] }
export async function getPackageItems() { return [] }
