# ຄູ່ມື Copy ຂໍ້ມູນ LIS ຈາກ Project ເກົ່າໄປໃໝ່

## ວິທີທີ່ງ່າຍທີ່ສຸດ: ໃຊ້ Supabase Dashboard

### ຂັ້ນຕອນທີ 1: ເຂົ້າ Project ເກົ່າ (LIS)

1. ເປີດ Browser
2. ໄປ: https://supabase.com/dashboard/project/qfykgwsrdsdgqymlejdc/sql/new
3. ກົດ **New Query**

### ຂັ້ນຕອນທີ 2: Export ຂໍ້ມູນແຕ່ລະຕາຕະລາງ

#### 2.1 ຕາຕະລາງ lis_users
```sql
SELECT * FROM lis_users;
```
- ກົດ **Run** (ຫຼື Ctrl+Enter)
- ກົດ **⋮** (3 ຈຸດ) ມຸມຂວາເທິງ
- ເລືອກ **Copy as CSV**
- ບັນທຶກເປັນ `lis_users.csv`

#### 2.2 ຕາຕະລາງ lis_settings
```sql
SELECT * FROM lis_settings;
```
- ທຳຄືຂັ້ນຕອນຂ້າງເທິງ
- ບັນທຶກເປັນ `lis_settings.csv`

#### 2.3 ຕາຕະລາງ lis_test_master
```sql
SELECT * FROM lis_test_master;
```
- ທຳຄືຂັ້ນຕອນຂ້າງເທິງ
- ບັນທຶກເປັນ `lis_test_master.csv`

#### 2.4 ຕາຕະລາງອື່ນໆ (ເຮັດຄືກັນ):
- lis_test_packages
- lis_test_package_items
- lis_test_parameters
- lis_test_reagent_mapping
- lis_stock_master
- lis_inventory_lots
- lis_stock_transactions
- lis_test_orders
- lis_test_results
- lis_audit_log
- lis_maintenance_log
- lis_order_attachments

### ຂັ້ນຕອນທີ 3: Import ໄປ Project ໃໝ່ (it977's)

1. ເປີດ tab ໃໝ່
2. ໄປ: https://supabase.com/dashboard/project/erueurkqzmtdefszqons/table-editor

#### ສຳລັບແຕ່ລະຕາຕະລາງ:

1. ກົດທີ່ຊື່ຕາຕະລາງ (ຕົວຢ່າງ: `lis_users`)
2. ກົດ **Insert** (ປຸ່ມສີຂຽວ ມຸມຂວາເທິງ)
3. ເລືອກ **Import data**
4. ລາກໄຟລ໌ CSV ທີ່ບັນທຶກໄວ້ໃສ່
5. ກົດ **Import**
6. ລໍຖ້າໃຫ້ສຳເລັດ

### ຂັ້ນຕອນທີ 4: ກວດສອບ

1. ເຂົ້າ: https://supabase.com/dashboard/project/erueurkqzmtdefszqons/table-editor
2. ກົດແຕ່ລະຕາຕະລາງ ເພື່ອກວດວ່າມີຂໍ້ມູນຄົບຖ້ວນບໍ່

### ຂັ້ນຕອນທີ 5: ປິດ RLS

ເຂົ້າ: https://supabase.com/dashboard/project/erueurkqzmtdefszqons/sql/new

**ວາງ SQL ນີ້ລົງໄປ ແລ້ວກົດ Run:**

```sql
ALTER TABLE lis_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_test_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_test_packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_test_package_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_test_parameters DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_test_reagent_mapping DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_stock_master DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_inventory_lots DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_stock_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_test_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_test_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_maintenance_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE lis_order_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Patients" DISABLE ROW LEVEL SECURITY;
```

### ຂັ້ນຕອນທີ 6: ທົດສອບ Application

1. ເປີດ Browser
2. ໄປ: http://localhost:3001
3. ກົດ **Hard Refresh** (Ctrl+Shift+R)
4. Login ດ້ວຍ: `admin` / `admin1234`
5. ກວດເບິ່ງຂໍ້ມູນວ່າຂຶ້ນຄົບຖ້ວນບໍ່

---

## ✅ ສຳເລັດ!

ຖ້າມີບັນຫາໃດໆ, ຖ່າຍ Screenshot ສົ່ງມາໃຫ້ຂ້ອຍເບິ່ງ!
