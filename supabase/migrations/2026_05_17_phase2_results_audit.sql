-- ============================================================
-- Phase 2 migration — Result Entry, Audit Viewer, Auto Deduct
-- Date: 2026-05-17
-- Safe to run repeatedly: uses IF NOT EXISTS / IF EXISTS guards.
-- ============================================================

-- 1) Ensure lis_one_test_results has the columns the app writes.
--    Original schema already has order_id, test_name, param_name,
--    result_value, flag, user_name, created_at.  Add helpful indexes.
CREATE INDEX IF NOT EXISTS idx_lis_one_test_results_order_test
  ON public.lis_one_test_results (order_id, test_name);
CREATE INDEX IF NOT EXISTS idx_lis_one_test_results_flag
  ON public.lis_one_test_results (flag);

-- 2) lis_one_test_orders index for the Result-Entry "Pending" filter.
CREATE INDEX IF NOT EXISTS idx_lis_one_test_orders_status_dt
  ON public.lis_one_test_orders (status, order_datetime DESC);

-- 3) lis_one_audit_log: add detail filter indexes.
CREATE INDEX IF NOT EXISTS idx_lis_one_audit_log_action
  ON public.lis_one_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_lis_one_audit_log_target
  ON public.lis_one_audit_log (target);
CREATE INDEX IF NOT EXISTS idx_lis_one_audit_log_user
  ON public.lis_one_audit_log (user_name);

-- 4) lis_one_inventory_lots: FIFO deduct order is (exp_date ASC, id ASC).
--    The exp_date index already exists; add composite for hot-path.
CREATE INDEX IF NOT EXISTS idx_lis_one_inventory_lots_fifo
  ON public.lis_one_inventory_lots (reagent_id, exp_date ASC, id ASC)
  WHERE qty_remaining > 0;

-- 5) lis_one_stock_transactions: index by created_at for audit views.
CREATE INDEX IF NOT EXISTS idx_lis_one_stock_trans_reagent_dt
  ON public.lis_one_stock_transactions (reagent_id, created_at DESC);

-- ============================================================
-- DONE
-- ============================================================
