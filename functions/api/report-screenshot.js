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

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const { image } = await request.json().catch(() => ({}));
    if (!image) return json({ success: false, error: 'image is required' }, 400);
    console.log('[API] Screenshot reported', { bytes: String(image).length });
    return json({ success: true });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}
