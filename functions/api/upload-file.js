import { verifyToken, extractToken } from '../_lib/auth.js';

const ORDER_FILE_BUCKET = 'order-result-files';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function supabaseConfig(env) {
  return {
    url: env.SUPABASE_URL || 'https://erueurkqzmtdefszqons.supabase.co',
    key: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  };
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

function dataUrlToBytes(base64) {
  const binary = atob(String(base64 || '').split(',')[1] || base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function onRequestPost({ request, env }) {
  const { url, key } = supabaseConfig(env);
  console.log('[FILES] env url', url);
  if (!key) return json({ success: false, error: 'Supabase env missing' }, 500);

  try {
    const token = extractToken(request);
    const session = await verifyToken(env, token);
    if (!session) return json({ success: false, error: 'Authentication required' }, 401);

    const { order_id, file_name, file_type, file_size, base64 } = await request.json();
    const cleanOrderId = String(order_id || '').trim();
    console.log('[FILES] upload orderId', cleanOrderId);
    if (!cleanOrderId || !file_name || !base64) return json({ success: false, error: 'Missing required fields' }, 400);

    const timestamp = Date.now();
    const safeName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${cleanOrderId}/${timestamp}-${safeName}`;
    console.log('[FILES] upload storage path', storagePath);

    const upload = await supabaseStorage(env, `object/${ORDER_FILE_BUCKET}/${storagePath}`, {
      method: 'POST',
      headers: { 'Content-Type': file_type || 'application/octet-stream' },
      body: dataUrlToBytes(base64)
    });
    if (!upload.resp.ok) return json({ success: false, error: 'Storage upload failed', detail: upload.body }, upload.resp.status);

    const meta = await supabaseRest(env, 'lis_one_order_result_files?select=*', {
      method: 'POST',
      body: JSON.stringify([{
        order_id: cleanOrderId,
        file_name: String(file_name),
        file_type: String(file_type || 'application/octet-stream'),
        file_size: Number(file_size) || 0,
        storage_path: storagePath,
        uploaded_by: session.u || session.username || 'unknown'
      }])
    });
    if (!meta.resp.ok) return json({ success: false, error: 'Metadata insert failed', detail: meta.body }, meta.resp.status);

    const inserted = Array.isArray(meta.body) ? meta.body[0] : meta.body;
    console.log('[FILES] inserted row', inserted);
    return json({
      success: true,
      file: inserted,
      public_url: `${url}/storage/v1/object/public/${ORDER_FILE_BUCKET}/${storagePath}`
    });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}
