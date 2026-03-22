# Read the file
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove debug console.log from searchPatientById
old_code = '''// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID
export async function searchPatientById(patientId) {
  try {
    if (!patientId || patientId.length < 2) return null

    // ຄົ້ນຫາຈາກຕາຕະລາງ Patients (ໃນ it977's Project)
    const { data, error } = await supabase
      .from('Patients')
      .select('Patient_ID, Title, First_Name, Last_Name, Gender, Age, Date_of_Birth')
      .eq('Patient_ID', patientId)
      .single()

    if (error || !data) return null

    // ຄິດໄລ່ອາຍຸ
    let age = 0
    
    // ລອງ Age ກ່ອນ
    if (data.Age && String(data.Age).trim() !== '' && String(data.Age) !== 'NULL') {
      const ageNum = parseInt(String(data.Age))
      if (!isNaN(ageNum) && ageNum > 0) {
        age = ageNum
      }
    }
    
    // ຖ້າບໍ່ມີ Age ໃຫ້ຄິດໄລ່ຈາກ Date_of_Birth
    if (age === 0 && data.Date_of_Birth && String(data.Date_of_Birth) !== 'NULL') {
      try {
        const dobStr = String(data.Date_of_Birth).trim()
        // Format: DD/MM/YYYY
        if (dobStr.includes('/')) {
          const parts = dobStr.split('/')
          if (parts.length === 3) {
            const day = parseInt(parts[0])
            const month = parseInt(parts[1]) - 1
            const year = parseInt(parts[2])
            const birthDate = new Date(year, month, day)
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
          // Format: YYYY-MM-DD
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
        console.warn('Error calculating age:', e)
      }
    }

    // ແປງເພດ
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
}'''

new_code = '''// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID
export async function searchPatientById(patientId) {
  try {
    if (!patientId || patientId.length < 2) return null

    const { data, error } = await supabase
      .from('Patients')
      .select('Patient_ID, Title, First_Name, Last_Name, Gender, Age, Date_of_Birth')
      .eq('Patient_ID', patientId)
      .single()

    if (error || !data) return null

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
    return null
  }
}'''

content = content.replace(old_code, new_code)

# Write back
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed! Removed debug logs and cleaned up error handling")
