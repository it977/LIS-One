const ORDER_FILE_BUCKET = 'order-result-files';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Lis-Token, x-lis-token, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
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

function normalizeStoragePath(value) {
  let raw = String(value || '').trim();
  if (!raw || raw === 'undefined' || raw === 'null') return '';

  try {
    raw = new URL(raw).pathname;
  } catch {}

  try { raw = decodeURIComponent(raw); } catch {}
  raw = raw.replace(/\\/g, '/').replace(/^\/+/, '');

  const marker = 'storage/v1/object/';
  const markerIndex = raw.indexOf(marker);
  if (markerIndex >= 0) raw = raw.slice(markerIndex + marker.length);

  const parts = raw.split('/').filter(Boolean);
  if (['public', 'sign', 'authenticated'].includes(parts[0])) parts.shift();
  if (parts[0] === ORDER_FILE_BUCKET) parts.shift();
  return parts.join('/');
}

function encodeStorageObjectPath(storagePath) {
  return String(storagePath || '').split('/').map(encodeURIComponent).join('/');
}

async function storageResponse(env, storagePath, request) {
  const { url, key } = supabaseConfig(env);
  const range = request.headers.get('range');
  return fetch(`${url}/storage/v1/object/${ORDER_FILE_BUCKET}/${encodeStorageObjectPath(storagePath)}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(range ? { Range: range } : {})
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (!['GET', 'HEAD'].includes(request.method)) return json({ success: false, error: 'Method not allowed' }, 405);

  const { key } = supabaseConfig(env);
  if (!key) return json({ success: false, error: 'Supabase env missing' }, 500);

  try {
    const params = new URL(request.url).searchParams;
    const fileId = params.get('file_id') || '';
    let row = null;

    if (fileId) {
      const lookup = await supabaseRest(env, `lis_one_order_result_files?select=*&id=eq.${encodeURIComponent(fileId)}&limit=1`);
      if (!lookup.resp.ok) return json({ success: false, error: 'File lookup failed', detail: lookup.body }, lookup.resp.status);
      row = Array.isArray(lookup.body) ? lookup.body[0] : lookup.body;
    }

    const storagePath = normalizeStoragePath(row?.storage_path || params.get('storage_path') || params.get('path') || params.get('public_url'));
    if (!storagePath) return json({ success: false, error: 'storage_path or file_id is required' }, 400);

    const file = await storageResponse(env, storagePath, request);
    if (!file.ok) {
      return json({ success: false, error: 'Storage read failed', detail: await file.text().catch(() => ''), pathUsed: storagePath }, file.status);
    }

    const originalName = String(row?.file_name || storagePath.split('/').pop() || 'result-file');
    const fileName = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/[\r\n"\\]/g, '_') || 'result-file.pdf';
    const headers = {
      ...CORS_HEADERS,
      'Content-Type': row?.file_type || file.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=300'
    };
    const contentLength = file.headers.get('content-length');
    const contentRange = file.headers.get('content-range');
    if (contentLength) headers['Content-Length'] = contentLength;
    if (contentRange) headers['Content-Range'] = contentRange;

    return new Response(request.method === 'HEAD' ? null : file.body, {
      status: file.status,
      headers: {
        ...headers
      }
    });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}
