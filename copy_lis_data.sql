-- ============================================================
-- LIS Data Migration Script
-- ສຳລັບ Copy ຂໍ້ມູນຈາກ LIS Project ໄປ it977's Project
-- ============================================================

-- ຄຳສັ່ງນີ້ໃຊ້ສຳລັບ EXPORT ຂໍ້ມູນຈາກ Project ເກົ່າ
-- ແລະ ນຳໄປ INSERT ໃສ່ Project ໃໝ່

-- ============================================================
-- 1. LIS_USERS
-- ============================================================
-- ຈາກ LIS Project (qfykgwsrdsdgqymlejdc):
-- ກົດຂວາທີ່ lis_users → Export Data → SQL

-- ຫຼື ໃຊ້ SQL ນີ້ໃນ LIS Project:
/*
SELECT 
  'INSERT INTO lis_users (id, username, password, role, created_at) VALUES (' ||
  id || ', ''' || username || ''', ''' || password || ''', ''' || role || ''', ''' || created_at || ''');'
FROM lis_users;
*/

-- ຄັອກຜົນລັພ ແລ້ວໄປວາງໃນ it977's Project

-- INSERT ຕົວຢ່າງສຳລັບ lis_users:
INSERT INTO lis_users (id, username, password, role, created_at) 
VALUES 
  (1, 'admin', 'admin1234', 'Admin', NOW()),
  (2, 'ms_anong', 'password123', 'User', NOW()),
  (3, 'ms_sengphet', 'password123', 'User', NOW()),
  (4, 'ms_kham', 'password123', 'User', NOW()),
  (5, 'ms_chanthavilai', 'password123', 'User', NOW()),
  (6, 'ms_phoutdavan', 'password123', 'User', NOW()),
  (7, 'ms_chanthaviphone', 'password123', 'User', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. LIS_SETTINGS
-- ============================================================
INSERT INTO lis_settings (id, type, value, created_at)
SELECT id, type, value, NOW()
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, type, value FROM lis_settings'
) AS t(id BIGINT, type TEXT, value TEXT)
ON CONFLICT (id) DO NOTHING;

-- ຫຼື ໃຊ້ INSERT ມື:
INSERT INTO lis_settings (type, value) VALUES
  ('VisitType', 'OPD'),
  ('VisitType', 'IPD'),
  ('VisitType', 'Emergency'),
  ('VisitType', 'Refer'),
  ('Insite', 'Yes'),
  ('Insite', 'No'),
  ('Doctor', 'Dr. Smith'),
  ('Doctor', 'Dr. John'),
  ('Department', 'Laboratory'),
  ('Department', 'Radiology'),
  ('Sender', 'Nurse Station'),
  ('Sender', 'OPD Counter'),
  ('LabDest', 'In-house'),
  ('LabDest', 'Reference Lab')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. LIS_TEST_MASTER
-- ============================================================
-- ວິທີທີ່ 1: ໃຊ້ COPY (ຖ້າມີ File Access)
/*
COPY (SELECT * FROM lis_test_master) TO '/tmp/test_master.csv' WITH CSV HEADER;
*/

-- ວິທີທີ່ 2: ສ້າງ INSERT Statements
/*
SELECT 
  'INSERT INTO lis_test_master (id, name, price, category) VALUES (' ||
  id || ', ''' || REPLACE(name, '''', '''''') || ''', ' || price || ', ''' || category || ''');'
FROM lis_test_master;
*/

-- ວິທີທີ່ 3: ໃຊ້ INSERT ຈາກ SELECT (ຖ້າເຊື່ອມຕໍ່ໄດ້)
INSERT INTO lis_test_master (id, name, price, category)
SELECT id, name, price, category
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, name, price, category FROM lis_test_master'
) AS t(id BIGINT, name TEXT, price NUMERIC, category TEXT)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. LIS_TEST_PACKAGES
-- ============================================================
INSERT INTO lis_test_packages (id, name, description, price, is_active)
SELECT id, name, description, price, is_active
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, name, description, price, is_active FROM lis_test_packages'
) AS t(id BIGINT, name TEXT, description TEXT, price NUMERIC, is_active BOOLEAN)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. LIS_TEST_PACKAGE_ITEMS
-- ============================================================
INSERT INTO lis_test_package_items (id, package_id, test_id, test_name, price)
SELECT id, package_id, test_id, test_name, price
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, package_id, test_id, test_name, price FROM lis_test_package_items'
) AS t(id BIGINT, package_id BIGINT, test_id BIGINT, test_name TEXT, price NUMERIC)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. LIS_TEST_PARAMETERS
-- ============================================================
INSERT INTO lis_test_parameters (id, test_name, param_name, input_type, options, unit, normal_min, normal_max)
SELECT id, test_name, param_name, input_type, options, unit, normal_min, normal_max
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, test_name, param_name, input_type, options, unit, normal_min, normal_max FROM lis_test_parameters'
) AS t(id BIGINT, test_name TEXT, param_name TEXT, input_type TEXT, options TEXT, unit TEXT, normal_min NUMERIC, normal_max NUMERIC)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. LIS_TEST_REAGENT_MAPPING
-- ============================================================
INSERT INTO lis_test_reagent_mapping (id, test_name, reagent_id, reagent_name, qty)
SELECT id, test_name, reagent_id, reagent_name, qty
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, test_name, reagent_id, reagent_name, qty FROM lis_test_reagent_mapping'
) AS t(id BIGINT, test_name TEXT, reagent_id BIGINT, reagent_name TEXT, qty NUMERIC)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. LIS_STOCK_MASTER
-- ============================================================
INSERT INTO lis_stock_master (id, name, unit)
SELECT id, name, unit
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, name, unit FROM lis_stock_master'
) AS t(id BIGINT, name TEXT, unit TEXT)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. LIS_INVENTORY_LOTS
-- ============================================================
INSERT INTO lis_inventory_lots (lot_id, reagent_id, reagent_name, lot_no, supplier, location, receive_date, exp_date, qty, qty_remaining)
SELECT lot_id, reagent_id, reagent_name, lot_no, supplier, location, receive_date, exp_date, qty, qty_remaining
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT lot_id, reagent_id, reagent_name, lot_no, supplier, location, receive_date, exp_date, qty, qty_remaining FROM lis_inventory_lots'
) AS t(id TEXT, reagent_id BIGINT, reagent_name TEXT, lot_no TEXT, supplier TEXT, location TEXT, receive_date DATE, exp_date DATE, qty NUMERIC, qty_remaining NUMERIC)
ON CONFLICT (lot_id) DO NOTHING;

-- ============================================================
-- 10. LIS_STOCK_TRANSACTIONS
-- ============================================================
INSERT INTO lis_stock_transactions (id, reagent_id, reagent_name, type, qty, note, user_name)
SELECT id, reagent_id, reagent_name, type, qty, note, user_name
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, reagent_id, reagent_name, type, qty, note, user_name FROM lis_stock_transactions'
) AS t(id BIGINT, reagent_id BIGINT, reagent_name TEXT, type TEXT, qty NUMERIC, note TEXT, user_name TEXT)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 11. LIS_TEST_ORDERS
-- ============================================================
INSERT INTO lis_test_orders (id, order_id, order_datetime, time_slot, visit_type, insite, patient_id, patient_name, age, gender, doctor, department, test_type, test_name, price, total_price, lab_dest, sender, status, category)
SELECT id, order_id, order_datetime, time_slot, visit_type, insite, patient_id, patient_name, age, gender, doctor, department, test_type, test_name, price, total_price, lab_dest, sender, status, category
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, order_id, order_datetime, time_slot, visit_type, insite, patient_id, patient_name, age, gender, doctor, department, test_type, test_name, price, total_price, lab_dest, sender, status, category FROM lis_test_orders'
) AS t(id BIGINT, order_id TEXT, order_datetime TIMESTAMPTZ, time_slot TEXT, visit_type TEXT, insite TEXT, patient_id TEXT, patient_name TEXT, age INTEGER, gender TEXT, doctor TEXT, department TEXT, test_type TEXT, test_name TEXT, price NUMERIC, total_price NUMERIC, lab_dest TEXT, sender TEXT, status TEXT, category TEXT)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 12. LIS_TEST_RESULTS
-- ============================================================
INSERT INTO lis_test_results (id, order_id, test_name, param_name, result_value, unit, normal_min, normal_max, flag)
SELECT id, order_id, test_name, param_name, result_value, unit, normal_min, normal_max, flag
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, order_id, test_name, param_name, result_value, unit, normal_min, normal_max, flag FROM lis_test_results'
) AS t(id BIGINT, order_id TEXT, test_name TEXT, param_name TEXT, result_value TEXT, unit TEXT, normal_min NUMERIC, normal_max NUMERIC, flag TEXT)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 13. LIS_AUDIT_LOG
-- ============================================================
INSERT INTO lis_audit_log (id, user_name, action, target, details)
SELECT id, user_name, action, target, details
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, user_name, action, target, details FROM lis_audit_log'
) AS t(id BIGINT, user_name TEXT, action TEXT, target TEXT, details TEXT)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 14. LIS_MAINTENANCE_LOG
-- ============================================================
INSERT INTO lis_maintenance_log (id, device_name, maintenance_date, maintenance_type, description, technician, next_due_date, status)
SELECT id, device_name, maintenance_date, maintenance_type, description, technician, next_due_date, status
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, device_name, maintenance_date, maintenance_type, description, technician, next_due_date, status FROM lis_maintenance_log'
) AS t(id BIGINT, device_name TEXT, maintenance_date DATE, maintenance_type TEXT, description TEXT, technician TEXT, next_due_date DATE, status TEXT)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 15. LIS_ORDER_ATTACHMENTS
-- ============================================================
INSERT INTO lis_order_attachments (id, order_id, file_name, file_type, file_data, uploaded_by)
SELECT id, order_id, file_name, file_type, file_data, uploaded_by
FROM dblink(
  'host=db.qfykgwsrdsdgqymlejdc.supabase.co 
   user=postgres 
   password=YOUR_OLD_PROJECT_PASSWORD 
   dbname=postgres',
  'SELECT id, order_id, file_name, file_type, file_data, uploaded_by FROM lis_order_attachments'
) AS t(id BIGINT, order_id TEXT, file_name TEXT, file_type TEXT, file_data JSONB, uploaded_by TEXT)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ສຳເລັດ!
-- ============================================================
-- ຫຼັງຈາກ Run ແລ້ວ, ກວດສອບຂໍ້ມູນໃນ Table Editor
-- ============================================================
