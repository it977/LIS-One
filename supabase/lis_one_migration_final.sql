-- ============================================================
-- LIS System - Supabase PostgreSQL Schema
-- VersionMatch: aligned with src/api.js column names
-- ============================================================
-- Run this in the Supabase SQL Editor

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_users (
  id         BIGSERIAL PRIMARY KEY,
  username   TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'User',  -- 'Admin' or 'User'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. SETTINGS  (dropdown options: VisitType, Insite, Doctor…)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_settings (
  id         BIGSERIAL PRIMARY KEY,
  type       TEXT NOT NULL,   -- 'VisitType','Insite','Doctor','Department','Sender','LabDest'
  value      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TEST MASTER  (ລາຍການກວດ)
-- api.js: selects d.id, d.name, d.price, d.category
--         inserts { name, price, category }
--         orders by 'category', 'name'
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_test_master (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT,
  price      NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. TEST PARAMETERS  (ຄ່າ reference ສຳລັບກວດ)
-- api.js: inserts { test_name, param_name, input_type, options, unit, normal_min, normal_max }
--         orders by 'test_name'
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_test_parameters (
  id          BIGSERIAL PRIMARY KEY,
  test_name   TEXT NOT NULL,
  param_name  TEXT NOT NULL,
  input_type  TEXT DEFAULT 'number',  -- 'number', 'text', 'select'
  options     TEXT,                   -- comma-separated options for select type
  unit        TEXT,
  normal_min  NUMERIC,
  normal_max  NUMERIC,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. TEST REAGENT MAPPING  (ການໃຊ້ reagent ຕໍ່ test)
-- api.js: inserts { test_name, reagent_id, reagent_name, qty }
--         orders by 'test_name'
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_test_reagent_mapping (
  id           BIGSERIAL PRIMARY KEY,
  test_name    TEXT NOT NULL,
  reagent_id   BIGINT NOT NULL,
  reagent_name TEXT,
  qty          NUMERIC(10, 4) DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. STOCK MASTER  (ລາຍການ reagent/ສິ່ງໂພດທີ)
-- api.js: selects d.id, d.name, d.unit
--         inserts { name, unit }
--         orders by 'name'
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_stock_master (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  unit       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. INVENTORY LOTS  (ລາຍລະອຽດ lot - FIFO source of truth)
-- api.js: inserts { lot_id, reagent_id, reagent_name, lot_no,
--                   supplier, location, receive_date, exp_date,
--                   qty, qty_remaining }
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_inventory_lots (
  id            BIGSERIAL PRIMARY KEY,
  lot_id        TEXT NOT NULL UNIQUE,
  reagent_id    BIGINT NOT NULL,
  reagent_name  TEXT,
  lot_no        TEXT,
  supplier      TEXT,
  location      TEXT,
  receive_date  DATE DEFAULT CURRENT_DATE,
  exp_date      DATE,
  qty           NUMERIC(10, 4) DEFAULT 0,
  qty_remaining NUMERIC(10, 4) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. STOCK TRANSACTIONS  (ປະຫວັດ IN/OUT)
-- api.js: inserts { reagent_id, reagent_name, type, qty, note, user_name }
--         selects d.reagent_id, d.reagent_name, d.type, d.qty, d.note, d.user_name
--         updates { qty, note }
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_stock_transactions (
  id           BIGSERIAL PRIMARY KEY,
  reagent_id   BIGINT NOT NULL,
  reagent_name TEXT,
  type         TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  qty          NUMERIC(10, 4) NOT NULL,
  note         TEXT,
  user_name    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. TEST ORDERS  (ໃບສັ່ງກວດ — one row per test item)
-- api.js: inserts one row per cart item with all patient+test fields
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_test_orders (
  id             BIGSERIAL PRIMARY KEY,
  order_id       TEXT NOT NULL,
  order_datetime TIMESTAMPTZ DEFAULT NOW(),
  time_slot      TEXT,
  visit_type     TEXT,
  insite         TEXT,
  patient_id     TEXT,
  patient_name   TEXT NOT NULL,
  age            TEXT,
  gender         TEXT,
  doctor         TEXT,
  department     TEXT,
  test_type      TEXT DEFAULT 'Normal',  -- 'Normal', 'Package'
  test_name      TEXT,
  price          NUMERIC(12, 2) DEFAULT 0,
  total_price    NUMERIC(12, 2) DEFAULT 0,
  lab_dest       TEXT DEFAULT 'In-house',
  sender         TEXT,
  status         TEXT DEFAULT 'Pending',  -- 'Pending','Completed','Cancelled','Received'
  category       TEXT,
  completed_at   TIMESTAMPTZ,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. TEST RESULTS  (ຜົນກວດ)
-- api.js: inserts { order_id, test_name, param_name, result_value, flag, user_name }
--         selects d.test_name, d.param_name, d.result_value, d.flag
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_test_results (
  id           BIGSERIAL PRIMARY KEY,
  order_id     TEXT NOT NULL,
  test_name    TEXT NOT NULL,
  param_name   TEXT NOT NULL,
  result_value TEXT,
  flag         TEXT DEFAULT 'Normal',  -- 'H', 'L', 'Normal'
  user_name    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. MAINTENANCE LOG  (ບັນທຶກການບຳລຸງຮັກສາ)
-- api.js: inserts { log_id, log_date, machine, type, issues, action, next_due, user_name }
--         selects d.log_id, d.log_date, d.machine, d.type, d.issues, d.action, d.next_due, d.user_name
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_maintenance_log (
  id         BIGSERIAL PRIMARY KEY,
  log_id     TEXT NOT NULL UNIQUE,
  log_date   DATE DEFAULT CURRENT_DATE,
  machine    TEXT NOT NULL,
  type       TEXT,       -- 'Preventive', 'Corrective', etc.
  issues     TEXT,
  action     TEXT,
  next_due   DATE,
  user_name  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. AUDIT LOG
-- api.js: inserts { user_name, action, target, details }
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lis_one_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_name  TEXT,
  action     TEXT,
  target     TEXT,
  details    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lis_one_test_orders_order_id     ON public.lis_one_test_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_lis_one_test_orders_datetime     ON public.lis_one_test_orders(order_datetime);
CREATE INDEX IF NOT EXISTS idx_lis_one_test_orders_status       ON public.lis_one_test_orders(status);
CREATE INDEX IF NOT EXISTS idx_lis_one_test_results_order_id    ON public.lis_one_test_results(order_id);
CREATE INDEX IF NOT EXISTS idx_lis_one_stock_trans_reagent_id   ON public.lis_one_stock_transactions(reagent_id);
CREATE INDEX IF NOT EXISTS idx_lis_one_stock_trans_created      ON public.lis_one_stock_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_lis_one_stock_trans_type         ON public.lis_one_stock_transactions(type);
CREATE INDEX IF NOT EXISTS idx_lis_one_inventory_lots_reagent   ON public.lis_one_inventory_lots(reagent_id);
CREATE INDEX IF NOT EXISTS idx_lis_one_inventory_lots_exp       ON public.lis_one_inventory_lots(exp_date);
CREATE INDEX IF NOT EXISTS idx_lis_one_test_params_test_name    ON public.lis_one_test_parameters(test_name);
CREATE INDEX IF NOT EXISTS idx_lis_one_trm_test_name            ON public.lis_one_test_reagent_mapping(test_name);
CREATE INDEX IF NOT EXISTS idx_lis_one_settings_type            ON public.lis_one_settings(type);
CREATE INDEX IF NOT EXISTS idx_lis_one_audit_log_created        ON public.lis_one_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_lis_one_maint_log_date           ON public.lis_one_maintenance_log(log_date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.lis_one_users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_test_master          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_test_parameters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_test_reagent_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_stock_master         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_inventory_lots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_stock_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_test_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_test_results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_maintenance_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_audit_log            ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (app uses its own login, not Supabase Auth)
CREATE POLICY "lis_one_anon_all_users"    ON public.lis_one_users                FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_settings" ON public.lis_one_settings             FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_tm"       ON public.lis_one_test_master          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_tp"       ON public.lis_one_test_parameters      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_trm"      ON public.lis_one_test_reagent_mapping FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_sm"       ON public.lis_one_stock_master         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_il"       ON public.lis_one_inventory_lots       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_st"       ON public.lis_one_stock_transactions   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_to"       ON public.lis_one_test_orders          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_tr"       ON public.lis_one_test_results         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_ml"       ON public.lis_one_maintenance_log      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_al"       ON public.lis_one_audit_log            FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- SEED: Default admin user
-- ============================================================
INSERT INTO public.lis_one_users (username, password, role)
VALUES ('admin', 'admin1234', 'Admin')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- SEED: Sample settings
-- ============================================================
INSERT INTO public.lis_one_settings (type, value) VALUES
  ('VisitType', 'OPD'), ('VisitType', 'IPD'), ('VisitType', 'Emergency'),
  ('Insite', 'ໂຮງໝໍ A'), ('Insite', 'ໂຮງໝໍ B'),
  ('Doctor', 'ທ. ສົມສາກ'), ('Doctor', 'ທ. ນາງ ວິໄລ'),
  ('Department', 'ອາຍຸລະກຳ'), ('Department', 'ຜ່າຕັດ'),
  ('Sender', 'ພະຍາບານ A'),
  ('LabDest', 'In-house'), ('LabDest', 'ຫ້ອງທົດລອງ 1')
ON CONFLICT DO NOTHING;

-- PKG TABLES --

-- ============================================================
-- TEST PACKAGES TABLES - LIS System
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Test Packages (ຊື່ Package)
CREATE TABLE IF NOT EXISTS public.lis_one_test_packages (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  price       NUMERIC(12, 2) DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Test Package Items (ລາຍການກວດໃນ Package)
CREATE TABLE IF NOT EXISTS public.lis_one_test_package_items (
  id          BIGSERIAL PRIMARY KEY,
  package_id  BIGINT NOT NULL REFERENCES public.lis_one_test_packages(id) ON DELETE CASCADE,
  test_id     BIGINT NOT NULL,
  test_name   TEXT NOT NULL,
  price       NUMERIC(12, 2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lis_one_packages_active ON public.lis_one_test_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_lis_one_package_items_pkg ON public.lis_one_test_package_items(package_id);

-- Enable Row Level Security
ALTER TABLE public.lis_one_test_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_one_test_package_items ENABLE ROW LEVEL SECURITY;

-- Create policies (allow anon access - app handles auth)
CREATE POLICY "lis_one_anon_all_packages" ON public.lis_one_test_packages FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lis_one_anon_all_package_items" ON public.lis_one_test_package_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- Sample packages (optional - can be removed)
INSERT INTO public.lis_one_test_packages (name, description, price, is_active) VALUES
  ('Check Up ພື້ນຖານ', 'ກວດສຸຂະພາບພື້ນຖານ', 150000, true),
  ('Check Up ລະດັບສູງ', 'ກວດສຸຂະພາບຄົບຊຸດ', 500000, true),
  ('ກວດໂຄວິດ-19', 'PCR Antigen Test', 50000, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- DONE! ✅
-- ============================================================