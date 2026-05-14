export async function onRequestGet({ env }) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  let supabaseResult = null;

  if (url && key) {
    try {
      // Testing the correct table: lis_one_users
      const resp = await fetch(`${url}/rest/v1/lis_one_users?select=id,username&limit=1`, {
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
    check: "LIS_ONE_USERS_SYNC",
    env_present: { url: !!url, key: !!key },
    supabase_test: supabaseResult
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
