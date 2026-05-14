export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Server configuration missing'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // UPDATED TABLE: lis_one_users (Verified from schema audit)
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
      return new Response(JSON.stringify({
        success: true,
        username: user.username,
        role: user.role
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const errorBody = await response.text();
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Invalid credentials or matching user not found',
      error: errorBody
    }), { 
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
}
