-- ============================================================
-- LIS Tables for it977's Project
-- ສ້າງຕາຕະລາງ LIS ທັງົດໃນ it977's Project
-- ============================================================

-- 1. LIS Users (ຜູ້ໃຊ້ລະບົບ LIS)
CREATE TABLE IF NOT EXISTS LIS_Users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'User',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LIS Settings (ຕັ້ງຄ່າຕ່າງໆ)
CREATE TABLE IF NOT EXISTS LIS_Settings (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. LIS Test Master (ລາຍການກວດ)
CREATE TABLE IF NOT EXISTS LIS_Test_Master (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LIS Test Packages (Package ການກວດ)
CREATE TABLE IF NOT EXISTS LIS_Test_Packages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. LIS Test Package Items (ລາຍການໃນ Package)
CREATE TABLE IF NOT EXISTS LIS_Test_Package_Items (
  id BIGSERIAL PRIMARY KEY,
  package_id BIGINT REFERENCES LIS_Test_Packages(id) ON DELETE CASCADE,
  test_id BIGINT REFERENCES LIS_Test_Master(id),
  test_name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. LIS Test Parameters (ພາຣາມີເຕີການກວດ)
CREATE TABLE IF NOT EXISTS LIS_Test_Parameters (
  id BIGSERIAL PRIMARY KEY,
  test_name TEXT NOT NULL,
  param_name TEXT NOT NULL,
  input_type TEXT NOT NULL DEFAULT 'Text',
  options TEXT,
  unit TEXT,
  normal_min NUMERIC,
  normal_max NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LIS Test Reagent Mapping (ການເຊື່ອມໂຍງນ້ຳຢາ)
CREATE TABLE IF NOT EXISTS LIS_Test_Reagent_Mapping (
  id BIGSERIAL PRIMARY KEY,
  test_name TEXT NOT NULL,
  reagent_id BIGINT,
  reagent_name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. LIS Stock Master (ນ້ຳຢາ)
CREATE TABLE IF NOT EXISTS LIS_Stock_Master (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. LIS Inventory Lots (Lot ນ້ຳຢາ)
CREATE TABLE IF NOT EXISTS LIS_Inventory_Lots (
  lot_id TEXT PRIMARY KEY,
  reagent_id BIGINT REFERENCES LIS_Stock_Master(id),
  reagent_name TEXT NOT NULL,
  lot_no TEXT,
  supplier TEXT,
  location TEXT,
  receive_date DATE,
  exp_date DATE,
  qty NUMERIC NOT NULL,
  qty_remaining NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. LIS Stock Transactions (ປະຫວັດນ້ຳຢາ)
CREATE TABLE IF NOT EXISTS LIS_Stock_Transactions (
  id BIGSERIAL PRIMARY KEY,
  reagent_id BIGINT,
  reagent_name TEXT NOT NULL,
  type TEXT NOT NULL, -- IN / OUT
  qty NUMERIC NOT NULL,
  note TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. LIS Test Orders (ໃບສັ່ງກວດ) - ເຊື່ອມໂຍງກັບ Patients table
CREATE TABLE IF NOT EXISTS LIS_Test_Orders (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  order_datetime TIMESTAMPTZ NOT NULL,
  time_slot TEXT,
  visit_type TEXT,
  insite TEXT,
  patient_id TEXT NOT NULL, -- ເຊື່ອມໂຍງກັບ Patients.Patient_ID
  patient_name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  doctor TEXT,
  department TEXT,
  test_type TEXT NOT NULL DEFAULT 'Normal',
  test_name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  lab_dest TEXT,
  sender TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  category TEXT,
  note TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ສ້າງ Index ເພື່ອຄົ້ນຫາໄວຂຶ້ນ
CREATE INDEX IF NOT EXISTS idx_lis_orders_patient ON LIS_Test_Orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lis_orders_datetime ON LIS_Test_Orders(order_datetime);
CREATE INDEX IF NOT EXISTS idx_lis_orders_status ON LIS_Test_Orders(status);

-- 12. LIS Test Results (ຜົນການກວດ)
CREATE TABLE IF NOT EXISTS LIS_Test_Results (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  param_name TEXT NOT NULL,
  result_value TEXT,
  unit TEXT,
  normal_min NUMERIC,
  normal_max NUMERIC,
  flag TEXT, -- H / L / Normal
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. LIS Audit Log (ປະຫວັດການໃຊ້ງານ)
CREATE TABLE IF NOT EXISTS LIS_Audit_Log (
  id BIGSERIAL PRIMARY KEY,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. LIS Maintenance Log (ບຳລຸງັກສາເຄ່ອງຈັກ)
CREATE TABLE IF NOT EXISTS LIS_Maintenance_Log (
  id BIGSERIAL PRIMARY KEY,
  device_name TEXT NOT NULL,
  maintenance_date DATE NOT NULL,
  maintenance_type TEXT NOT NULL,
  description TEXT,
  technician TEXT,
  next_due_date DATE,
  status TEXT DEFAULT 'Completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. LIS Order Attachments (ໄຟລ໌ແນບ)
CREATE TABLE IF NOT EXISTS LIS_Order_Attachments (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_data JSONB,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ຂໍ້ມູນຕົວຢ່າງ (Sample Data)
-- ============================================================

-- ຜູ້ໃຊ້ Admin
INSERT INTO LIS_Users (username, password, role) 
VALUES ('admin', 'admin1234', 'Admin')
ON CONFLICT (username) DO NOTHING;

-- ຕັ້ງຄ່າພື້ນຖານ
INSERT INTO LIS_Settings (type, value) VALUES
  ('VisitType', 'OPD'),
  ('VisitType', 'IPD'),
  ('VisitType', 'Emergency'),
  ('Insite', 'Yes'),
  ('Insite', 'No'),
  ('Doctor', 'Dr. Smith'),
  ('Department', 'Laboratory'),
  ('Sender', 'Nurse Station')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ປິດ RLS ທກຕາຕະລາງ (ເພື່ອການທົດສອບ)
-- ============================================================
ALTER TABLE LIS_Users DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Test_Master DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Test_Packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Test_Package_Items DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Test_Parameters DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Test_Reagent_Mapping DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Stock_Master DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Inventory_Lots DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Stock_Transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Test_Orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Test_Results DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Audit_Log DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Maintenance_Log DISABLE ROW LEVEL SECURITY;
ALTER TABLE LIS_Order_Attachments DISABLE ROW LEVEL SECURITY;
