export async function onRequestGet({ request }) {
  return new Response(JSON.stringify({ status: 'API_ACTIVE', action: 'health' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { table, select, filter, order, limit } = await request.json();
    const url = env.SUPABASE_URL || 'https://vblyqilhmkybzbakcyyl.supabase.co';
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!key) {
      return new Response(JSON.stringify({ success: false, error: 'Database key not configured in Cloudflare' }), { status: 500 });
    }

    let queryUrl = `${url}/rest/v1/${table}?select=${select || '*'}`;
    if (filter) queryUrl += `&${filter}`;
    if (order) queryUrl += `&order=${order}`;
    if (limit) queryUrl += `&limit=${limit}`;

    const response = await fetch(queryUrl, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    const data = await response.json();
    return new Response(JSON.stringify({
      success: response.ok,
      data: Array.isArray(data) ? data : (data ? [data] : [])
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
