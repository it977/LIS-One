-- ============================================================
-- TEST PACKAGES TABLES - LIS System
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Test Packages (ຊື່ Package)
CREATE TABLE IF NOT EXISTS public.test_packages (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  price       NUMERIC(12, 2) DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Test Package Items (ລາຍການກວດໃນ Package)
CREATE TABLE IF NOT EXISTS public.test_package_items (
  id          BIGSERIAL PRIMARY KEY,
  package_id  BIGINT NOT NULL REFERENCES public.test_packages(id) ON DELETE CASCADE,
  test_id     BIGINT NOT NULL,
  test_name   TEXT NOT NULL,
  price       NUMERIC(12, 2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_packages_active ON public.test_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_package_items_pkg ON public.test_package_items(package_id);

-- Enable Row Level Security
ALTER TABLE public.test_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_package_items ENABLE ROW LEVEL SECURITY;

-- Create policies (allow anon access - app handles auth)
CREATE POLICY "anon_all_packages" ON public.test_packages FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_package_items" ON public.test_package_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- Sample packages (optional - can be removed)
INSERT INTO public.test_packages (name, description, price, is_active) VALUES
  ('Check Up ພື້ນຖານ', 'ກວດສຸຂະພາບພື້ນຖານ', 150000, true),
  ('Check Up ລະດັບສູງ', 'ກວດສຸຂະພາບຄົບຊຸດ', 500000, true),
  ('ກວດໂຄວິດ-19', 'PCR Antigen Test', 50000, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- DONE! ✅
-- ============================================================
