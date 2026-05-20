#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vblyqilhmkybzbakcyyl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const TABLES = {
  lis_one_settings: ['id', 'type', 'value', 'created_at'],
  lis_one_test_orders: ['id', 'order_id', 'order_datetime', 'patient_id', 'patient_name', 'age', 'gender', 'doctor', 'department', 'visit_type', 'insite', 'time_slot', 'test_type', 'test_name', 'price', 'total_price', 'lab_dest', 'sender', 'status', 'category'],
  lis_one_test_master: ['id', 'name', 'category', 'price'],
  lis_one_audit_log: ['id', 'user_name', 'action', 'target', 'details', 'created_at']
};

function fail(message, extra) {
  console.error(`FAIL: ${message}`);
  if (extra) console.error(typeof extra === 'string' ? extra : JSON.stringify(extra, null, 2));
  process.exitCode = 1;
}

async function rest(table, params = '', options = {}) {
  const separator = params ? '?' : '';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${separator}${params}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

if (!SUPABASE_KEY) {
  fail('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY in environment.');
  process.exit();
}

console.log(`Supabase URL: ${SUPABASE_URL}`);
console.log('Supabase key: present (masked)');

for (const [table, columns] of Object.entries(TABLES)) {
  const probe = await rest(table, `select=${columns.join(',')}&limit=1`);
  if (!probe.ok) {
    fail(`${table} read/schema probe failed`, probe);
  } else {
    const rows = Array.isArray(probe.body) ? probe.body.length : 0;
    console.log(`OK read ${table}: HTTP ${probe.status}, rows=${rows}, columns=${columns.join(',')}`);
  }
}

const marker = `hermes_connection_test_${Date.now()}`;
const insert = await rest('lis_one_audit_log', 'select=id,user_name,action,target,details,created_at', {
  method: 'POST',
  body: JSON.stringify([{ user_name: 'hermes_probe', action: 'connection_test', target: 'supabase_integration', details: marker }])
});

if (!insert.ok || !Array.isArray(insert.body) || insert.body.length !== 1) {
  fail('lis_one_audit_log write test failed', insert);
  process.exit();
}

const insertedId = insert.body[0].id;
console.log(`OK write lis_one_audit_log: inserted id=${insertedId}`);

const cleanup = await rest('lis_one_audit_log', `id=eq.${encodeURIComponent(insertedId)}&select=id`, { method: 'DELETE' });
if (!cleanup.ok) {
  fail('cleanup delete failed; remove audit row manually', { insertedId, cleanup });
} else {
  console.log(`OK cleanup lis_one_audit_log: deleted id=${insertedId}`);
}

if (!process.exitCode) console.log('PASS: Supabase read/write connection is working for LIS One tables.');
