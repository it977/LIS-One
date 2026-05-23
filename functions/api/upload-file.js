import { authRequestDiagnostics, resolveAuth } from '../_lib/auth.js';

const ORDER_FILE_BUCKET = 'order-result-files';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Lis-Token, x-lis-token'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

function fail(stage, status, authSource, user, error, detail = null) {
  console.error('[FILES] upload failed', { stage, status, authSource, user, error, detail });
  return json({ success: false, stage, authSource, user, error, detail }, status);
}

function supabaseConfig(env) {
  return {
    url: env.SUPABASE_URL || 'https://erueurkqzmtdefszqons.supabase.co',
    key: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
    keySource: env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : (env.SUPABASE_ANON_KEY ? 'anon' : (env.VITE_SUPABASE_ANON_KEY ? 'vite_anon' : 'missing'))
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

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function dataUrlToBytes(base64) {
  const binary = atob(String(base64 || '').split(',')[1] || base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function withPublicUrl(url, file) {
  if (!file || typeof file !== 'object') return null;
  return {
    ...file,
    order_id: String(file.order_id || '').trim(),
    public_url: `${url}/storage/v1/object/public/${ORDER_FILE_BUCKET}/${file.storage_path}`
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') return fail('method', 405, 'none', null, 'Method not allowed');

  const { url, key, keySource } = supabaseConfig(env);
  const requestHeaders = authRequestDiagnostics(request);
  console.log('[FILES] upload diagnostics', {
    keySource,
    env: {
      hasSupabaseUrl: Boolean(env.SUPABASE_URL),
      hasServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      hasAnonKey: Boolean(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY)
    },
    requestHeaders
  });
  if (!key) return fail('env', 500, 'none', null, 'Supabase env missing', { keySource });

  let authSource = 'missing';
  let user = null;
  try {
    const auth = await resolveAuth(request, env);
    authSource = auth.authSource;
    user = auth.user;
    if (!auth.token) return fail('auth_missing', 401, authSource, user, 'Authentication required', requestHeaders);
    if (!auth.session) return fail('auth_verify', 401, authSource, user, 'Authentication required', requestHeaders);
    const session = auth.session;
    console.log('[FILES] upload auth resolved', { authSource, user });

    const { order_id, file_name, file_type, file_size, base64 } = await readBody(request);
    const cleanOrderId = String(order_id || '').trim();
    console.log('[FILES] upload payload', {
      order_id: cleanOrderId,
      file_name: file_name || null,
      file_type: file_type || null,
      file_size: Number(file_size) || 0,
      hasBase64: Boolean(base64),
      base64Length: typeof base64 === 'string' ? base64.length : 0
    });
    if (!cleanOrderId || !file_name || !base64) {
      return fail('payload', 400, authSource, user, 'Missing required fields', {
        hasOrderId: Boolean(cleanOrderId),
        hasFileName: Boolean(file_name),
        hasBase64: Boolean(base64)
      });
    }

    const timestamp = Date.now();
    const safeName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${cleanOrderId}/${timestamp}-${safeName}`;
    console.log('[FILES] upload storage path', storagePath);

    const upload = await supabaseStorage(env, `object/${ORDER_FILE_BUCKET}/${storagePath}`, {
      method: 'POST',
      headers: { 'Content-Type': file_type || 'application/octet-stream' },
      body: dataUrlToBytes(base64)
    });
    if (!upload.resp.ok) {
      return fail('storage_upload', upload.resp.status, authSource, user, 'Storage upload failed', upload.body);
    }

    const metaPayload = {
      order_id: cleanOrderId,
      file_name: String(file_name),
      file_type: String(file_type || 'application/octet-stream'),
      file_size: Number(file_size) || 0,
      storage_path: storagePath,
      uploaded_by: session.u || session.username || 'unknown'
    };
    console.log('[FILES] insert payload', {
      order_id: metaPayload.order_id,
      file_name: metaPayload.file_name,
      file_type: metaPayload.file_type,
      file_size: metaPayload.file_size,
      storage_path: metaPayload.storage_path,
      uploaded_by: metaPayload.uploaded_by
    });
    const meta = await supabaseRest(env, 'lis_one_order_result_files?select=*', {
      method: 'POST',
      body: JSON.stringify(metaPayload)
    });
    console.log('[FILES] insert response', { status: meta.resp.status, body: meta.body });
    if (!meta.resp.ok) {
      console.error('[FILES] metadata insert failed', { status: meta.resp.status, body: meta.body });
      await supabaseStorage(env, `object/${ORDER_FILE_BUCKET}/${storagePath}`, { method: 'DELETE' }).catch((cleanupErr) => {
        console.error('[FILES] storage cleanup after metadata failure failed', cleanupErr);
      });
      return fail('metadata_insert', meta.resp.status, authSource, user, 'Metadata insert failed', meta.body);
    }

    const inserted = Array.isArray(meta.body) ? meta.body[0] : meta.body;
    console.log('[FILES] inserted row', inserted);
    if (!inserted?.id) {
      console.error('[FILES] metadata insert returned no row', { order_id: cleanOrderId, body: meta.body });
      await supabaseStorage(env, `object/${ORDER_FILE_BUCKET}/${storagePath}`, { method: 'DELETE' }).catch((cleanupErr) => {
        console.error('[FILES] storage cleanup after empty metadata response failed', cleanupErr);
      });
      return fail('metadata_insert_empty', 500, authSource, user, 'Metadata insert returned no row', meta.body);
    }

    const verify = await supabaseRest(
      env,
      `lis_one_order_result_files?select=*&id=eq.${encodeURIComponent(inserted.id)}&order_id=eq.${encodeURIComponent(cleanOrderId)}&limit=1`,
      { method: 'GET' }
    );
    if (!verify.resp.ok) {
      return fail('metadata_verify', verify.resp.status, authSource, user, 'Metadata verify failed', verify.body);
    }
    const verified = Array.isArray(verify.body) ? verify.body[0] : verify.body;
    console.log('[FILES] verified inserted row', { order_id: cleanOrderId, row: verified });
    const fileRow = withPublicUrl(url, verified || inserted);
    return json({
      success: true,
      order_id: cleanOrderId,
      file: fileRow,
      data: fileRow ? [fileRow] : [],
      public_url: fileRow?.public_url || `${url}/storage/v1/object/public/${ORDER_FILE_BUCKET}/${storagePath}`
    });
  } catch (err) {
    console.error('[FILES] upload error', err);
    return fail('exception', 500, authSource, user, err.message, String(err?.stack || ''));
  }
}
