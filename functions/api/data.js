export async function onRequestGet() {
  return new Response(JSON.stringify({ status: 'API_ACTIVE', action: 'health' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { table, select, filter, order, limit } = await request.json();
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return new Response(JSON.stringify({ success: false, message: 'Server config missing' }), { status: 500 });
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
    
    if (!response.ok) {
       const err = await response.text();
       return new Response(JSON.stringify({ success: false, error: err }), { status: response.status });
    }

    const data = await response.json();
    // Standardize Response Shape
    return new Response(JSON.stringify({
      success: true,
      data: Array.isArray(data) ? data : (data ? [data] : [])
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
}
