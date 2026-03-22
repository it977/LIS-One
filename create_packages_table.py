"""
Create test_packages tables in Supabase
"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

# Use Supabase SQL API via REST
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

sql = """
-- Test Packages
CREATE TABLE IF NOT EXISTS public.test_packages (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  price       NUMERIC(12, 2) DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Test Package Items
CREATE TABLE IF NOT EXISTS public.test_package_items (
  id          BIGSERIAL PRIMARY KEY,
  package_id  BIGINT NOT NULL REFERENCES public.test_packages(id) ON DELETE CASCADE,
  test_id     BIGINT NOT NULL,
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

-- Sample packages
INSERT INTO public.test_packages (name, description, price, is_active) VALUES
  ('Check Up ພື້ນຖານ', 'ກວດສຸຂະພາບພື້ນຖານ', 150000, true),
  ('Check Up ລະດັບສູງ', 'ກວດສຸຂະພາບຄົບຊຸດ', 500000, true),
  ('ກວດໂຄວິດ-19', 'PCR Antigen Test', 50000, true)
ON CONFLICT (name) DO NOTHING;
"""

print("🔧 Creating test_packages tables...")

# Supabase doesn't allow direct SQL execution via REST API
# We need to use the management API or SQL Editor
print("\n⚠️  Supabase REST API doesn't support direct SQL execution.")
print("\n📋 Please follow these steps:")
print("1. Go to: https://supabase.com/dashboard/project/qfykgwsrdsdgqymlejdc/sql")
print("2. Copy and paste the SQL below:")
print("\n" + "="*60)
print(sql)
print("="*60)

# Try to create tables using a workaround - insert a test record
print("\n\nAlternatively, I'll try to create the tables by making API calls...")

# First, let's check if tables exist by trying to query them
url = f"{SUPABASE_URL}/rest/v1/test_packages?select=*&limit=0"
response = requests.get(url, headers=HEADERS)

if response.status_code == 200:
    print("✅ test_packages table already exists!")
elif "does not exist" in response.text.lower() or response.status_code == 404:
    print("❌ test_packages table does not exist")
    print("   You MUST run the SQL in Supabase SQL Editor manually")
else:
    print(f"? Status: {response.status_code} - {response.text[:200]}")
