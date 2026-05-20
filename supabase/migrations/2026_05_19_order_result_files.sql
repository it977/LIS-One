-- ============================================================
-- LIS-One: Order Result Files (Supabase Storage + Metadata)
-- ============================================================
-- Migration: 2026_05_19_order_result_files
-- ============================================================

-- 1. Metadata table for uploaded result files
CREATE TABLE IF NOT EXISTS public.lis_one_order_result_files (
  id           BIGSERIAL PRIMARY KEY,
  order_id     TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  file_type    TEXT DEFAULT 'application/octet-stream',
  file_size    BIGINT DEFAULT 0,
  storage_path TEXT NOT NULL,
  uploaded_by  TEXT,
  uploaded_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by order
CREATE INDEX IF NOT EXISTS idx_lis_one_order_result_files_order_id
  ON public.lis_one_order_result_files(order_id);

-- Index for sorting by upload time
CREATE INDEX IF NOT EXISTS idx_lis_one_order_result_files_uploaded_at
  ON public.lis_one_order_result_files(uploaded_at DESC);

-- Enable Row Level Security
ALTER TABLE public.lis_one_order_result_files ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (app handles its own auth)
CREATE POLICY "lis_one_anon_all_orf"
  ON public.lis_one_order_result_files
  FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- ============================================================
-- DONE! ✅
-- After running this migration, create a Supabase Storage bucket
-- named "order-result-files" with public access.
-- ============================================================
