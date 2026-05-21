import { verifyToken, extractToken } from '../_lib/auth.js';

const ORDER_FILE_BUCKET = 'order-result-files';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
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

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function supabaseRest(env, path, options = {}) {
  const { url, key } = supabaseConfig(env);
  const resp = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await resp.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { resp, body };
}

async function supabaseStorage(env, path, options = {}) {
  const { url, key } = supabaseConfig(env);
  const resp = await fetch(`${url}/storage/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
  const text = await resp.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { resp, body };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  const { url, key } = supabaseConfig(env);
  console.log('[FILES] env url', url);
  if (!key) return json({ success: false, error: 'Supabase env missing' }, 500);

  try {
    const token = extractToken(request);
    const session = await verifyToken(env, token);
    if (!session) return json({ success: false, error: 'Authentication required' }, 401);

    const { file_id, storage_path } = await readBody(request);
    if (!file_id) return json({ success: false, error: 'file_id is required' }, 400);

    let storagePath = String(storage_path || '').trim();
    if (!storagePath) {
      const lookup = await supabaseRest(
        env,
        `lis_one_order_result_files?select=storage_path&id=eq.${encodeURIComponent(file_id)}&limit=1`,
        { method: 'GET' }
      );
      if (!lookup.resp.ok) {
        console.error('[FILES] delete lookup failed', { status: lookup.resp.status, body: lookup.body });
        return json({ success: false, error: 'File lookup failed', detail: lookup.body }, lookup.resp.status);
      }
      storagePath = String((Array.isArray(lookup.body) ? lookup.body[0] : lookup.body)?.storage_path || '').trim();
    }

    console.log('[FILES] delete file', { file_id, storagePath });
    if (storagePath) {
      const storage = await supabaseStorage(env, `object/${ORDER_FILE_BUCKET}/${storagePath}`, { method: 'DELETE' });
      if (!storage.resp.ok) {
        console.error('[FILES] storage delete failed', { status: storage.resp.status, body: storage.body });
        return json({ success: false, error: 'Storage delete failed', detail: storage.body }, storage.resp.status);
      }
    }

    const removed = await supabaseRest(
      env,
      `lis_one_order_result_files?id=eq.${encodeURIComponent(file_id)}`,
      { method: 'DELETE' }
    );
    console.log('[FILES] delete row', removed.body);
    if (!removed.resp.ok) {
      console.error('[FILES] delete row failed', { status: removed.resp.status, body: removed.body });
      return json({ success: false, error: 'Delete failed', detail: removed.body }, removed.resp.status);
    }

    return json({ success: true, deleted: removed.body || [] });
  } catch (err) {
    console.error('[FILES] delete error', err);
    return json({ success: false, error: err.message }, 500);
  }
}
