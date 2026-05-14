export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[DEBUG] SUPABASE_URL present:', !!url);
    console.log('[DEBUG] SUPABASE_SERVICE_ROLE_KEY present:', !!key);

    if (!url || !key) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Server configuration missing',
        debug: { hasUrl: !!url, hasKey: !!key }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Using .single() logic via PostgREST headers
    const queryUrl = `${url}/rest/v1/lis_users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=*`;

    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/vnd.pgrst.object+json' // This tells PostgREST to return a single object
      }
    });

    const status = response.status;
    const body = await response.text();
    let json = {};
    try { json = JSON.parse(body); } catch(e) {}

    console.log('[DEBUG] Supabase Response Status:', status);
    console.log('[DEBUG] Supabase Response Body:', body);

    if (response.ok) {
      return new Response(JSON.stringify({
        success: true,
        username: json.username,
        role: json.role,
        row: json // return row for debug as requested
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Supabase Error',
      error: json,
      debug_status: status
    }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: err.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
