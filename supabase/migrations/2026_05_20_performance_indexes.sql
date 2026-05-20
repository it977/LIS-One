-- ============================================================
-- Performance Indexes Migration
-- Date: 2026-05-20
-- Purpose: Add indexes to speed up common queries
-- ============================================================

-- Orders table: patient lookups, date range queries, status filters
CREATE INDEX IF NOT EXISTS idx_orders_patient_id ON lis_one_test_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_datetime ON lis_one_test_orders(order_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON lis_one_test_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_lab_dest ON lis_one_test_orders(lab_dest);
CREATE INDEX IF NOT EXISTS idx_orders_test_name ON lis_one_test_orders(test_name);
CREATE INDEX IF NOT EXISTS idx_orders_category ON lis_one_test_orders(category);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON lis_one_test_orders(created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_patient_date ON lis_one_test_orders(patient_id, order_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON lis_one_test_orders(status, order_datetime DESC);

-- Results table: order lookups, test lookups
CREATE INDEX IF NOT EXISTS idx_results_order_id ON lis_one_test_results(order_id);
CREATE INDEX IF NOT EXISTS idx_results_test_name ON lis_one_test_results(test_name);
CREATE INDEX IF NOT EXISTS idx_results_created_at ON lis_one_test_results(created_at DESC);

-- Inventory lots: reagent lookups, expiry sorting
CREATE INDEX IF NOT EXISTS idx_inventory_reagent_id ON lis_one_inventory_lots(reagent_id);
CREATE INDEX IF NOT EXISTS idx_inventory_exp_date ON lis_one_inventory_lots(exp_date ASC);
CREATE INDEX IF NOT EXISTS idx_inventory_qty_remaining ON lis_one_inventory_lots(qty_remaining);

-- Stock transactions: date range queries
CREATE INDEX IF NOT EXISTS idx_stock_tx_created_at ON lis_one_stock_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_tx_reagent_id ON lis_one_stock_transactions(reagent_id);

-- Test reagent mapping: test name lookups
CREATE INDEX IF NOT EXISTS idx_mapping_test_name ON lis_one_test_reagent_mapping(test_name);

-- Audit log: date and user lookups
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON lis_one_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_name ON lis_one_audit_log(user_name);

-- Order result files: order lookups
CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON lis_one_order_result_files(order_id);
CREATE INDEX IF NOT EXISTS idx_order_files_uploaded_at ON lis_one_order_result_files(uploaded_at DESC);

-- Test packages: active filter
CREATE INDEX IF NOT EXISTS idx_packages_is_active ON lis_one_test_packages(is_active);

-- Package items: package lookups
CREATE INDEX IF NOT EXISTS idx_package_items_package_id ON lis_one_test_package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_package_items_test_id ON lis_one_test_package_items(test_id);

-- ============================================================
-- Patient Search Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_patients_hn ON lis_one_patients(hn);
CREATE INDEX IF NOT EXISTS idx_patients_name ON lis_one_patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON lis_one_patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_hn_trgm ON lis_one_patients USING gin(hn gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON lis_one_patients USING gin(name gin_trgm_ops);
