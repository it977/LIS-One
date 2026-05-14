export async function onRequestGet({ env }) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  const debugInfo = {
    url: url || 'MISSING',
    key_prefix: key ? key.substring(0, 20) + '...' : 'MISSING',
    key_length: key ? key.length : 0,
    timestamp: new Date().toISOString()
  };

  let supabaseResult = null;

  if (url && key) {
    try {
      const resp = await fetch(`${url}/rest/v1/lis_users?select=id,username&limit=1`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      supabaseResult = {
        status: resp.status,
        body: await resp.text()
      };
    } catch (err) {
      supabaseResult = { error: err.message };
    }
  }

  return new Response(JSON.stringify({
    env: debugInfo,
    supabase_test: supabaseResult
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
