# Read the file
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the searchPatientById function - handle Lao text and date format
old_code = '''// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID
export async function searchPatientById(patientId) {
  try {
    if (!patientId || patientId.length < 2) return null
    
    console.log('🔍 Searching patient:', patientId)
    
    // ຄົ້ນຫາຈາກຕາຕະລາງ Patients (ໃນ it977's Project)
    // ເລືອກທຸກ columns ທີ່ມີ
    const { data, error } = await supabase
      .from('Patients')
      .select('*')
      .eq('Patient_ID', patientId)
      .single()
    
    console.log('📊 Search result:', JSON.stringify(data, null, 2))
    
    if (error) {
      console.error('❌ Supabase error:', error.message)
      return null
    }
    
    if (!data) {
      console.warn('⚠️ No patient found')
      return null
    }
    
    // ຄິດໄລ່ອາຍຸຈາກ Date_of_Birth ຫຼື Age
    let age = 0
    
    // ລອງ Age ກ່ອນ (ຖ້າມີ)
    if (data.Age) {
      const ageNum = parseInt(String(data.Age))
      if (!isNaN(ageNum) && ageNum > 0) {
        age = ageNum
        console.log('✅ Age from DB:', age)
      }
    }
    
    // ຖ້າບໍ່ມີ Age ໃຫ້ຄິດໄລ່ຈາກ Date_of_Birth
    if (age === 0 && data.Date_of_Birth) {
      try {
        const dobStr = String(data.Date_of_Birth)
        if (dobStr && dobStr !== '0' && dobStr.trim() !== '') {
          const birthDate = new Date(dobStr)
          if (!isNaN(birthDate.getTime())) {
            const today = new Date()
            age = today.getFullYear() - birthDate.getFullYear()
            const monthDiff = today.getMonth() - birthDate.getMonth()
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--
            }
            console.log('✅ Calculated age from DOB:', age, '(DOB:', dobStr + ')')
          }
        }
      } catch (e) {
        console.warn('⚠️ Invalid Date_of_Birth:', data.Date_of_Birth, e)
      }
    }
    
    // ກຳນົດເພດ - ລອງຫຼາຍ column names
    let gender = 'Male'
    if (data.Gender) {
      gender = data.Gender
    } else if (data.Sex) {
      gender = data.Sex
    } else if (data.gender) {
      gender = data.gender
    } else if (data.sex) {
      gender = data.sex
    }
    
    // ແປງເພດໃຫ້ເປັນ Male/Female
    if (gender === 'ຍິງ' || gender === 'Female' || gender === 'F' || gender === 'ຊາຍ') {
      gender = gender === 'ຊາຍ' ? 'Male' : 'Female'
    }
    
    console.log('✅ Gender:', gender)
    
    // ສ້າງຊື່ເຕັມ
    let fullName = ''
    if (data.Title) fullName += data.Title + ' '
    if (data.First_Name) fullName += data.First_Name + ' '
    if (data.Last_Name) fullName += data.Last_Name
    fullName = fullName.trim()
    
    const result = {
      patientId: data.Patient_ID,
      fullName: fullName,
      firstName: data.First_Name || '',
      lastName: data.Last_Name || '',
      title: data.Title || '',
      gender: gender,
      age: age
    }
    
    console.log('✅ Patient found:', result)
    return result
  } catch (e) {
    console.error('❌ Error searching patient:', e)
    return null
  }
}'''

new_code = '''// ຄົ້ນຫາຄົນເຈັບຈາກ Patient ID
export async function searchPatientById(patientId) {
  try {
    if (!patientId || patientId.length < 2) return null
    
    console.log('🔍 Searching patient:', patientId)
    
    // ຄົ້ນຫາຈາກຕາຕະລາງ Patients (ໃນ it977's Project)
    const { data, error } = await supabase
      .from('Patients')
      .select('Patient_ID, Title, First_Name, Last_Name, Gender, Age, Date_of_Birth')
      .eq('Patient_ID', patientId)
      .single()
    
    if (error) {
      console.error('❌ Supabase error:', error.message)
      return null
    }
    
    if (!data) {
      console.warn('⚠️ No patient found')
      return null
    }
    
    console.log('📊 Raw data:', data)
    
    // ຄິດໄລ່ອາຍຸຈາກ Age ຫຼື Date_of_Birth
    let age = 0
    
    // ລອງ Age ກ່ອນ
    if (data.Age !== null && data.Age !== undefined && data.Age !== '' && data.Age !== ' ') {
      const ageStr = String(data.Age).trim()
      const ageNum = parseInt(ageStr)
      if (!isNaN(ageNum) && ageNum > 0 && ageNum < 150) {
        age = ageNum
        console.log('✅ Age from DB:', age, '(raw:', ageStr + ')')
      }
    }
    
    // ຖ້າບໍ່ມີ Age ຫຼື Age ບໍ່ຖືກຕ້ອງ ໃຫ້ຄິດໄລ່ຈາກ Date_of_Birth
    if (age === 0 && data.Date_of_Birth && data.Date_of_Birth !== 'NULL') {
      try {
        const dobStr = String(data.Date_of_Birth).trim()
        console.log('📅 Trying to parse DOB:', dobStr)
        
        if (dobStr && dobStr !== '' && dobStr !== 'null') {
          // ລອງຫຼາຍ formats
          let birthDate = null
          
          // Format: DD/MM/YYYY
          if (dobStr.includes('/')) {
            const parts = dobStr.split('/')
            if (parts.length === 3) {
              const day = parseInt(parts[0])
              const month = parseInt(parts[1]) - 1  // JS months are 0-indexed
              const year = parseInt(parts[2])
              birthDate = new Date(year, month, day)
            }
          }
          // Format: YYYY-MM-DD
          else if (dobStr.includes('-')) {
            birthDate = new Date(dobStr)
          }
          // Format: YYYY-MM-DD HH:MM:SS
          else {
            birthDate = new Date(dobStr)
          }
          
          if (birthDate && !isNaN(birthDate.getTime())) {
            const today = new Date()
            age = today.getFullYear() - birthDate.getFullYear()
            const monthDiff = today.getMonth() - birthDate.getMonth()
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--
            }
            console.log('✅ Calculated age from DOB:', age, '(DOB:', dobStr + ')')
          }
        }
      } catch (e) {
        console.warn('⚠️ Error calculating age:', e)
      }
    }
    
    console.log('📊 Final age:', age)
    
    // ກຳນົດເພດ
    let gender = 'Male'
    if (data.Gender) {
      const g = String(data.Gender).trim()
      console.log('📊 Raw gender:', g)
      
      // ແປງເພດລາວ/ອັງກິດ
      if (g === 'ຊາຍ' || g === 'Male' || g === 'M') {
        gender = 'Male'
      } else if (g === 'ຍິງ' || g === 'Female' || g === 'F') {
        gender = 'Female'
      } else if (g.includes('ຊາຍ')) {
        gender = 'Male'
      } else if (g.includes('ຍິງ')) {
        gender = 'Female'
      }
    }
    
    console.log('✅ Final gender:', gender)
    
    // ສ້າງຊື່ເຕັມ
    let fullName = ''
    if (data.Title) fullName += data.Title + ' '
    if (data.First_Name) fullName += data.First_Name + ' '
    if (data.Last_Name) fullName += data.Last_Name
    fullName = fullName.trim()
    
    const result = {
      patientId: data.Patient_ID || '',
      fullName: fullName,
      firstName: data.First_Name || '',
      lastName: data.Last_Name || '',
      title: data.Title || '',
      gender: gender,
      age: age
    }
    
    console.log('✅ Patient found:', result)
    return result
  } catch (e) {
    console.error('❌ Error searching patient:', e, e.stack)
    return null
  }
}'''

content = content.replace(old_code, new_code)

# Write back
with open(r'C:\Users\Advice_WW\OneDrive\Documents\GitHub\LIS-One-master\src\api.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed! searchPatientById updated with better date parsing and gender handling")
