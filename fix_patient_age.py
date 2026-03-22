# Read the file
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the searchPatientById function to handle missing data better
old_code = '''// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID
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

new_code = '''// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID
export async function searchPatientById(patientId) {
  try {
    if (!patientId || patientId.length < 2) return null
    
    console.log('Searching patient:', patientId)
    
    // ຄົ້ນຫາຈາກຕາຕະລາງ Patients (ໃນ it977's Project)
    const { data, error } = await supabase
      .from('Patients')
      .select('Patient_ID, Title, First_Name, Last_Name, Gender, Date_of_Birth, Age')
      .eq('Patient_ID', patientId)
      .single()
    
    console.log('Search result:', { data, error })
    
    if (error) {
      console.error('Supabase error:', error)
      return null
    }
    
    if (!data) {
      console.warn('No patient found')
      return null
    }
    
    // ຄິດໄລ່ອາຍຸ ຫຼື ໃຊ້ Age ຈາກ DB
    let age = 0
    if (data.Age && data.Age !== '0' && data.Age !== '' && data.Age !== ' ') {
      age = parseInt(String(data.Age)) || 0
      console.log('Age from DB:', age)
    } else if (data.Date_of_Birth && data.Date_of_Birth !== '0' && data.Date_of_Birth !== '' && data.Date_of_Birth !== ' ') {
      try {
        const birthDate = new Date(data.Date_of_Birth)
        if (!isNaN(birthDate.getTime())) {
          const today = new Date()
          age = today.getFullYear() - birthDate.getFullYear()
          const monthDiff = today.getMonth() - birthDate.getMonth()
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--
          }
          console.log('Calculated age:', age)
        }
      } catch (e) {
        console.warn('Invalid Date_of_Birth:', data.Date_of_Birth, e)
      }
    }
    
    // ກຳນົດເພດ
    let gender = 'Male'
    if (data.Gender && data.Gender !== '' && data.Gender !== ' ') {
      gender = data.Gender
    }
    
    const result = {
      patientId: data.Patient_ID,
      fullName: `${data.Title || ''} ${data.First_Name || ''} ${data.Last_Name || ''}`.trim(),
      firstName: data.First_Name || '',
      lastName: data.Last_Name || '',
      title: data.Title || '',
      gender: gender,
      age: age
    }
    
    console.log('Patient found:', result)
    return result
  } catch (e) {
    console.error('Error searching patient:', e)
    return null
  }
}'''

content = content.replace(old_code, new_code)

# Write back
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed! searchPatientById updated with better error handling")
