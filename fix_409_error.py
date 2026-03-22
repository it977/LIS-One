# Read the file
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace getAllPatients to return empty array (disable autocomplete)
old_code = '''// àº”àº¶àº‡àº¥àº²àºàºŠàº·à»ˆàº„àº»àº™à»€àºˆàº±àºšàº—àº±àº‡à»àº»àº”àºªàº³àº¥àº±àºš autocomplete
export async function getAllPatients() {
  try {
    const { data, error } = await supabase
      .from('Patients')
      .select('Patient_ID, First_Name, Last_Name, Title')
      .limit(100)
      .order('Patient_ID', { ascending: true })

    if (error) throw error
    return data.map(d => ({
      patientId: d.Patient_ID,
      fullName: `${d.Title} ${d.First_Name} ${d.Last_Name}`.trim()
    }))
  } catch (e) {
    console.error('Error getting patients:', e)
    return []
  }
}'''

new_code = '''// ດຶງລາຍຊື່ຄົນເຈັບສຳລັບ autocomplete (ປິດຊົ່ວຄາວ)
export async function getAllPatients() {
  // ປິດ autocomplete ເພື່ອຫຼຸດ error 409
  // ໃຊ້ search ເມື່ອພິມ Patient ID ແທນ
  return []
}'''

content = content.replace(old_code, new_code)

# Write back
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed! Disabled getAllPatients to prevent 409 error")
