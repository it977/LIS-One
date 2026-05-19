/**
 * Shared auth helpers for Cloudflare Pages Functions.
 *
 * Tokens are HMAC-SHA256 signed JSON payloads.
 *   payload = { uid, u, r, exp }       // user id, username, role, expiry epoch
 *   token   = base64url(payload) + "." + base64url(hmac)
 *
 * Secret is read from env.LIS_AUTH_SECRET; if missing, derived from
 * SUPABASE_SERVICE_ROLE_KEY so dev still works without extra config.
 *
 * Permission allow-list is static per role (mirror of seed in migration).
 * Mirroring server-side avoids per-request DB lookups for hot paths.
 */

const TEXT = new TextEncoder();
const TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8h

function b64urlEnc(buf) {
  let s;
  if (typeof buf === 'string') s = btoa(buf);
  else s = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDec(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

async function hmacSha256(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', TEXT.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', key, TEXT.encode(msg));
}

function getSecret(env) {
  return env.LIS_AUTH_SECRET
      || ('lis-one-fallback::' + (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || 'dev'));
}

export async function signToken(env, user) {
  const payload = {
    uid: user.id, u: user.username, r: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  };
  const body = b64urlEnc(JSON.stringify(payload));
  const sig  = b64urlEnc(await hmacSha256(getSecret(env), body));
  return `${body}.${sig}`;
}

export async function verifyToken(env, token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expectedSig = b64urlEnc(await hmacSha256(getSecret(env), body));
  if (expectedSig !== sig) return null;
  let payload;
  try { payload = JSON.parse(b64urlDec(body)); } catch { return null; }
  if (!payload || typeof payload !== 'object') return null;
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  return payload; // { uid, u, r, exp }
}

function headerValue(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || headers.get(name.toLowerCase()) || '';
  const key = name.toLowerCase();
  return headers[key] || headers[name] || '';
}

export function extractToken(request) {
  const headers = request?.headers;
  const h = headerValue(headers, 'authorization');
  if (h && h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  // Allow X-Lis-Token as fallback (for environments stripping Authorization)
  return headerValue(headers, 'x-lis-token') || null;
}

/* ===========================================================
 * Permission matrix (mirror of lis_one_permissions seed)
 * =========================================================== */
const FULL = { s: 1, i: 1, u: 1, d: 1 };
const READ = { s: 1, i: 0, u: 0, d: 0 };
const NONE = { s: 0, i: 0, u: 0, d: 0 };

const PERMISSIONS = {
  admin: { '*': FULL },
  lab_staff: {
    lis_one_test_orders:          { s: 1, i: 1, u: 1, d: 0 },
    lis_one_test_results:         FULL,
    lis_one_test_parameters:      READ,
    lis_one_test_master:          READ,
    lis_one_test_reagent_mapping: READ,
    lis_one_inventory_lots:       { s: 1, i: 1, u: 1, d: 0 },
    lis_one_stock_master:         { s: 1, i: 1, u: 1, d: 0 },
    lis_one_stock_transactions:   { s: 1, i: 1, u: 0, d: 0 },
    lis_one_maintenance_log:      { s: 1, i: 1, u: 1, d: 0 },
    lis_one_patients:             { s: 1, i: 1, u: 1, d: 0 },
    lis_one_settings:             READ,
    lis_one_audit_log:            { s: 1, i: 1, u: 0, d: 0 },
    lis_one_test_packages:        READ,
    lis_one_test_package_items:   READ,
  },
  cashier: {
    lis_one_test_orders:          { s: 1, i: 1, u: 1, d: 0 },
    lis_one_test_results:         READ,
    lis_one_test_parameters:      READ,
    lis_one_test_master:          READ,
    lis_one_test_reagent_mapping: READ,
    lis_one_inventory_lots:       READ,
    lis_one_stock_master:         READ,
    lis_one_stock_transactions:   READ,
    lis_one_patients:             { s: 1, i: 1, u: 1, d: 0 },
    lis_one_settings:             READ,
    lis_one_audit_log:            { s: 1, i: 1, u: 0, d: 0 },
    lis_one_test_packages:        READ,
    lis_one_test_package_items:   READ,
  },
  doctor: {
    lis_one_test_orders:          READ,
    lis_one_test_results:         READ,
    lis_one_test_parameters:      READ,
    lis_one_test_master:          READ,
    lis_one_test_reagent_mapping: READ,
    lis_one_patients:             READ,
    lis_one_settings:             READ,
    lis_one_inventory_lots:       READ,
    lis_one_stock_master:         READ,
    lis_one_audit_log:            READ,
    lis_one_test_packages:        READ,
    lis_one_test_package_items:   READ,
  },
};

const ACTION_KEY = { select: 's', insert: 'i', update: 'u', delete: 'd' };

export function hasPermission(role, table, action) {
  if (!role || !table || !action) return false;
  const map = PERMISSIONS[role];
  if (!map) return false;
  const entry = map['*'] || map[table];
  if (!entry) return false;
  return Boolean(entry[ACTION_KEY[action]]);
}

export function permissionsForRole(role) {
  return PERMISSIONS[role] || {};
}
