import { verifyToken, extractToken, hasPermission } from '../_lib/auth.js';
import { checkRateLimit, getClientIp } from '../_lib/rate-limit.js';

export async function onRequestGet({ request }) {
  return new Response(JSON.stringify({ status: 'API_ACTIVE', action: 'health' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

const READ_ONLY_HIS_TABLES = new Set(['HIS_One_Patients']);

const allowedTable = (table, action = 'select') =>
  typeof table === 'string' &&
  (/^lis_one_[a-z0-9_]+$/.test(table) ||
    (action === 'select' && READ_ONLY_HIS_TABLES.has(table)));

const ACTION_WHITELIST = new Set(['select', 'insert', 'update', 'delete', 'rpc']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const ip = getClientIp(request);
    const {
      action = 'select',
      table, select, filter, order, limit, payload, match, functionName
    } = await request.json();

    if (!ACTION_WHITELIST.has(action)) {
      return json({ success: false, error: 'Invalid action' }, 400);
    }
    if (action === 'rpc') {
      if (typeof functionName !== 'string' || !/^lis_one_[a-z0-9_]+$/.test(functionName)) {
        return json({ success: false, error: 'Invalid function name' }, 400);
      }
    } else if (!allowedTable(table, action)) {
      return json({ success: false, error: 'Invalid table name' }, 400);
    }

    // ---- AuthN / AuthZ ----
    // SELECT is permitted without token for backwards-compatibility with the
    // existing public dashboard charts.  Mutations always require a valid
    // bearer token + role permission.
    let session = null;
    if (action !== 'select') {
      const token = extractToken(request);
      session = await verifyToken(env, token);
      if (!session) return json({ success: false, error: 'Authentication required' }, 401);
      const permissionTable = action === 'rpc' ? 'lis_one_stock_transactions' : table;
      if (!hasPermission(session.r, permissionTable, action === 'rpc' ? 'insert' : action)) {
        return json({ success: false, error: `Forbidden: role "${session.r}" cannot ${action} ${table}` }, 403);
      }

      const bucket = checkRateLimit(`mut:${ip}:${session.uid || 'anon'}:${action}:${table || functionName}`, { limit: 60, windowMs: 60 * 1000 });
      if (!bucket.allowed) {
        return json(
          { success: false, error: `Too many ${action} requests. Retry in ${bucket.retryAfterSeconds}s` },
          429,
          { 'Retry-After': String(bucket.retryAfterSeconds) }
        );
      }
    }

    const url = env.SUPABASE_URL || 'https://erueurkqzmtdefszqons.supabase.co';
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
    if (!key) return json({ success: false, error: 'Database key not configured' }, 500);

    let queryUrl = action === 'rpc'
      ? `${url}/rest/v1/rpc/${functionName}`
      : `${url}/rest/v1/${table}`;
    const headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    let method = 'GET';
    let body;

    if (action === 'rpc') {
      method = 'POST';
      body = JSON.stringify(payload || {});
    } else if (action === 'insert') {
      method = 'POST';
      queryUrl += `?select=${select || '*'}`;
      body = JSON.stringify(payload);
    } else if (action === 'update') {
      if (!match && !filter) return json({ success: false, error: 'update requires match or filter' }, 400);
      method = 'PATCH';
      queryUrl += `?${match || filter}&select=${select || '*'}`;
      body = JSON.stringify(payload);
    } else if (action === 'delete') {
      if (!match && !filter) return json({ success: false, error: 'delete requires match or filter' }, 400);
      method = 'DELETE';
      queryUrl += `?${match || filter}&select=${select || '*'}`;
    } else {
      queryUrl += `?select=${select || '*'}`;
      if (filter) queryUrl += `&${filter}`;
      if (order)  queryUrl += `&order=${order}`;
      if (limit)  queryUrl += `&limit=${limit}`;
    }

    const response = await fetch(queryUrl, { method, headers, body });
    const data = await response.json().catch(() => null);

    return json({
      success: response.ok,
      data: Array.isArray(data) ? data : (data ? [data] : []),
      error: response.ok ? undefined : data
    }, response.ok ? 200 : response.status);
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}
