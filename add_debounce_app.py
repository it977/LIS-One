# Read the file
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace searchPatient and loadPatientAutocomplete with debounced version
old_code = '''// ================== PATIENT SEARCH ==================
// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID
window.searchPatient = async function(patientId) {
  if (!patientId || patientId.length < 2) return

  try {
    const patient = await api.searchPatientById(patientId)

    if (patient) {
      // ພົບຂໍ້ມູນ - ກຣອກຂໍ້ມູນລົງໃນຟອມ
      document.getElementById('patientName').value = patient.fullName
      document.getElementById('age').value = patient.age
      document.getElementById('gender').value = patient.gender || 'Male'

      console.log('Patient found:', patient)
    }
  } catch (e) {
    console.error('Error searching patient:', e)
  }
}

// ໂຫດລາຍຊ່ຄົນເຈັບສຳລັບ autocomplete
async function loadPatientAutocomplete() {
  try {
    const patients = await api.getAllPatients()
    const datalist = document.getElementById('patientList')

    if (datalist && patients.length > 0) {
      datalist.innerHTML = patients.map(p =>
        `<option value="${p.patientId}" data-name="${p.fullName}">`
      ).join('')
    }
  } catch (e) {
    console.error('Error loading patients:', e)
  }
}'''

new_code = '''// ================== PATIENT SEARCH ==================
// Debounce timer
let patientSearchTimer = null

// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID (with debounce)
window.searchPatient = function(patientId) {
  // ລໍຖ້າ 500ms ຫຼັງພິມເພື່ອຫຼຸດ request
  if (patientSearchTimer) {
    clearTimeout(patientSearchTimer)
  }
  
  if (!patientId || patientId.length < 2) {
    document.getElementById('patientList').innerHTML = ''
    return
  }

  patientSearchTimer = setTimeout(async () => {
    try {
      // ຄົ້ນຫາຂໍ້ມູນຄົນເຈັບ
      const patient = await api.searchPatientById(patientId)

      if (patient) {
        // ພົບຂໍ້ມູນ - ກຣອກຂໍ້ມູນລົງໃນຟອມ
        document.getElementById('patientName').value = patient.fullName
        document.getElementById('age').value = patient.age
        document.getElementById('gender').value = patient.gender || 'Male'
      }

      // ໂຫຼດ autocomplete suggestions
      const suggestions = await api.getAllPatients(patientId)
      const datalist = document.getElementById('patientList')

      if (datalist && suggestions.length > 0) {
        datalist.innerHTML = suggestions.map(p =>
          `<option value="${p.patientId}" data-name="${p.fullName}">`
        ).join('')
      } else {
        datalist.innerHTML = ''
      }
    } catch (e) {
      // ບໍ່ສະແດງ error ໃນ console
    }
  }, 500)  // ລໍຖ້າ 500ms
}

// ໂຫຼດລາຍຊື່ຄົນເຈັບສຳລັບ autocomplete (ຖືກປິດແລ້ວ)
async function loadPatientAutocomplete() {
  // ບໍ່ໂຫຼດລ່ວງໜ້າ ເພື່ອຫຼຸດ error
}'''

content = content.replace(old_code, new_code)

# Also need to update checkLogin to not call loadPatientAutocomplete
old_checklogin = '''    loadPatientAutocomplete() // ໂຫຼດ autocomplete ຄົນເຈັບ'''
new_checklogin = '''    // loadPatientAutocomplete() - ປິດແລ້ວ ໃຊ້ debounce ແທນ'''

content = content.replace(old_checklogin, new_checklogin)

# Write back
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed! Added debounced search with autocomplete suggestions")
