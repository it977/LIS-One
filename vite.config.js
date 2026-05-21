import { defineConfig, loadEnv } from 'vite'
import { verifyToken, extractToken, hasPermission, signToken } from './functions/_lib/auth.js'
import { checkRateLimit, getClientIp } from './functions/_lib/rate-limit.js'
import { verifyPassword, hashPassword } from './functions/_lib/password.js'

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function encodePostgrestFragment(fragment) {
  return String(fragment || '').replace(/%(?![0-9A-Fa-f]{2})/g, '%25')
}

const APP_VERSION = `${process.env.npm_package_version || 'dev'}-${new Date().toISOString()}`
const READ_ONLY_HIS_TABLES = new Set(['HIS_One_Patients'])

function localSupabaseApi(env) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://erueurkqzmtdefszqons.supabase.co'
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY

  async function supabaseRest(path, options = {}) {
    const resp = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(options.headers || {})
      }
    })
    const text = await resp.text()
    let body = null
    try { body = text ? JSON.parse(text) : null } catch { body = text }
    return { resp, body }
  }

  return {
    name: 'local-supabase-api',
    configureServer(server) {
      server.middlewares.use('/api/login', async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { success: false, message: 'Method not allowed' })
        if (!supabaseUrl || !supabaseKey) return sendJson(res, 500, { success: false, message: 'Supabase env missing' })

        try {
          const ip = getClientIp(req)
          const { username = '', password = '' } = await readJsonBody(req)
          const safeUser = String(username || '').trim().toLowerCase()
          if (!safeUser || !password) return sendJson(res, 400, { success: false, message: 'Username and password are required' })

          const bucket = checkRateLimit(`login:${ip}:${safeUser}`, { limit: 5, windowMs: 10 * 60 * 1000 })
          if (!bucket.allowed) return sendJson(res, 429, { success: false, message: `Too many login attempts. Retry in ${bucket.retryAfterSeconds}s` })

          const query = `lis_one_users?username=eq.${encodeURIComponent(safeUser)}&select=*&limit=1`
          const { resp, body } = await supabaseRest(query)

          if (!resp.ok) return sendJson(res, resp.status, { success: false, message: 'Login query failed', error: body })
          const user = Array.isArray(body) ? body[0] : body
          if (!user) return sendJson(res, 401, { success: false, message: 'Invalid credentials' })

          let authenticated = false
          let usedLegacyPassword = false
          if (user.password_hash) authenticated = await verifyPassword(password, user.password_hash)
          if (!authenticated && typeof user.password === 'string' && user.password === password) {
            authenticated = true
            usedLegacyPassword = true
          }
          if (!authenticated) return sendJson(res, 401, { success: false, message: 'Invalid credentials' })

          if (usedLegacyPassword) {
            const password_hash = await hashPassword(password)
            if (password_hash) {
              await supabaseRest(`lis_one_users?id=eq.${encodeURIComponent(user.id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ password_hash, password: null })
              }).catch(() => null)
            }
          }

          const token = await signToken({
            SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
            SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
            VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY
          }, { id: user.id, username: user.username, role: user.role || 'doctor' })

          return sendJson(res, 200, { success: true, id: user.id, username: user.username, role: user.role || 'doctor', token, migrated: usedLegacyPassword })
        } catch (err) {
          return sendJson(res, 500, { success: false, message: err.message })
        }
      })

      server.middlewares.use('/api/data', async (req, res) => {
        if (req.method === 'GET') return sendJson(res, 200, { status: 'API_ACTIVE', runtime: 'vite-dev' })
        if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method not allowed' })
        if (!supabaseUrl || !supabaseKey) return sendJson(res, 500, { success: false, error: 'Supabase env missing' })

        try {
          const ip = getClientIp(req)
          const { action = 'select', table, select, filter, order, limit, payload, match, functionName } = await readJsonBody(req)

          const ACTION_WHITELIST = new Set(['select', 'insert', 'update', 'delete', 'rpc'])
          if (!ACTION_WHITELIST.has(action)) return sendJson(res, 400, { success: false, error: 'Invalid action' })

          const isRpc = action === 'rpc'
          const isLisTable = /^(lis_one_|test_packages|test_package_items)[a-z0-9_]*$/.test(table || '')
          const isValidRpcFn = isRpc && typeof functionName === 'string' && /^lis_one_[a-z0-9_]+$/.test(functionName)
          const isReadOnlyHisTable = action === 'select' && READ_ONLY_HIS_TABLES.has(table)
          if (!isLisTable && !isReadOnlyHisTable && !isValidRpcFn) return sendJson(res, 400, { success: false, error: isRpc ? 'Invalid function name' : 'Invalid table name' })

          if (action !== 'select') {
            const token = extractToken(req)
            const session = await verifyToken({ SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY }, token)
            if (!session) return sendJson(res, 401, { success: false, error: 'Authentication required' })
            const permTable = isRpc ? 'lis_one_stock_transactions' : table
            if (!hasPermission(session.r, permTable, isRpc ? 'insert' : action)) {
              return sendJson(res, 403, { success: false, error: `Forbidden: role "${session.r}" cannot ${action} ${isRpc ? functionName : table}` })
            }
            const bucket = checkRateLimit(`mut:${ip}:${session.uid || 'anon'}:${action}:${isRpc ? functionName : table}`, { limit: 60, windowMs: 60 * 1000 })
            if (!bucket.allowed) return sendJson(res, 429, { success: false, error: `Too many ${action} requests. Retry in ${bucket.retryAfterSeconds}s` })
          }

          let path
          let method = 'GET'
          let body

          if (isRpc) {
            path = `rpc/${functionName}`
            method = 'POST'
            body = JSON.stringify(payload || {})
          } else if (action === 'insert') {
            method = 'POST'
            path = `${table}?select=${select || '*'}`
            body = JSON.stringify(payload)
          } else if (action === 'update') {
            if (!match && !filter) throw new Error('update requires match or filter')
            method = 'PATCH'
            path = `${table}?${match || encodePostgrestFragment(filter)}&select=${select || '*'}`
            body = JSON.stringify(payload)
          } else if (action === 'delete') {
            if (!match && !filter) throw new Error('delete requires match or filter')
            method = 'DELETE'
            path = `${table}?${match || encodePostgrestFragment(filter)}&select=${select || '*'}`
          } else {
            path = `${table}?select=${select || '*'}`
            if (filter) path += `&${encodePostgrestFragment(filter)}`
            if (order) path += `&order=${order}`
            if (limit) path += `&limit=${limit}`
          }

          const { resp, body: data } = await supabaseRest(path, { method, body })
          if (!resp.ok) console.warn('[api/data] Supabase upstream error:', { status: resp.status, path, body: data })
          return sendJson(res, resp.ok ? 200 : resp.status, {
            success: resp.ok,
            data: Array.isArray(data) ? data : (data ? [data] : []),
            error: resp.ok ? undefined : data
          })
        } catch (err) {
          return sendJson(res, 500, { success: false, error: err.message })
        }
      })

      server.middlewares.use('/api/report-screenshot', async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { success: false });
        try {
          const { image } = await readJsonBody(req);
          if (!image) return sendJson(res, 400, { success: false });
          const base64Data = image.replace(/^data:image\/png;base64,/, "");
          const fs = await import('fs');
          const path = await import('path');
          const dir = path.join(process.cwd(), 'test-results');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir);
          fs.writeFileSync(path.join(dir, 'dashboard-after-login.png'), base64Data, 'base64');
          console.log('[API] Screenshot saved to test-results/dashboard-after-login.png');
          return sendJson(res, 200, { success: true });
        } catch (err) {
          return sendJson(res, 500, { success: false, error: err.message });
        }
      })

      const ORDER_FILE_BUCKET = 'order-result-files';

      async function supabaseStorage(path, options = {}) {
        const resp = await fetch(`${supabaseUrl}/storage/v1/${path}`, {
          ...options,
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            ...(options.headers || {})
          }
        });
        const text = await resp.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null } catch { body = text }
        return { resp, body };
      }

      server.middlewares.use('/api/upload-file', async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method not allowed' });
        if (!supabaseUrl || !supabaseKey) return sendJson(res, 500, { success: false, error: 'Supabase env missing' });
        try {
          const token = extractToken(req);
          const session = await verifyToken({ SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY }, token);
          if (!session) return sendJson(res, 401, { success: false, error: 'Authentication required' });
          const { order_id, file_name, file_type, file_size, base64 } = await readJsonBody(req);
          const cleanOrderId = String(order_id || '').trim();
          console.log('[FILES] env url', supabaseUrl);
          console.log('[FILES] upload orderId', cleanOrderId);
          if (!cleanOrderId || !file_name || !base64) return sendJson(res, 400, { success: false, error: 'Missing required fields' });
          const timestamp = Date.now();
          const safeName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `${cleanOrderId}/${timestamp}-${safeName}`;
          console.log('[FILES] upload storage path', storagePath);
          const binaryStr = atob(base64.split(',')[1] || base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          const { resp: uploadResp } = await supabaseStorage(`object/${ORDER_FILE_BUCKET}/${storagePath}`, {
            method: 'POST',
            headers: { 'Content-Type': file_type || 'application/octet-stream' },
            body: bytes
          });
          if (!uploadResp.ok) return sendJson(res, uploadResp.status, { success: false, error: 'Storage upload failed' });
          const { resp: metaResp, body: metaBody } = await supabaseRest(`lis_one_order_result_files?select=*`, {
            method: 'POST',
            body: JSON.stringify([{
              order_id: cleanOrderId,
              file_name: String(file_name),
              file_type: String(file_type || 'application/octet-stream'),
              file_size: Number(file_size) || 0,
              storage_path: storagePath,
              uploaded_by: session.username || 'unknown'
            }])
          });
          if (!metaResp.ok) return sendJson(res, metaResp.status, { success: false, error: 'Metadata insert failed', detail: metaBody });
          const inserted = Array.isArray(metaBody) ? metaBody[0] : metaBody;
          console.log('[FILES] inserted row', inserted);
          return sendJson(res, 200, {
            success: true,
            file: inserted,
            public_url: `${supabaseUrl}/storage/v1/object/public/${ORDER_FILE_BUCKET}/${storagePath}`
          });
        } catch (err) {
          return sendJson(res, 500, { success: false, error: err.message });
        }
      })

      server.middlewares.use('/api/list-files', async (req, res) => {
        if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method not allowed' });
        if (!supabaseUrl || !supabaseKey) return sendJson(res, 500, { success: false, error: 'Supabase env missing' });
        try {
          const { order_id } = await readJsonBody(req);
          const cleanOrderId = String(order_id || '').trim();
          console.log('[FILES] env url', supabaseUrl);
          console.log('[FILES] list orderId', cleanOrderId);
          if (!cleanOrderId) return sendJson(res, 400, { success: false, error: 'order_id is required' });
          const { resp, body } = await supabaseRest(
            `lis_one_order_result_files?select=*&order_id=eq.${encodeURIComponent(cleanOrderId)}&order=uploaded_at.desc`,
            { method: 'GET' }
          );
          if (!resp.ok) return sendJson(res, resp.status, { success: false, error: body });
          const files = (Array.isArray(body) ? body : []).map(f => ({
            ...f,
            public_url: `${supabaseUrl}/storage/v1/object/public/${ORDER_FILE_BUCKET}/${f.storage_path}`
          }));
          console.log('[FILES] list rows', files);
          return sendJson(res, 200, { success: true, data: files });
        } catch (err) {
          return sendJson(res, 500, { success: false, error: err.message });
        }
      })

      server.middlewares.use('/api/delete-file', async (req, res) => {
        if (req.method === 'OPTIONS') return sendJson(res, 200, { success: true });
        if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method not allowed' });
        if (!supabaseUrl || !supabaseKey) return sendJson(res, 500, { success: false, error: 'Supabase env missing' });
        try {
          const token = extractToken(req);
          const session = await verifyToken({ SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY }, token);
          if (!session) return sendJson(res, 401, { success: false, error: 'Authentication required' });
          const { file_id, storage_path } = await readJsonBody(req);
          if (!file_id) return sendJson(res, 400, { success: false, error: 'file_id is required' });
          let storagePath = String(storage_path || '').trim();
          if (!storagePath) {
            const { resp: lookupResp, body: lookupBody } = await supabaseRest(
              `lis_one_order_result_files?select=storage_path&id=eq.${encodeURIComponent(file_id)}&limit=1`,
              { method: 'GET' }
            );
            if (!lookupResp.ok) return sendJson(res, lookupResp.status, { success: false, error: 'File lookup failed', detail: lookupBody });
            storagePath = String((Array.isArray(lookupBody) ? lookupBody[0] : lookupBody)?.storage_path || '').trim();
          }
          console.log('[FILES] delete file', { file_id, storagePath });
          if (storagePath) {
            const { resp: storageResp, body: storageBody } = await supabaseStorage(`object/${ORDER_FILE_BUCKET}/${storagePath}`, { method: 'DELETE' });
            if (!storageResp.ok) return sendJson(res, storageResp.status, { success: false, error: 'Storage delete failed', detail: storageBody });
          }
          const { resp, body } = await supabaseRest(`lis_one_order_result_files?id=eq.${encodeURIComponent(file_id)}`, {
            method: 'DELETE'
          });
          console.log('[FILES] delete row', body);
          return sendJson(res, resp.ok ? 200 : resp.status, {
            success: resp.ok,
            deleted: body,
            error: resp.ok ? undefined : 'Delete failed'
          });
        } catch (err) {
          return sendJson(res, 500, { success: false, error: err.message });
        }
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    root: '.',
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION)
    },
    plugins: [localSupabaseApi(env)],
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: './index.html',
          labResult: './LabResult_System.html'
        }
      }
    },
    server: {
      host: '127.0.0.1',
      port: 3000,
      strictPort: true,
      open: true,
      hmr: {
        protocol: 'ws',
        host: '127.0.0.1'
      },
      watch: {
        usePolling: true,
        interval: 300,
        ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      }
    }
  }
})
