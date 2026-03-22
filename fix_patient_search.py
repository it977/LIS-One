# Read the file
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the searchPatientById function
old_code = '''// àº„àº»à»‰àº™àº«àº²àº„àº»àº™à»€àºˆàº±àºšàºˆàº²àº Patient ID
export async function searchPatientById(patientId) {
  try {
    if (!patientId || patientId.length < 2) return null

    // àº„àº»à»‰àº™àº«àº²àºˆàº²àºàº•àº²àº•àº°àº¥àº²àº‡ Patients (à»ƒàº™ it977's Project)
    const { data, error } = await supabase
      .from('Patients')
      .select('Patient_ID, Title, First_Name, Last_Name, Gender, Date_of_Birth')
      .eq('Patient_ID', patientId)
      .single()

    if (error || !data) return null

    // àº„àº´àº”à»„àº¥à»ˆàº­àº²àºàº¸
    let age = 0
    if (data.Date_of_Birth) {
      const birthDate = new Date(data.Date_of_Birth)
      const today = new Date()
      age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
    }

    return {
      patientId: data.Patient_ID,
      fullName: `${data.Title} ${data.First_Name} ${data.Last_Name}`.trim(),
      firstName: data.First_Name,
      lastName: data.Last_Name,
      title: data.Title,
      gender: data.Gender,
      age: age
    }
  } catch (e) {
    console.error('Error searching patient:', e)
    return null
  }
}'''

new_code = '''// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID
export async function searchPatientById(patientId) {
  try {
    if (!patientId || patientId.length < 2) return null
    
    // ຄົ້ນຫາຈາກຕາຕະລາງ Patients (ໃນ it977's Project)
    const { data, error } = await supabase
      .from('Patients')
      .select('Patient_ID, Title, First_Name, Last_Name, Gender, Date_of_Birth, Age')
      .eq('Patient_ID', patientId)
      .single()
    
    if (error || !data) return null
    
    // ຄິດໄລ່ອາຍຸ ຫຼື ໃຊ້ Age ຈາກ DB
    let age = 0
    if (data.Age && data.Age !== '0' && data.Age !== '') {
      age = parseInt(data.Age) || 0
    } else if (data.Date_of_Birth && data.Date_of_Birth !== '0' && data.Date_of_Birth !== '') {
      try {
        const birthDate = new Date(data.Date_of_Birth)
        if (!isNaN(birthDate.getTime())) {
          const today = new Date()
          age = today.getFullYear() - birthDate.getFullYear()
          const monthDiff = today.getMonth() - birthDate.getMonth()
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--
          }
        }
      } catch (e) {
        console.warn('Invalid Date_of_Birth:', data.Date_of_Birth)
      }
    }
    
    return {
      patientId: data.Patient_ID,
      fullName: `${data.Title} ${data.First_Name} ${data.Last_Name}`.trim(),
      firstName: data.First_Name,
      lastName: data.Last_Name,
      title: data.Title,
      gender: data.Gender || 'Male',
      age: age
    }
  } catch (e) {
    console.error('Error searching patient:', e)
    return null
  }
}'''

content = content.replace(old_code, new_code)

# Write back
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed! searchPatientById updated")
