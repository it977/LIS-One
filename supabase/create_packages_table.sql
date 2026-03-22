-- ============================================================
-- TEST PACKAGES TABLE
-- ສຳລັບຈັດການ Package ການກວດ
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

-- 2. Test Package Items (ລາຍການກວດໃນແຕ່ລະ Package)
CREATE TABLE IF NOT EXISTS public.test_package_items (
  id          BIGSERIAL PRIMARY KEY,
  package_id  BIGINT NOT NULL REFERENCES public.test_packages(id) ON DELETE CASCADE,
  test_id     BIGINT NOT NULL REFERENCES public.test_master(id),
  test_name   TEXT NOT NULL,
  price       NUMERIC(12, 2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_packages_active ON public.test_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_package_items_pkg ON public.test_package_items(package_id);

-- RLS
ALTER TABLE public.test_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_package_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_packages" ON public.test_packages FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_package_items" ON public.test_package_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- Insert sample packages (ຕົວຢ່າງ)
INSERT INTO public.test_packages (name, description, price, is_active) VALUES
  ('Check Up ພື້ນຖານ', 'ກວດສຸຂະພາບພື້ນຖານ', 150000, true),
  ('Check Up ລະດັບສູງ', 'ກວດສຸຂະພາບຄົບຊຸດ', 500000, true),
  ('ກວດໂຄວິດ-19', 'PCR Antigen Test', 50000, true)
ON CONFLICT (name) DO NOTHING;
