export async function onRequestPost({ request, env }) {
  try {
    const { table, select, filter, order, limit } = await request.json();
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) return new Response('Missing config', { status: 500 });

    let queryUrl = `${url}/rest/v1/${table}?select=${select || '*'}`;
    if (filter) queryUrl += `&${filter}`;
    if (order) queryUrl += `&order=${order}`;
    if (limit) queryUrl += `&limit=${limit}`;

    const response = await fetch(queryUrl, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
