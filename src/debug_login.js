import { createClient } from '@supabase/supabase-js'
const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(URL, KEY)

export async function loginUser(u, p) {
  console.log('[PROD-DEBUG] Attempting login for:', u)
  const { data, error } = await supabase
    .from('lis_users')
    .select('username, password, role')
    .eq('username', u.trim())
    .eq('password', p.trim())
    .single()
  
  if (error || !data) {
     console.error('[PROD-DEBUG] Login Failed:', error)
     return { success: false, message: error?.message || 'Invalid' }
  }
  console.log('[PROD-DEBUG] Login Success:', data.username)
  return { success: true, username: data.username, role: data.role }
}
