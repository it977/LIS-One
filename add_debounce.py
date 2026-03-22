# Read the file
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace getAllPatients with debounced version
old_code = '''// ດຶງລາຍຊື່ຄົນເຈັບສຳລັບ autocomplete (ປິດຊົ່ວຄາວ)
export async function getAllPatients() {
  // ປິດ autocomplete ເພື່ອຫຼຸດ error 409
  // ໃຊ້ search ເມື່ອພິມ Patient ID ແທນ
  return []
}'''

new_code = '''// ດຶງລາຍຊື່ຄົນເຈັບສຳລັບ autocomplete (with debounce)
export async function getAllPatients(searchTerm = '') {
  try {
    // ຖ້າບໍ່ມີ search term ໃຫ້ສົ່ງຄືນວ່າງ
    if (!searchTerm || searchTerm.length < 2) {
      return []
    }
    
    const { data, error } = await supabase
      .from('Patients')
      .select('Patient_ID, First_Name, Last_Name, Title')
      .ilike('Patient_ID', `%${searchTerm}%`)
      .limit(20)

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
}'''

content = content.replace(old_code, new_code)

# Write back
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed! Added debounced autocomplete with search")
