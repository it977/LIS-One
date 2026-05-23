import { authRequestDiagnostics, resolveAuth } from '../_lib/auth.js';

const ORDER_FILE_BUCKET = 'order-result-files';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Lis-Token, x-lis-token'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

function fail(stage, status, authSource, user, error, detail = null) {
  console.error('[FILES] delete failed', { stage, status, authSource, user, error, detail });
  return json({ success: false, stage, authSource, user, error, detail }, status);
}

function supabaseConfig(env) {
  return {
    url: env.SUPABASE_URL || 'https://erueurkqzmtdefszqons.supabase.co',
    key: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
    keySource: env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : (env.SUPABASE_ANON_KEY ? 'anon' : (env.VITE_SUPABASE_ANON_KEY ? 'vite_anon' : 'missing'))
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

function normalizeStoragePath(value) {
  let raw = String(value || '').trim();
  if (!raw || raw === 'undefined' || raw === 'null') return '';

  try {
    const parsed = new URL(raw);
    raw = parsed.pathname;
  } catch {}

  try { raw = decodeURIComponent(raw); } catch {}
  raw = raw.replace(/\\/g, '/').replace(/^\/+/, '');

  const objectMarker = 'storage/v1/object/';
  const markerIndex = raw.indexOf(objectMarker);
  if (markerIndex >= 0) raw = raw.slice(markerIndex + objectMarker.length);

  const parts = raw.split('/').filter(Boolean);
  if (['public', 'sign', 'authenticated'].includes(parts[0])) parts.shift();
  if (parts[0] === ORDER_FILE_BUCKET) parts.shift();

  return parts.join('/');
}

function isMissingObject(body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body || {});
  return /not.?found|does not exist|404/i.test(text);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') return fail('method', 405, 'none', null, 'Method not allowed');

  const { url, key, keySource } = supabaseConfig(env);
  const requestHeaders = authRequestDiagnostics(request);
  console.log('[FILES] delete diagnostics', {
    url,
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
    console.log('[FILES] delete auth resolved', { authSource, user });

    const { file_id, storage_path, public_url, path } = await readBody(request);
    console.log('[FILES] delete payload', {
      file_id: file_id || null,
      hasStoragePath: Boolean(storage_path || path),
      hasPublicUrl: Boolean(public_url)
    });
    if (!file_id) return fail('payload', 400, authSource, user, 'file_id is required');

    const lookup = await supabaseRest(
      env,
      `lis_one_order_result_files?select=*&id=eq.${encodeURIComponent(file_id)}&limit=1`,
      { method: 'GET' }
    );
    if (!lookup.resp.ok) {
      return fail('metadata_lookup', lookup.resp.status, authSource, user, 'File lookup failed', lookup.body);
    }
    const row = Array.isArray(lookup.body) ? lookup.body[0] : lookup.body;
    let storagePath = normalizeStoragePath(row?.storage_path || storage_path || path || row?.public_url || public_url);

    console.log('[FILES] delete file', { file_id, storagePath, requestStoragePath: storage_path || null, requestPublicUrl: public_url || null, dbStoragePath: row?.storage_path || null });
    let warning;
    if (storagePath) {
      const storage = await supabaseStorage(env, `object/${ORDER_FILE_BUCKET}/${storagePath}`, { method: 'DELETE' });
      if (!storage.resp.ok) {
        if (isMissingObject(storage.body)) {
          warning = 'Storage object already missing; DB row deleted only';
          console.warn('[FILES] storage object already missing; deleting DB row only', { status: storage.resp.status, body: storage.body, pathUsed: storagePath });
        } else {
          console.error('[FILES] storage delete failed', { status: storage.resp.status, body: storage.body, pathUsed: storagePath });
          return fail('storage_delete', storage.resp.status, authSource, user, 'Storage delete failed', {
            body: storage.body,
            pathUsed: storagePath
          });
        }
      }
    } else {
      warning = 'No storage path found; DB row deleted only';
      console.warn('[FILES] no storage path found; deleting DB row only', { file_id });
    }

    const removed = await supabaseRest(
      env,
      `lis_one_order_result_files?id=eq.${encodeURIComponent(file_id)}`,
      { method: 'DELETE' }
    );
    console.log('[FILES] delete row', removed.body);
    if (!removed.resp.ok) {
      return fail('metadata_delete', removed.resp.status, authSource, user, 'Delete failed', {
        body: removed.body,
        pathUsed: storagePath
      });
    }

    return json({
      success: true,
      deleted: removed.body || [],
      pathUsed: storagePath,
      warning
    });
  } catch (err) {
    console.error('[FILES] delete error', err);
    return fail('exception', 500, authSource, user, err.message, String(err?.stack || ''));
  }
}
