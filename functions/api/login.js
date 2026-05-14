export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return new Response(JSON.stringify({ success: false, message: 'Server configuration missing' }), { status: 500 });
    }

    const queryUrl = `${url}/rest/v1/lis_users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=username,role`;

    const response = await fetch(queryUrl, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    const users = await response.json();

    if (users && users.length > 0) {
      return new Response(JSON.stringify({
        success: true,
        username: users[0].username,
        role: users[0].role
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, message: 'Invalid credentials' }), { status: 401 });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
}
