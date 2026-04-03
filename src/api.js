// ==========================================
// SUPABASE API LAYER
// àº—àº³à»œà»‰àº²àº—àºµà»ˆà»àº—àº™ google.script.run àº—àº±àº‡à»àº»àº”
// ==========================================
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('[API] SUPABASE_URL:', SUPABASE_URL ? 'âœ… Loaded' : 'âŒ Missing')
console.log('[API] SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'âœ… Loaded' : 'âŒ Missing')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[API] ERROR: Supabase credentials not loaded! Check .env file')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ==========================================
// HELPER: LOG ACTIVITY
// ==========================================
async function logActivity(user, action, target, details) {
  try {
    await supabase.from('lis_audit_log').insert([{ user_name: user, action, target, details }])
  } catch (e) { /* àºšà»à»ˆ block àº–à»‰àº² log àº¥àº»à»‰àº¡à»€àº«àº¼àº§ */ }
}

// ==========================================
// AUTH
// ==========================================
export async function loginUser(username, password) {
  try {
    const { data, error } = await supabase
      .from('lis_users')
      .select('username, password, role')
      .eq('username', username.trim())
      .eq('password', password.trim())
      .single()
    if (error || !data) return { success: false, message: 'Username àº«àº¼àº· Password àºšà»à»ˆàº–àº·àºàº•à»‰àº­àº‡!' }
    await logActivity(data.username, 'Login', 'System', 'à»€àº‚àº»à»‰àº²àºªàº¹à»ˆàº¥àº°àºšàº»àºš')
    return { success: true, username: data.username, role: data.role }
  } catch (e) { return { success: false, message: e.message } }
}

export async function logActivityFrontend(user, action, target, details) {
  await logActivity(user, action, target, details)
}

// ==========================================
// SETTINGS (Dropdown options)
// ==========================================
export async function getSettings() {
  try {
    const { data, error } = await supabase.from('lis_settings').select('*').order('id')
    if (error) throw error
    const settings = { VisitType: [], Insite: [], Doctor: [], Department: [], Sender: [], LabDest: [] }
    data.forEach(row => {
      if (settings[row.type] !== undefined && row.value) {
        settings[row.type].push({ row: row.id, val: row.value })
      }
    })
    return settings
  } catch (e) { return {} }
}

export async function addSetting(type, value) {
  await supabase.from('lis_settings').insert([{ type, value }])
  return { success: true }
}

export async function deleteSetting(id) {
  await supabase.from('lis_settings').delete().eq('id', id)
  return { success: true }
}

// ==========================================
// TEST MASTER
// ==========================================
export async function getTestMaster() {
  try {
    const { data, error } = await supabase.from('lis_test_master').select('*').order('category').order('name')
    if (error) throw error
    return data.map(d => ({ id: d.id, name: d.name, price: d.price, category: d.category }))
  } catch (e) { return [] }
}

export async function saveTestMaster({ name, price, category }) {
  try {
    const { error } = await supabase.from('lis_test_master').insert([{ name, price: Number(price), category }])
    if (error) throw error
    return { success: true }
  } catch (e) { return { success: false } }
}

export async function updateTestMaster(id, name, price, category, user) {
  try {
    const { error } = await supabase.from('lis_test_master').update({ name, price: Number(price), category }).eq('id', id)
    if (error) throw error
    await logActivity(user, 'Edit Test Master', id, 'à»àºà»‰à»„àº‚: ' + name)
    return { success: true, message: 'àº­àº±àºšà»€àº”àº”àº¥àº²àºàºàº²àº™àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function deleteTestMaster(id) {
  try {
    await supabase.from('lis_test_master').delete().eq('id', id)
    return { success: true }
  } catch (e) { return { success: false } }
}

// Import Test Master from CSV
export async function importTestMasterFromCSV(csvData, user) {
  try {
    // csvData should be array of objects: [{ name, price, category }, ...]
    if (!csvData || csvData.length === 0) {
      return { success: false, message: 'No data to import' }
    }

    // Clear existing data first
    await supabase.from('lis_test_master').delete().neq('id', 0)

    // Insert new data
    const records = csvData.map(item => ({
      name: item.name?.trim() || '',
      price: Number(item.price) || 0,
      category: item.category?.trim() || 'Other',
      created_at: new Date().toISOString()
    })).filter(item => item.name !== '')

    if (records.length === 0) {
      return { success: false, message: 'No valid records found' }
    }

    const { error } = await supabase.from('lis_test_master').insert(records)
    if (error) throw error

    await logActivity(user, 'Import Test Master', 'CSV Import', `Imported ${records.length} records`)
    return { success: true, message: `Imported ${records.length} records successfully` }
  } catch (e) {
    console.error('Import error:', e)
    return { success: false, message: e.message }
  }
}

// ==========================================
// TEST PACKAGES
// ==========================================
export async function getTestPackages() {
  try {
    const { data, error } = await supabase
      .from('lis_test_packages')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    return data.map(d => ({ id: d.id, name: d.name, description: d.description, price: d.price }))
  } catch (e) { return [] }
}

// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID
export async function searchPatientById(patientId) {
  try {
    if (!patientId || patientId.length < 2) return null

    const { data, error } = await supabase
      .from('Patients')
      .select('Patient_ID, Title, First_Name, Last_Name, Gender, Age, Date_of_Birth')
      .eq('Patient_ID', patientId)
      .maybeSingle()

    if (error) {
      console.error('Supabase error:', error.message)
      return null
    }

    if (!data) return null

    let age = 0

    if (data.Age && String(data.Age).trim() !== '' && String(data.Age) !== 'NULL') {
      age = parseInt(String(data.Age)) || 0
    }

    if (age === 0 && data.Date_of_Birth && String(data.Date_of_Birth) !== 'NULL') {
      try {
        const dobStr = String(data.Date_of_Birth).trim()
        if (dobStr.includes('/')) {
          const parts = dobStr.split('/')
          if (parts.length === 3) {
            const birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            if (!isNaN(birthDate.getTime())) {
              const today = new Date()
              age = today.getFullYear() - birthDate.getFullYear()
              if (today.getMonth() < birthDate.getMonth() ||
                  (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
                age--
              }
            }
          }
        } else {
          const birthDate = new Date(dobStr)
          if (!isNaN(birthDate.getTime())) {
            const today = new Date()
            age = today.getFullYear() - birthDate.getFullYear()
            if (today.getMonth() < birthDate.getMonth() ||
                (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
              age--
            }
          }
        }
      } catch (e) {
        // Ignore date parsing errors
      }
    }

    let gender = 'Male'
    if (data.Gender) {
      const g = String(data.Gender).trim()
      if (g === 'ຊາຍ' || g === 'Male' || g === 'M') {
        gender = 'Male'
      } else if (g === 'ຍິງ' || g === 'Female' || g === 'F') {
        gender = 'Female'
      }
    }

    return {
      patientId: data.Patient_ID,
      fullName: `${data.Title || ''} ${data.First_Name || ''} ${data.Last_Name || ''}`.trim(),
      firstName: data.First_Name || '',
      lastName: data.Last_Name || '',
      title: data.Title || '',
      gender: gender,
      age: age
    }
  } catch (e) {
    console.error('Error searching patient:', e)
    return null
  }
}

// ດຶງລາຍຊື່ຄົນເຈັບສຳລັບ autocomplete (with search)
export async function getAllPatients(searchTerm = '') {
  try {
    if (!searchTerm || searchTerm.length < 2) {
      return []
    }
    
    const { data, error } = await supabase
      .from('Patients')
      .select('Patient_ID, First_Name, Last_Name, Title')
      .ilike('Patient_ID', searchTerm + '%')
      .limit(10)

    if (error) {
      return []
    }
    
    return data.map(d => ({
      patientId: d.Patient_ID,
      fullName: `${d.Title || ''} ${d.First_Name || ''} ${d.Last_Name || ''}`.trim()
    }))
  } catch (e) {
    return []
  }
}

export async function getAllTestPackages() {
  try {
    const { data, error } = await supabase
      .from('lis_test_packages')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  } catch (e) { return [] }
}

export async function getPackageItems(packageId) {
  try {
    const { data, error } = await supabase
      .from('lis_test_package_items')
      .select('*')
      .eq('package_id', packageId)
      .order('test_name')
    if (error) throw error
    return data.map(d => ({ id: d.id, testId: d.test_id, testName: d.test_name, price: d.price }))
  } catch (e) { return [] }
}

export async function saveTestPackage(data, user) {
  try {
    // Insert package
    const { data: pkgData, error: pkgError } = await supabase
      .from('lis_test_packages')
      .insert([{
        name: data.name.trim(),
        description: data.description || '',
        price: Number(data.price) || 0,
        is_active: data.isActive !== false
      }])
      .select()
      .single()
    if (pkgError) throw pkgError
    
    // Insert package items
    if (data.items && data.items.length > 0) {
      const itemsToInsert = data.items.map(item => ({
        package_id: pkgData.id,
        test_id: item.testId,
        test_name: item.testName,
        price: Number(item.price) || 0
      }))
      await supabase.from('lis_test_package_items').insert(itemsToInsert)
    }

    await logActivity(user, 'Create Package', pkgData.name, 'àºªà»‰àº²àº‡ Package à»ƒà»à»ˆ')
    return { success: true, message: 'àºšàº±àº™àº—àº¶àº Package àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function updateTestPackage(packageId, data, user) {
  try {
    await supabase.from('lis_test_packages').update({
      name: data.name.trim(),
      description: data.description || '',
      price: Number(data.price) || 0,
      is_active: data.isActive !== false
    }).eq('id', packageId)
    
    // Delete old items
    await supabase.from('lis_test_package_items').delete().eq('package_id', packageId)
    
    // Insert new items
    if (data.items && data.items.length > 0) {
      const itemsToInsert = data.items.map(item => ({
        package_id: packageId,
        test_id: item.testId,
        test_name: item.testName,
        price: Number(item.price) || 0
      }))
      await supabase.from('lis_test_package_items').insert(itemsToInsert)
    }
    
    await logActivity(user, 'Edit Package', data.name, 'à»àºà»‰à»„àº‚ Package')
    return { success: true, message: 'àº­àº±àºšà»€àº”àº” Package àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function deleteTestPackage(packageId, user) {
  try {
    await supabase.from('lis_test_packages').delete().eq('id', packageId)
    await logActivity(user, 'Delete Package', 'ID ' + packageId, '')
    return { success: true, message: 'àº¥àº¶àºš Package àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

// ==========================================
// TEST PARAMETERS
// ==========================================
export async function getTestParameters() {
  try {
    const { data, error } = await supabase.from('lis_test_parameters').select('*').order('test_name').order('id')
    if (error) throw error
    return data.map(d => ({
      rowIdx: d.id, testName: d.test_name, paramName: d.param_name,
      inputType: d.input_type, options: d.options, unit: d.unit, min: d.normal_min, max: d.normal_max
    }))
  } catch (e) { return [] }
}

export async function saveTestParameter(data, user) {
  try {
    const { error } = await supabase.from('lis_test_parameters').insert([{
      test_name: data.testName, param_name: data.paramName, input_type: data.inputType,
      options: data.options, unit: data.unit, normal_min: data.min, normal_max: data.max
    }])
    if (error) throw error
    await logActivity(user, 'Setup Parameter', data.testName, 'à»€àºžàºµà»ˆàº¡àº„à»ˆàº²: ' + data.paramName)
    return { success: true, message: 'àºšàº±àº™àº—àº¶àºàºàº²àº™àº•àº±à»‰àº‡àº„à»ˆàº²àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function deleteTestParameter(id, user) {
  try {
    await supabase.from('lis_test_parameters').delete().eq('id', id)
    return { success: true, message: 'àº¥àº¶àºšàºàº²àº™àº•àº±à»‰àº‡àº„à»ˆàº²àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

// ==========================================
// TEST REAGENT MAPPING
// ==========================================
export async function getTestReagentMapping() {
  try {
    const { data, error } = await supabase.from('lis_test_reagent_mapping').select('*').order('test_name')
    if (error) throw error
    return data.map(d => ({
      rowIdx: d.id, testName: d.test_name, reagentId: d.reagent_id, reagentName: d.reagent_name, qty: d.qty
    }))
  } catch (e) { return [] }
}

export async function addTestReagentMapping(testName, reagentId, reagentName, qty, user) {
  try {
    await supabase.from('lis_test_reagent_mapping').insert([{ test_name: testName, reagent_id: reagentId, reagent_name: reagentName, qty: Number(qty) }])
    await logActivity(user, 'Add Mapping', testName, 'Mapped ' + reagentName + ' Qty: ' + qty)
    return { success: true, message: 'à»€àºžàºµà»ˆàº¡àºàº²àº™àº•àº±à»‰àº‡àº„à»ˆàº²àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function deleteTestReagentMapping(id, user) {
  try {
    await supabase.from('lis_test_reagent_mapping').delete().eq('id', id)
    await logActivity(user, 'Delete Mapping', 'ID ' + id, '')
    return { success: true, message: 'àº¥àº¶àºšàºàº²àº™àº•àº±à»‰àº‡àº„à»ˆàº²àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

// ==========================================
// STOCK MASTER (Reagents)
// ==========================================
export async function getStockMaster() {
  try {
    const { data: masterData, error: masterErr } = await supabase.from('lis_stock_master').select('*').order('name')
    if (masterErr) throw masterErr
    const { data: invData } = await supabase.from('lis_inventory_lots').select('reagent_id, qty_remaining')
    const qtyMap = {}
    if (invData) {
      invData.forEach(lot => {
        qtyMap[lot.reagent_id] = (qtyMap[lot.reagent_id] || 0) + (Number(lot.qty_remaining) || 0)
      })
    }
    return masterData.map(d => ({ id: d.id, name: d.name, unit: d.unit, qty: qtyMap[d.id] || 0 }))
  } catch (e) { return [] }
}

export async function addNewReagent(name, unit) {
  try {
    await supabase.from('lis_stock_master').insert([{ name, unit }])
    return { success: true, message: 'à»€àºžàºµà»ˆàº¡àº™à»‰àº³àº¢àº²àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function updateReagentMaster(id, name, unit, user) {
  try {
    await supabase.from('lis_stock_master').update({ name, unit }).eq('id', id)
    await logActivity(user, 'Edit Reagent', id, 'à»àºà»‰à»„àº‚à»€àº›àº±àº™: ' + name)
    return { success: true, message: 'àº­àº±àºšà»€àº”àº”àº¥àº²àºàºŠàº·à»ˆàºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function deleteReagentMaster(id, user) {
  try {
    await supabase.from('lis_stock_master').delete().eq('id', id)
    await logActivity(user, 'Delete Reagent', id, '')
    return { success: true, message: 'àº¥àº¶àºšàº¥àº²àºàºàº²àº™àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

// ==========================================
// STOCK TRANSACTIONS (History)
// ==========================================
export async function recordStockTransaction(reagentId, reagentName, type, qty, note, user) {
  try {
    const numQty = Number(qty)
    await supabase.from('lis_stock_transactions').insert([{
      reagent_id: reagentId, reagent_name: reagentName, type, qty: numQty, note, user_name: user
    }])
    if (type === 'OUT') {
      // FIFO deduction from inventory_lots
      const { data: lots } = await supabase
        .from('lis_inventory_lots')
        .select('id, qty_remaining, exp_date')
        .eq('reagent_id', reagentId)
        .gt('qty_remaining', 0)
        .order('exp_date', { ascending: true })
      if (lots && lots.length > 0) {
        let remaining = numQty
        for (const lot of lots) {
          if (remaining <= 0) break
          const deduct = Math.min(lot.qty_remaining, remaining)
          await supabase.from('lis_inventory_lots').update({ qty_remaining: lot.qty_remaining - deduct }).eq('id', lot.id)
          remaining -= deduct
        }
      }
    }
    return { success: true, message: 'àºšàº±àº™àº—àº¶àºàºªàº³à»€àº¥àº±àº”! àº•àº±àº”àºªàº°àº•àº±àº­àºà»àº¥à»‰àº§.' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function getStockHistory(startDate, endDate, typeFilter = '') {
  try {
    let query = supabase
      .from('lis_stock_transactions')
      .select('*')
      .order('created_at', { ascending: false })

    // ກອງຕາມຊ່ວງວັນທີ
    if (startDate && endDate) {
      query = query.gte('created_at', startDate).lte('created_at', endDate)
    }

    // ກອງຕາມປະເພດ (IN/OUT)
    if (typeFilter && typeFilter !== 'all') {
      query = query.eq('type', typeFilter)
    }

    const { data, error } = await query
    if (error) throw error
    return data.map((d, i) => ({
      rowIdx: d.id, date: new Date(d.created_at).getTime(),
      reagentId: d.reagent_id, name: d.reagent_name, type: d.type, qty: d.qty, note: d.note, user: d.user_name
    }))
  } catch (e) { return [] }
}

// ດຶງຂໍ້ມູນສະຫຼຸບຍອດຮັບເຂົ້າ/ເບີກອອກ
export async function getStockSummary(startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('lis_stock_transactions')
      .select('type, qty')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
    if (error) throw error

    let totalIn = 0
    let totalOut = 0

    data.forEach(d => {
      if (d.type === 'IN') totalIn += Number(d.qty) || 0
      else if (d.type === 'OUT') totalOut += Number(d.qty) || 0
    })

    return { success: true, totalIn, totalOut }
  } catch (e) { return { success: false, totalIn: 0, totalOut: 0 } }
}

export async function updateStockTransaction(id, qty, note, user) {
  try {
    await supabase.from('lis_stock_transactions').update({ qty: Number(qty), note }).eq('id', id)
    await logActivity(user, 'Edit Stock History', 'ID ' + id, 'Qty: ' + qty)
    return { success: true, message: 'àº­àº±àºšà»€àº”àº”àº›àº°àº«àº§àº±àº”àºªàº³à»€àº¥àº±àº”à»àº¥à»‰àº§!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function deleteStockTransaction(id, user) {
  try {
    await supabase.from('lis_stock_transactions').delete().eq('id', id)
    await logActivity(user, 'Delete Stock History', 'ID ' + id, 'àº¥àº¶àºšàº›àº°àº«àº§àº±àº”')
    return { success: true, message: 'àº¥àº¶àºšàº›àº°àº«àº§àº±àº”àºªàº³à»€àº¥àº±àº”à»àº¥à»‰àº§!' }
  } catch (e) { return { success: false, message: e.message } }
}

// ==========================================
// INVENTORY LOTS
// ==========================================
// ດຶງຂໍ້ມູນ Inventory ພ້ອມ IN/OUT ຕາມຊ່ວງວັນທີ
export async function getInventoryDataWithDate(startDate, endDate) {
  try {
    // ດຶງຂໍ້ມູນ Inventory Lots
    const { data: lotsData, error: lotsErr } = await supabase
      .from('lis_inventory_lots')
      .select('*')
      .order('created_at', { ascending: false })

    if (lotsErr) throw lotsErr

    // ດຶງຂໍ້ມູນ Transactions ຕາມຊ່ວງວັນທີ
    let query = supabase
      .from('lis_stock_transactions')
      .select('reagent_id, type, qty')

    // ຖ້າມີວັນທີ ແລະ ບໍ່ເປົ່າ ໃຫ້ກອງຕາມວັນທີ
    if (startDate && endDate && startDate !== '' && endDate !== '') {
      // ແປງວັນທີເປັນ ISO format ທີ່ຖືກຕ້ອງ
      const startISO = new Date(startDate).toISOString()
      const endISO = new Date(endDate + 'T23:59:59.999').toISOString()
      
      console.log('🔍 Date filter - Start:', startISO, 'End:', endISO)
      
      query = query.gte('created_at', startISO).lte('created_at', endISO)
    }
    // ຖ້າບໍ່ມີວັນທີ ບໍ່ກອງ (ດຶງທັງໝົດ)

    const { data: transData, error: transErr } = await query
    if (transErr) throw transErr

    console.log('📊 Transactions fetched:', transData.length, 'records')
    console.log('📊 Date range:', startDate, 'to', endDate)
    if (transData.length > 0) {
      console.log('📊 Sample transaction:', transData[0])
    }

    // ສ້າງ Map ສຳລັບ IN/OUT ແຕ່ລະ reagent
    const summaryMap = {}
    transData.forEach(t => {
      if (!summaryMap[t.reagent_id]) {
        summaryMap[t.reagent_id] = { in: 0, out: 0 }
      }
      if (t.type === 'IN') summaryMap[t.reagent_id].in += Number(t.qty) || 0
      else if (t.type === 'OUT') summaryMap[t.reagent_id].out += Number(t.qty) || 0
    })

    console.log('📊 Summary Map:', summaryMap)

    // ຄິດໄລ່ຍອດລວມ
    let totalIn = 0
    let totalOut = 0
    Object.values(summaryMap).forEach(s => {
      totalIn += s.in
      totalOut += s.out
    })

    // ປະມວນຜົນ Lots
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const alerts = { expired: 0, expiringSoon: 0, outOfStock: 0 }

    const lots = lotsData.map(d => {
      const qty = Number(d.qty_remaining)
      let status = 'Normal'; let diffDays = 0

      if (d.exp_date) {
        const expDate = new Date(d.exp_date)
        diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24))
        if (qty <= 0) { status = 'Empty'; alerts.outOfStock++ }
        else if (diffDays < 0) { status = 'Expired'; alerts.expired++ }
        else if (diffDays <= 30) { status = 'Expiring Soon'; alerts.expiringSoon++ }
      }

      const transSummary = summaryMap[d.reagent_id] || { in: 0, out: 0 }

      console.log(`📦 Lot ${d.lot_id} (${d.reagent_name}): reagent_id=${d.reagent_id}, IN=${transSummary.in}, OUT=${transSummary.out}`)

      return {
        id: d.lot_id,
        reagentId: d.reagent_id,
        name: d.reagent_name,
        lotNo: d.lot_no,
        supplier: d.supplier,
        location: d.location,
        receiveDate: d.receive_date ? new Date(d.receive_date).getTime() : null,
        expDate: d.exp_date ? new Date(d.exp_date).getTime() : null,
        qty,
        status,
        daysLeft: diffDays,
        totalIn: transSummary.in,
        totalOut: transSummary.out
      }
    })

    return {
      success: true,
      data: lots,
      alerts,
      summary: { totalIn, totalOut }
    }
  } catch (e) {
    console.error('Error getInventoryDataWithDate:', e)
    return { success: false, data: [], alerts: { expired: 0, expiringSoon: 0, outOfStock: 0 }, summary: { totalIn: 0, totalOut: 0 } }
  }
}

export async function saveInventoryLot(data, user) {
  try {
    const lotId = 'INV-' + Date.now().toString().slice(-6)
    await supabase.from('lis_inventory_lots').insert([{
      lot_id: lotId, reagent_id: data.reagentId, reagent_name: data.reagentName,
      lot_no: data.lotNo, supplier: data.supplier, location: data.location,
      receive_date: data.receiveDate || null, exp_date: data.expDate || null,
      qty: Number(data.qty), qty_remaining: Number(data.qty)
    }])
    await recordStockTransaction(data.reagentId, data.reagentName, 'IN', data.qty, 'àº®àº±àºšà»€àº‚àº»à»‰àº² Lot: ' + data.lotNo, user)
    await logActivity(user, 'Add Inventory Lot', lotId, data.reagentName + ' Qty: ' + data.qty)
    return { success: true, message: 'àºšàº±àº™àº—àº¶àº Lot àº™à»‰àº³àº¢àº²àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function getInventoryData() {
  try {
    const { data, error } = await supabase.from('lis_inventory_lots').select('*').order('created_at', { ascending: false })
    if (error) throw error
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const alerts = { expired: 0, expiringSoon: 0, outOfStock: 0 }
    const lots = data.map(d => {
      const qty = Number(d.qty_remaining)
      let status = 'Normal'; let diffDays = 0
      if (d.exp_date) {
        const expDate = new Date(d.exp_date)
        diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24))
        if (qty <= 0) { status = 'Empty'; alerts.outOfStock++ }
        else if (diffDays < 0) { status = 'Expired'; alerts.expired++ }
        else if (diffDays <= 30) { status = 'Expiring Soon'; alerts.expiringSoon++ }
      }
      return {
        id: d.lot_id, reagentId: d.reagent_id, name: d.reagent_name,
        lotNo: d.lot_no, supplier: d.supplier, location: d.location,
        receiveDate: d.receive_date ? new Date(d.receive_date).getTime() : null,
        expDate: d.exp_date ? new Date(d.exp_date).getTime() : null,
        qty, status, daysLeft: diffDays
      }
    })
    return { success: true, data: lots, alerts }
  } catch (e) { return { success: false, data: [], alerts: { expired: 0, expiringSoon: 0, outOfStock: 0 } } }
}

export async function updateInventoryLot(lotId, lotNo, expDate, location, supplier, qty, user) {
  try {
    await supabase.from('lis_inventory_lots').update({
      lot_no: lotNo, supplier, location, exp_date: expDate || null, qty_remaining: Number(qty)
    }).eq('lot_id', lotId)
    await logActivity(user, 'Edit Inventory Lot', lotId, 'àº­àº±àºšà»€àº”àº” Lot: ' + lotNo)
    return { success: true, message: 'à»àºà»‰à»„àº‚àº¥àº²àºàºàº²àº™àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function deleteInventoryLot(lotId, user) {
  try {
    await supabase.from('lis_inventory_lots').delete().eq('lot_id', lotId)
    await logActivity(user, 'Delete Inventory Lot', lotId, 'àº¥àº¶àºš Lot àº­àº­àºàºˆàº²àºàºªàº²àº‡')
    return { success: true, message: 'àº¥àº¶àºšàº¥àº²àºàºàº²àº™àºªàº³à»€àº¥àº±àº”à»àº¥à»‰àº§!' }
  } catch (e) { return { success: false, message: e.message } }
}

// ==========================================
// TEST ORDERS
// ==========================================
function generateOrderId() {
  const d = new Date()
  const dateStr = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return 'ORD-' + dateStr + '-' + rand
}

export async function submitTestOrder(data) {
  try {
    let orderId = data.existingOrderId
    const isEdit = !!orderId
    if (isEdit) {
      await supabase.from('lis_test_orders').delete().eq('order_id', orderId)
    } else {
      orderId = generateOrderId()
    }
    const rowsToInsert = data.cart.map(item => ({
      order_id: orderId, order_datetime: data.orderDateTime, time_slot: data.timeSlot,
      visit_type: data.visitType, insite: data.insite, patient_id: data.patientId,
      patient_name: data.patientName, age: data.age, gender: data.gender,
      doctor: data.doctor, department: data.department, test_type: data.testType,
      test_name: item.name, price: item.price, total_price: data.totalPrice,
      lab_dest: data.labDest, sender: data.sender, status: 'Pending', category: item.category
    }))
    const { error } = await supabase.from('lis_test_orders').insert(rowsToInsert)
    if (error) throw error
    await logActivity(data.loggedUser, isEdit ? 'Edit Order' : 'Create Order', orderId, 'Total: â‚­' + data.totalPrice)

    // Auto deduct reagents (àºªàº³àº¥àº±àºš Order à»ƒà»à»ˆà»€àº—àº»à»ˆàº²àº™àº±à»‰àº™)
    if (!isEdit) {
      try {
        const { data: mappingData } = await supabase.from('lis_test_reagent_mapping').select('*')
        if (mappingData && mappingData.length > 0) {
          const testReagentMap = {}
          mappingData.forEach(m => {
            const key = m.test_name.trim().toLowerCase()
            if (!testReagentMap[key]) testReagentMap[key] = []
            testReagentMap[key].push({ id: m.reagent_id, name: m.reagent_name, qty: Number(m.qty) })
          })
          const grouped = {}
          data.cart.forEach(item => {
            const key = item.name.trim().toLowerCase()
            const reqs = testReagentMap[key]
            if (reqs) {
              reqs.forEach(r => {
                if (!grouped[r.id]) grouped[r.id] = { id: r.id, name: r.name, qty: 0 }
                grouped[r.id].qty += r.qty
              })
            }
          })
          for (const key in grouped) {
            const d2 = grouped[key]
            if (d2.qty > 0) await recordStockTransaction(d2.id, d2.name, 'OUT', d2.qty, 'Auto-deduct àºˆàº²àºàºšàº´àº™ ' + orderId, data.loggedUser)
          }
        }
      } catch (err) {
        await logActivity('System', 'Auto-Deduct Error', orderId, err.message)
      }
    }
    return { success: true, message: 'àºšàº±àº™àº—àº¶àº Order ' + orderId + ' àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function deleteOrder(orderId, user) {
  try {
    const { error } = await supabase.from('lis_test_orders').update({ status: 'Cancelled' }).eq('order_id', orderId)
    if (error) throw error
    await logActivity(user, 'Cancel Order', orderId, 'àºàº»àºà»€àº¥àºµàºàºšàº´àº™')
    return { success: true, message: 'àºàº»àºà»€àº¥àºµàºàºšàº´àº™àºªàº³à»€àº¥àº±àº”à»àº¥à»‰àº§!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function updateOrderStatus(orderId, newStatus, user, note) {
  try {
    const updates = { status: newStatus }
    if (note !== undefined) updates.note = note
    if (newStatus === 'Received' || newStatus === 'Completed') updates.completed_at = new Date().toISOString()
    await supabase.from('lis_test_orders').update(updates).eq('order_id', orderId)
    await logActivity(user, 'Update Status', orderId, 'Status: ' + newStatus)
    return { success: true, message: 'àº›à»ˆàº½àº™àºªàº°àº–àº²àº™àº°à»€àº›àº±àº™ ' + newStatus + ' àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function getRecentOrders() {
  try {
    const { data, error } = await supabase
      .from('lis_test_orders')
      .select('*')
      .neq('status', 'Cancelled')
      .order('order_datetime', { ascending: false })
      .limit(5000)
    if (error) throw error
    const orderMap = {}
    const orders = []
    data.forEach(row => {
      if (!orderMap[row.order_id]) {
        orderMap[row.order_id] = {
          orderId: row.order_id, dateTime: new Date(row.order_datetime).getTime(),
          timeSlot: row.time_slot, visitType: row.visit_type, insite: row.insite,
          patientId: row.patient_id, patientName: row.patient_name, age: row.age,
          gender: row.gender, doctor: row.doctor, department: row.department,
          testType: row.test_type, labDest: row.lab_dest, sender: row.sender,
          status: row.status, totalPrice: row.total_price, tests: []
        }
        orders.push(orderMap[row.order_id])
      }
      if (row.test_name) orderMap[row.order_id].tests.push({ name: row.test_name, price: Number(row.price) || 0 })
    })
    return orders.slice(0, 500)
  } catch (e) { return [] }
}


export async function getOutlabOrders() {
  try {
    const { data, error } = await supabase
      .from('lis_test_orders')
      .select('*')
      .neq('lab_dest', 'In-house')
      .not('lab_dest', 'is', null)
      .order('order_datetime', { ascending: false })
    if (error) throw error
    const orderMap = {}; const orders = []
    data.forEach(row => {
      if (!orderMap[row.order_id]) {
        orderMap[row.order_id] = {
          orderId: row.order_id, dateTime: new Date(row.order_datetime).getTime(),
          patientId: row.patient_id, patientName: row.patient_name, labDest: row.lab_dest,
          sender: row.sender || '-', status: row.status,
          receivedDate: row.completed_at ? new Date(row.completed_at).getTime() : null,
          note: row.note || '', tests: []
        }
        orders.push(orderMap[row.order_id])
      }
      if (row.test_name) orderMap[row.order_id].tests.push({ name: row.test_name, price: Number(row.price) || 0 })
    })
    return orders
  } catch (e) { return [] }
}

// ==========================================
// LAB RESULTS
// ==========================================
export async function getParametersForOrder(orderId) {
  try {
    const { data: orderRows } = await supabase
      .from('lis_test_orders').select('test_name, status').eq('order_id', orderId).neq('status', 'Cancelled')
    const orderedTests = [...new Set(orderRows.map(r => r.test_name.trim()))]

    const { data: existingRes } = await supabase
      .from('lis_test_results').select('*').eq('order_id', orderId)
    const existingResults = {}
    if (existingRes) {
      existingRes.forEach(r => { existingResults[r.test_name.trim() + '_' + r.param_name.trim()] = r.result_value })
    }

    const { data: paramData } = await supabase.from('lis_test_parameters').select('*')
    const formStructure = {}
    paramData.forEach(p => {
      const tName = p.test_name.trim()
      if (orderedTests.includes(tName)) {
        if (!formStructure[tName]) formStructure[tName] = []
        const pName = p.param_name.trim()
        const pKey = tName + '_' + pName
        formStructure[tName].push({
          paramName: pName, inputType: p.input_type, options: p.options,
          unit: p.unit, normalMin: p.normal_min, normalMax: p.normal_max,
          savedValue: existingResults[pKey] !== undefined ? existingResults[pKey] : ''
        })
      }
    })
    return { success: true, orderId, tests: formStructure }
  } catch (e) { return { success: false, message: e.message } }
}

export async function saveLabResults(orderId, results, user, attachments = []) {
  try {
    // àº”àº¶àº‡ limits
    const { data: paramData } = await supabase.from('lis_test_parameters').select('test_name, param_name, normal_min, normal_max')
    const limits = {}
    paramData.forEach(p => { limits[p.test_name.trim() + '_' + p.param_name.trim()] = { min: p.normal_min, max: p.normal_max } })

    // àº¥àº¶àºšàºœàº»àº™à»€àºàº»à»ˆàº²
    await supabase.from('lis_test_results').delete().eq('order_id', orderId)

    // àºšàº±àº™àº—àº¶àºà»ƒà»à»ˆ
    const rowsToInsert = results.map(r => {
      const tName = String(r.testName).trim()
      const pName = String(r.paramName).trim()
      const val = r.value
      let flag = 'Normal'
      const limit = limits[tName + '_' + pName]
      if (limit && val !== '') {
        const numVal = parseFloat(val)
        if (!isNaN(numVal)) {
          if (limit.min !== '' && limit.min !== null && numVal < parseFloat(limit.min)) flag = 'L'
          if (limit.max !== '' && limit.max !== null && numVal > parseFloat(limit.max)) flag = 'H'
        }
      }
      return { order_id: orderId, test_name: tName, param_name: pName, result_value: val, flag, user_name: user }
    })
    if (rowsToInsert.length > 0) {
      await supabase.from('lis_test_results').insert(rowsToInsert)
    }

    // àºšàº±àº™àº—àº¶àºà»„àºŸàº¥à»Œ attachment (àº–à»‰àº²àº¡àºµ)
    if (attachments && attachments.length > 0) {
      // àº¥àº¶àºšà»„àºŸàº¥à»Œà»€àºàº»à»ˆàº²
      await supabase.from('lis_order_attachments').delete().eq('order_id', orderId)
      
      // àºšàº±àº™àº—àº¶àºà»„àºŸàº¥à»Œà»ƒà»à»ˆ
      const attachmentsToInsert = attachments.map(att => ({
        order_id: orderId,
        file_name: att.name,
        file_type: att.type,
        file_size: att.size,
        file_url: att.data  // ເກັບເປັນ URL ຫຼື Base64
      }))
      await supabase.from('lis_order_attachments').insert(attachmentsToInsert)
    }

    // àº›à»ˆàº½àº™àºªàº°àº–àº²àº™àº° Completed
    await supabase.from('lis_test_orders').update({ status: 'Completed' }).eq('order_id', orderId)
    await logActivity(user, 'Enter/Edit Result', orderId, 'àºšàº±àº™àº—àº¶àº/à»àºà»‰à»„àº‚ àºœàº»àº™àºàº§àº”àºªàº³à»€àº¥àº±àº”')
    return { success: true, message: 'àºšàº±àº™àº—àº¶àºàºœàº»àº™àºàº§àº”àºªàº³à»€àº¥àº±àº”à»àº¥à»‰àº§!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function getOrderAttachments(orderId) {
  try {
    const { data, error } = await supabase
      .from('lis_order_attachments')
      .select('*')
      .eq('order_id', orderId)
    if (error) throw error
    return data || []
  } catch (e) { return [] }
}

export async function getSavedResults(orderId) {
  try {
    const { data: resData } = await supabase.from('lis_test_results').select('*').eq('order_id', orderId)
    const { data: paramData } = await supabase.from('lis_test_parameters').select('test_name, param_name, unit, normal_min, normal_max')
    const paramLookup = {}
    paramData.forEach(p => { paramLookup[p.test_name + '_' + p.param_name] = { unit: p.unit, min: p.normal_min, max: p.normal_max } })
    return resData.map(r => {
      const key = r.test_name + '_' + r.param_name
      const pInfo = paramLookup[key] || { unit: '', min: '', max: '' }
      const nRange = (pInfo.min !== '' && pInfo.min !== null && pInfo.max !== '' && pInfo.max !== null) ? pInfo.min + ' - ' + pInfo.max : '-'
      return { testName: r.test_name, paramName: r.param_name, value: r.result_value, flag: r.flag, unit: pInfo.unit, normalRange: nRange }
    })
  } catch (e) { return [] }
}

// ==========================================
// MAINTENANCE
// ==========================================
export async function saveMaintenanceLog(data, user) {
  try {
    const logId = 'MNT-' + Date.now().toString().slice(-6)
    await supabase.from('lis_maintenance_log').insert([{
      log_id: logId, log_date: data.date, machine: data.machine, type: data.type,
      issues: data.issues, action: data.action, next_due: data.nextDue || null, user_name: user
    }])
    await logActivity(user, 'Maintenance', data.machine, data.type)
    return { success: true, message: 'àºšàº±àº™àº—àº¶àºàº›àº°àº«àº§àº±àº” Maintenance àºªàº³à»€àº¥àº±àº”!' }
  } catch (e) { return { success: false, message: e.message } }
}

export async function getMaintenanceLogs() {
  try {
    const { data, error } = await supabase.from('lis_maintenance_log').select('*').order('maintenance_date', { ascending: false }).limit(100)
    if (error) throw error
    return data.map(d => ({
      id: d.id, date: d.maintenance_date ? new Date(d.maintenance_date).getTime() : null,
      machine: d.device_name, type: d.maintenance_type, issues: d.description, action: d.issues,
      nextDue: d.next_due_date ? new Date(d.next_due_date).getTime() : null, user: d.technician
    }))
  } catch (e) { return [] }
}

export async function deleteMaintenanceLog(logId, user) {
  try {
    await supabase.from('lis_maintenance_log').delete().eq('log_id', logId)
    await logActivity(user, 'Delete Maintenance', logId, '')
    return { success: true, message: 'àº¥àº¶àºšàº‚à»à»‰àº¡àº¹àº™àºªàº³à»€àº¥àº±àº”à»àº¥à»‰àº§!' }
  } catch (e) { return { success: false, message: e.message } }
}

// ==========================================
// DASHBOARD
// ==========================================
export async function getDashboardData(startDateStr, endDateStr, filters = {}) {
  try {
    const start = startDateStr ? new Date(startDateStr) : new Date()
    start.setHours(0, 0, 0, 0)
    const end = endDateStr ? new Date(endDateStr) : new Date()
    end.setHours(23, 59, 59, 999)

    // àºªà»‰àº²àº‡ query àº”à»‰àº§àº filters
    let query = supabase.from('lis_test_orders').select('*')
      .neq('status', 'Cancelled')
      .gte('order_datetime', start.toISOString())
      .lte('order_datetime', end.toISOString())
    
    // à»ƒàºŠà»‰ Filters àº–à»‰àº²àº¡àºµ
    if (filters.department) query = query.eq('department', filters.department)
    if (filters.doctor) query = query.eq('doctor', filters.doctor)
    if (filters.testType) query = query.eq('test_type', filters.testType)
    if (filters.category) query = query.eq('category', filters.category)
    
    const { data: orders } = await query

    const kpis = { totalPatients: 0, totalRevenue: 0, inlabRev: 0, outlabRev: 0 }
    const charts = {
      gender: { Male: 0, Female: 0 }, visitType: {}, testTypeRev: { Normal: 0, Package: 0 },
      deptRev: {}, labType: { InHouse: 0, Outsource: 0 }, timeSlot: {}, insite: {},
      doctors: {}, tests: {}, categories: {}, stockUsage: {}
    }
    const uniquePatients = new Set()

    if (orders) {
      orders.forEach(row => {
        const gender = row.gender || 'Other', visitType = row.visit_type || 'Other'
        const insite = row.insite || 'Other', doctor = row.doctor || 'Other'
        const dept = row.department || 'Other', testType = row.test_type || 'Normal'
        const testName = row.test_name, price = Number(row.price) || 0
        const labDest = row.lab_dest, category = row.category || 'Other'
        const tSlot = row.time_slot, orderId = row.order_id

        uniquePatients.add(row.patient_id)
        kpis.totalRevenue += price
        if (labDest && labDest !== 'In-house') { kpis.outlabRev += price; charts.labType.Outsource += price }
        else { kpis.inlabRev += price; charts.labType.InHouse += price }

        if (gender === 'Male') charts.gender.Male++; else if (gender === 'Female') charts.gender.Female++
        if (!charts.visitType[visitType]) charts.visitType[visitType] = 0; charts.visitType[visitType] += price
        if (!charts.deptRev[dept]) charts.deptRev[dept] = 0; charts.deptRev[dept] += price
        if (!charts.insite[insite]) charts.insite[insite] = 0; charts.insite[insite] += price
        if (!charts.doctors[doctor]) charts.doctors[doctor] = 0; charts.doctors[doctor] += price
        if (testName) { if (!charts.tests[testName]) charts.tests[testName] = { count: 0, rev: 0 }; charts.tests[testName].count++; charts.tests[testName].rev += price }
        if (category) { if (!charts.categories[category]) charts.categories[category] = { count: 0, rev: 0 }; charts.categories[category].count++; charts.categories[category].rev += price }
        if (!charts.timeSlot[tSlot]) charts.timeSlot[tSlot] = { count: 0, rev: 0, orders: new Set() }
        charts.timeSlot[tSlot].rev += price; charts.timeSlot[tSlot].orders.add(orderId)
        if (!charts.testTypeRev[testType]) charts.testTypeRev[testType] = 0; charts.testTypeRev[testType] += price
      })
      for (const slot in charts.timeSlot) {
        charts.timeSlot[slot].count = charts.timeSlot[slot].orders.size
        delete charts.timeSlot[slot].orders
      }
      kpis.totalPatients = uniquePatients.size
    }

    // Stock usage
    const { data: stockData } = await supabase.from('lis_stock_transactions').select('*')
      .eq('type', 'OUT').gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
    if (stockData) {
      stockData.forEach(row => {
        if (!charts.stockUsage[row.reagent_name]) charts.stockUsage[row.reagent_name] = 0
        charts.stockUsage[row.reagent_name] += Number(row.qty) || 0
      })
    }

    // Inventory alerts
    const alerts = { expired: 0, expiringSoon: 0 }
    const { data: invData } = await supabase.from('lis_inventory_lots').select('exp_date, qty_remaining').gt('qty_remaining', 0)
    if (invData) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      invData.forEach(d => {
        if (d.exp_date) {
          const diffDays = Math.ceil((new Date(d.exp_date) - today) / (1000 * 60 * 60 * 24))
          if (diffDays < 0) alerts.expired++; else if (diffDays <= 30) alerts.expiringSoon++
        }
      })
    }

    // àº”àº¶àº‡ Summary Data
    const summaryData = await getDashboardSummaryData(startDateStr, endDateStr, filters)

    return { success: true, kpis, charts, alerts, summaryData, orders: orders || [] }
  } catch (e) { return { success: false, message: e.message } }
}

// àºŸàº±àº‡àºŠàº±àº™àºŠà»ˆàº§àºàºªàº³àº¥àº±àºš Summary Data
async function getDashboardSummaryData(startDateStr, endDateStr, filters = {}) {
  try {
    const start = startDateStr ? new Date(startDateStr) : new Date()
    start.setHours(0, 0, 0, 0)
    const end = endDateStr ? new Date(endDateStr) : new Date()
    end.setHours(23, 59, 59, 999)

    let query = supabase.from('lis_test_orders').select('*')
      .neq('status', 'Cancelled')
      .gte('order_datetime', start.toISOString())
      .lte('order_datetime', end.toISOString())
    
    if (filters.department) query = query.eq('department', filters.department)
    if (filters.doctor) query = query.eq('doctor', filters.doctor)
    if (filters.testType) query = query.eq('test_type', filters.testType)
    if (filters.category) query = query.eq('category', filters.category)
    
    const { data, error } = await query
    if (error) throw error

    const reportMap = {}
    const kpis = { normalCount: 0, normalRev: 0, packageCount: 0, packageRev: 0 }

    data.forEach(row => {
      const testType = row.test_type || 'Normal', testName = row.test_name || 'Unknown'
      const price = Number(row.price) || 0, category = row.category || 'Other'
      if (testType === 'Normal') { kpis.normalCount++; kpis.normalRev += price }
      else { kpis.packageCount++; kpis.packageRev += price }
      const key = category + '|||' + testName
      if (!reportMap[key]) reportMap[key] = { category, testName, normal: 0, package: 0, revenue: 0 }
      if (testType === 'Normal') reportMap[key].normal++; else reportMap[key].package++
      reportMap[key].revenue += price
    })

    const tableData = Object.values(reportMap).sort((a, b) => {
      if (a.category === b.category) return a.testName.localeCompare(b.testName)
      return a.category.localeCompare(b.category)
    })
    return tableData
  } catch (e) { return [] }
}

// ==========================================
// SUMMARY REPORT
// ==========================================
export async function getSummaryReportData(startDateStr, endDateStr) {
  try {
    const start = startDateStr ? new Date(startDateStr) : new Date()
    start.setHours(0, 0, 0, 0)
    const end = endDateStr ? new Date(endDateStr) : new Date()
    end.setHours(23, 59, 59, 999)

    const { data, error } = await supabase.from('lis_test_orders').select('*')
      .neq('status', 'Cancelled')
      .gte('order_datetime', start.toISOString())
      .lte('order_datetime', end.toISOString())
    if (error) throw error

    const reportMap = {}
    const kpis = { normalCount: 0, normalRev: 0, packageCount: 0, packageRev: 0 }

    data.forEach(row => {
      const testType = row.test_type || 'Normal', testName = row.test_name || 'Unknown'
      const price = Number(row.price) || 0, category = row.category || 'Other'
      if (testType === 'Normal') { kpis.normalCount++; kpis.normalRev += price }
      else { kpis.packageCount++; kpis.packageRev += price }
      const key = category + '|||' + testName
      if (!reportMap[key]) reportMap[key] = { category, testName, normal: 0, package: 0, revenue: 0 }
      if (testType === 'Normal') reportMap[key].normal++; else reportMap[key].package++
      reportMap[key].revenue += price
    })

    const tableData = Object.values(reportMap).sort((a, b) => {
      if (a.category === b.category) return a.testName.localeCompare(b.testName)
      return a.category.localeCompare(b.category)
    })
    return { success: true, tableData, kpis }
  } catch (e) { return { success: false, message: e.message } }
}
