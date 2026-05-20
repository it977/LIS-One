import { signToken } from '../_lib/auth.js';
import { hashPassword, verifyPassword } from '../_lib/password.js';
import { checkRateLimit, getClientIp } from '../_lib/rate-limit.js';

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
}

async function migrateLegacyPassword(env, userId, password) {
  const url = env.SUPABASE_URL || 'https://erueurkqzmtdefszqons.supabase.co';
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!key || !userId) return false;
  const password_hash = await hashPassword(password);
  if (!password_hash) return false;
  const resp = await fetch(`${url}/rest/v1/lis_one_users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: supabaseHeaders(key),
    body: JSON.stringify({ password_hash, password: null })
  });
  return resp.ok;
}

export async function onRequestPost({ request, env }) {
  try {
    const ip = getClientIp(request);
    const { username = '', password = '' } = await request.json();
    const safeUser = String(username || '').trim().toLowerCase();

    if (!safeUser || !password) {
      return json({ success: false, message: 'Username and password are required' }, 400);
    }

    const bucket = checkRateLimit(`login:${ip}:${safeUser}`, { limit: 5, windowMs: 10 * 60 * 1000 });
    if (!bucket.allowed) {
      return json(
        { success: false, message: `Too many login attempts. Retry in ${bucket.retryAfterSeconds}s` },
        429,
        { 'Retry-After': String(bucket.retryAfterSeconds) }
      );
    }

    const url = env.SUPABASE_URL || 'https://erueurkqzmtdefszqons.supabase.co';
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
    if (!key) return json({ success: false, message: 'Server config missing' }, 500);

    const queryUrl = `${url}/rest/v1/lis_one_users?username=eq.${encodeURIComponent(safeUser)}&select=*&limit=1`;
    const response = await fetch(queryUrl, { headers: supabaseHeaders(key) });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return json({ success: false, message: 'Login query failed', error: data }, response.status);
    }

    const user = Array.isArray(data) ? data[0] : data;
    if (!user) {
      return json({ success: false, message: 'Invalid credentials' }, 401);
    }

    let authenticated = false;
    let usedLegacyPassword = false;

    if (user.password_hash) {
      authenticated = await verifyPassword(password, user.password_hash);
    }

    if (!authenticated && typeof user.password === 'string' && user.password === password) {
      authenticated = true;
      usedLegacyPassword = true;
    }

    if (!authenticated) {
      return json({ success: false, message: 'Invalid credentials' }, 401);
    }

    if (usedLegacyPassword) {
      await migrateLegacyPassword(env, user.id, password).catch(() => null);
    }

    const role = user.role || 'doctor';
    const token = await signToken(env, { id: user.id, username: user.username, role });

    return json({
      success: true,
      id: user.id,
      username: user.username,
      role,
      token,
      migrated: usedLegacyPassword
    });
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}
