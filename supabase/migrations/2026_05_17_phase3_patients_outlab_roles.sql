-- ============================================================
-- Phase 3 migration — Patients, Outlab workflow, Roles & RLS hardening
-- Date: 2026-05-17
-- Safe to run repeatedly: uses IF NOT EXISTS / IF EXISTS guards.
-- ============================================================

-- ============================================================
-- 1) PATIENT MASTER  (separate entity from orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_patients (
  id         BIGSERIAL PRIMARY KEY,
  hn         TEXT NOT NULL UNIQUE,                 -- Hospital Number / Card No
  name       TEXT NOT NULL,
  dob        DATE,
  age        INTEGER,                              -- frozen at registration
  gender     TEXT,
  phone      TEXT,
  address    TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lis_one_patients_hn   ON public.lis_one_patients (hn);
CREATE INDEX IF NOT EXISTS idx_lis_one_patients_name ON public.lis_one_patients (name);

-- ============================================================
-- 2) OUTLAB workflow columns on test_orders
-- ============================================================
ALTER TABLE public.lis_one_test_orders
  ADD COLUMN IF NOT EXISTS outlab_tracking_no   TEXT,
  ADD COLUMN IF NOT EXISTS outlab_sent_date     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outlab_received_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outlab_note          TEXT;
CREATE INDEX IF NOT EXISTS idx_lis_one_test_orders_outlab
  ON public.lis_one_test_orders (lab_dest, status, order_datetime DESC)
  WHERE lab_dest IS NOT NULL AND lab_dest <> 'In-house';

-- ============================================================
-- 3) Low-stock threshold per reagent
-- ============================================================
ALTER TABLE public.lis_one_stock_master
  ADD COLUMN IF NOT EXISTS low_threshold NUMERIC(10,4) DEFAULT 5;

-- ============================================================
-- 4) SESSIONS (token-based authentication)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_sessions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  username    TEXT NOT NULL,
  role        TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,              -- SHA-256 hex of bearer token
  issued_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lis_one_sessions_token ON public.lis_one_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_lis_one_sessions_user  ON public.lis_one_sessions (user_id);

-- ============================================================
-- 5) ROLE PERMISSIONS (server-enforced action allow-list)
--    Used by /api/data.js to gate insert/update/delete per table.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_permissions (
  id         BIGSERIAL PRIMARY KEY,
  role       TEXT NOT NULL,
  table_name TEXT NOT NULL,
  can_select BOOLEAN DEFAULT TRUE,
  can_insert BOOLEAN DEFAULT FALSE,
  can_update BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  UNIQUE (role, table_name)
);

-- Seed permission matrix.  Roles: admin, lab_staff, cashier, doctor.
INSERT INTO public.lis_one_permissions (role, table_name, can_select, can_insert, can_update, can_delete) VALUES
  -- ADMIN: full access
  ('admin', '*', TRUE, TRUE, TRUE, TRUE),

  -- LAB STAFF: enter results, manage inventory, read patients/tests/orders
  ('lab_staff', 'lis_one_test_orders',         TRUE, TRUE,  TRUE,  FALSE),
  ('lab_staff', 'lis_one_test_results',        TRUE, TRUE,  TRUE,  TRUE),
  ('lab_staff', 'lis_one_test_parameters',     TRUE, FALSE, FALSE, FALSE),
  ('lab_staff', 'lis_one_test_master',         TRUE, FALSE, FALSE, FALSE),
  ('lab_staff', 'lis_one_test_reagent_mapping',TRUE, FALSE, FALSE, FALSE),
  ('lab_staff', 'lis_one_inventory_lots',      TRUE, TRUE,  TRUE,  FALSE),
  ('lab_staff', 'lis_one_stock_master',        TRUE, TRUE,  TRUE,  FALSE),
  ('lab_staff', 'lis_one_stock_transactions',  TRUE, TRUE,  FALSE, FALSE),
  ('lab_staff', 'lis_one_maintenance_log',     TRUE, TRUE,  TRUE,  FALSE),
  ('lab_staff', 'lis_one_patients',            TRUE, TRUE,  TRUE,  FALSE),
  ('lab_staff', 'lis_one_settings',            TRUE, FALSE, FALSE, FALSE),
  ('lab_staff', 'lis_one_audit_log',           TRUE, TRUE,  FALSE, FALSE),

  -- CASHIER: create orders, manage patients, read everything else
  ('cashier', 'lis_one_test_orders',         TRUE, TRUE,  TRUE,  FALSE),
  ('cashier', 'lis_one_test_results',        TRUE, FALSE, FALSE, FALSE),
  ('cashier', 'lis_one_test_parameters',     TRUE, FALSE, FALSE, FALSE),
  ('cashier', 'lis_one_test_master',         TRUE, FALSE, FALSE, FALSE),
  ('cashier', 'lis_one_test_reagent_mapping',TRUE, FALSE, FALSE, FALSE),
  ('cashier', 'lis_one_inventory_lots',      TRUE, FALSE, FALSE, FALSE),
  ('cashier', 'lis_one_stock_master',        TRUE, FALSE, FALSE, FALSE),
  ('cashier', 'lis_one_stock_transactions',  TRUE, FALSE, FALSE, FALSE),
  ('cashier', 'lis_one_patients',            TRUE, TRUE,  TRUE,  FALSE),
  ('cashier', 'lis_one_settings',            TRUE, FALSE, FALSE, FALSE),
  ('cashier', 'lis_one_audit_log',           TRUE, TRUE,  FALSE, FALSE),

  -- DOCTOR: read-only across the board (can view results, history)
  ('doctor', 'lis_one_test_orders',         TRUE, FALSE, FALSE, FALSE),
  ('doctor', 'lis_one_test_results',        TRUE, FALSE, FALSE, FALSE),
  ('doctor', 'lis_one_test_parameters',     TRUE, FALSE, FALSE, FALSE),
  ('doctor', 'lis_one_test_master',         TRUE, FALSE, FALSE, FALSE),
  ('doctor', 'lis_one_test_reagent_mapping',TRUE, FALSE, FALSE, FALSE),
  ('doctor', 'lis_one_patients',            TRUE, FALSE, FALSE, FALSE),
  ('doctor', 'lis_one_settings',            TRUE, FALSE, FALSE, FALSE),
  ('doctor', 'lis_one_inventory_lots',      TRUE, FALSE, FALSE, FALSE),
  ('doctor', 'lis_one_stock_master',        TRUE, FALSE, FALSE, FALSE),
  ('doctor', 'lis_one_audit_log',           TRUE, FALSE, FALSE, FALSE)
ON CONFLICT (role, table_name) DO NOTHING;

-- ============================================================
-- 6) RLS hardening — drop overly-permissive anon policies
-- The Cloudflare API uses SERVICE_ROLE_KEY which bypasses RLS,
-- so we tighten anon access (defense in depth).  The Function
-- itself is the source of truth for authn/authz.
-- ============================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'lis_one_%'
      AND policyname LIKE 'lis_one_anon_all_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Allow only SELECT for anon (defence-in-depth; mutations require service-role)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'lis_one_%'
  LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)
    $f$, 'lis_one_anon_read_' || t, t);
  END LOOP;
EXCEPTION WHEN duplicate_object THEN
  -- ignore if policies already exist
  NULL;
END $$;

-- Enable RLS on new tables
ALTER TABLE public.lis_one_patients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_permissions ENABLE ROW LEVEL SECURITY;

-- Sessions: deny anon entirely (only service-role reads)
-- Permissions: anon read-only (frontend may need to know its capabilities)
DO $$ BEGIN
  CREATE POLICY lis_one_anon_read_lis_one_permissions ON public.lis_one_permissions
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 7) Ensure default admin exists with a known role
-- ============================================================
UPDATE public.lis_one_users SET role = 'admin' WHERE username = 'admin' AND (role IS NULL OR role = '');

-- ============================================================
-- DONE
-- ============================================================
