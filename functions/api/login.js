export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();
    const url = env.SUPABASE_URL || 'https://vblyqilhmkybzbakcyyl.supabase.co';
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!key) {
      return new Response(JSON.stringify({ success: false, message: 'Server config missing' }), { status: 500, headers: {'Content-Type':'application/json'} });
    }

    const queryUrl = `${url}/rest/v1/lis_one_users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=username,id,role`;

    const response = await fetch(queryUrl, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/vnd.pgrst.object+json'
      }
    });

    if (response.ok) {
      const user = await response.json();
      return new Response(JSON.stringify({ success: true, username: user.username, role: user.role }), { headers: {'Content-Type':'application/json'} });
    }

    return new Response(JSON.stringify({ success: false, message: 'Invalid credentials' }), { status: 401, headers: {'Content-Type':'application/json'} });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500, headers: {'Content-Type':'application/json'} });
  }
}
