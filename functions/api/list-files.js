const ORDER_FILE_BUCKET = 'order-result-files';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

function supabaseConfig(env) {
  return {
    url: env.SUPABASE_URL || 'https://erueurkqzmtdefszqons.supabase.co',
    key: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  };
}

async function supabaseRest(env, path) {
  const { url, key } = supabaseConfig(env);
  const resp = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  });
  const text = await resp.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { resp, body };
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (!['GET', 'POST'].includes(request.method)) return json({ success: false, error: 'Method not allowed' }, 405);

  const { url, key } = supabaseConfig(env);
  console.log('[FILES] env url', url);
  if (!key) return json({ success: false, error: 'Supabase env missing' }, 500);

  try {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const params = new URL(request.url).searchParams;
    const order_id = request.method === 'GET' ? params.get('order_id') : body.order_id;
    const cleanOrderId = String(order_id || '').trim();
    console.log('[FILES] list orderId', cleanOrderId);
    if (!cleanOrderId) return json({ success: false, error: 'order_id is required' }, 400);

    const { resp, body } = await supabaseRest(
      env,
      `lis_one_order_result_files?select=*&order_id=eq.${encodeURIComponent(cleanOrderId)}&order=uploaded_at.desc`
    );
    if (!resp.ok) return json({ success: false, error: body }, resp.status);

    const rows = (Array.isArray(body) ? body : []).map(file => ({
      ...file,
      public_url: `${url}/storage/v1/object/public/${ORDER_FILE_BUCKET}/${file.storage_path}`
    }));
    console.log('[FILES] list rows', rows);
    return json({ success: true, data: rows });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}
