# ການຕິດຕັ້ງລະບົບຈັດການ Package

## ຂັ້ນຕອນທີ 1: ສ້າງຕາຕະລາງໃນ Supabase

1. ເຂົ້າ: https://supabase.com/dashboard/project/qfykgwsrdsdgqymlejdc/sql
2. Copy SQL ດ້ານລຸ່ມນີ້ໄປ Paste ແລ້ວກົດ **Run**

```sql
-- Test Packages (ຊື່ Package)
CREATE TABLE IF NOT EXISTS public.test_packages (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  price       NUMERIC(12, 2) DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Test Package Items (ລາຍການກວດໃນ Package)
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

-- Sample Packages (ຕົວຢ່າງ)
INSERT INTO public.test_packages (name, description, price, is_active) VALUES
  ('Check Up ພື້ນຖານ', 'ກວດສຸຂະພາບພື້ນຖານ', 150000, true),
  ('Check Up ລະດັບສູງ', 'ກວດສຸຂະພາບຄົບຊຸດ', 500000, true),
  ('ກວດໂຄວິດ-19', 'PCR Antigen Test', 50000, true)
ON CONFLICT (name) DO NOTHING;
```

## ຂັ້ນຕອນທີ 2: ທົດສອບລະບົບ

1. ເປີດໂປຣແກຣມ:
```bash
npm run dev
```

2. ເຂົ້າໃຊ້ງານດ້ວຍ `admin` / `admin1234`

3. ໄປທີ່ **ຕັ້ງຄ່າລະບົບ (Setup)** → ຈະເຫັນສ່ວນ **ຈັດການ Package ການກວດ**

4. ທົດສອບ:
   - ✅ ສ້າງ Package ໃໝ່
   - ✅ ເພີ່ມລາຍການກວດໃສ່ Package
   - ✅ ແກ້ໄຂ/ລຶບ Package
   - ✅ ໄປສັ່ງກວດ → ເລືອກ **Package** → ເລືອກ Package → ລາຍການຈະຂຶ້ນ Auto

## ຄຸນສົມບັດ:

### 1. ຈັດການ Package (Setup)
- ✅ ສ້າງ Package ໃໝ່
- ✅ ກຳນົດຊື່, ລາຄາ, ຄຳອະທິບາຍ
- ✅ ເພີ່ມລາຍການກວດຫຼາຍຢ່າງໃສ່ Package
- ✅ ແກ້ໄຂ/ລຶບ Package
- ✅ ປິດ/ເປີດ ການໃຊ້ງານ Package

### 2. ສັ່ງກວດ (Order Form)
- ✅ ເລືອກ **Pricing Type = Package**
- ✅ ເລືອກ Package ຈາກ Dropdown
- ✅ ລາຍການກວດຈະຂຶ້ນຕາມທີ່ຕັ້ງໄວ້ອັດຕະໂນມັດ
- ✅ ລາຄາຈະຂຶ້ນຕາມ Package ທີ່ເລືອກ

## ໂຄງສ້າງຂໍ້ມູນ:

```
test_packages
├── id (Auto)
├── name (ຊື່ Package)
├── description (ຄຳອະທິບາຍ)
├── price (ລາຄາ Package)
└── is_active (ສະຖານະ)

test_package_items
├── id (Auto)
├── package_id (FK → test_packages)
├── test_id (FK → test_master)
├── test_name (ຊື່ລາຍການກວດ)
└── price (ລາຄາ)
```

## ຕົວຢ່າງການໃຊ້ງານ:

1. **ສ້າງ Package "Check Up ພື້ນຖານ"**
   - ລາຄາ: 150,000 ₭
   - ລາຍການ:
     - CBC
     - Glucose
     - Cholesterol

2. **ເວລາສັ່ງກວດ:**
   - ເລືອກ Pricing Type: **Package**
   - ເລືອກ: **Check Up ພື້ນຖານ**
   - ລາຍການ CBC, Glucose, Cholesterol ຈະຂຶ້ນອັດຕະໂນມັດ
   - ລາຄາລວມ: 150,000 ₭

---

**ສະຖານະ:** ✅ ສຳເລັດ
**ວັນທີ:** 2026-03-18
