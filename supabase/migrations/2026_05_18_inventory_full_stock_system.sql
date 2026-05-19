-- Full laboratory stock management fields based on the Lab Stock Management System workbook.
-- Adds Excel-compatible master data, R1/R2 component tracking, and adjustment support.

ALTER TABLE public.lis_one_stock_master
  ADD COLUMN IF NOT EXISTS item_code TEXT,
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS main_supplier TEXT,
  ADD COLUMN IF NOT EXISTS storage_location TEXT,
  ADD COLUMN IF NOT EXISTS storage_temp TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS stock_standard NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

ALTER TABLE public.lis_one_inventory_lots
  ADD COLUMN IF NOT EXISTS item_code TEXT,
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS component_type TEXT DEFAULT 'FULL',
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS storage_temp TEXT;

ALTER TABLE public.lis_one_stock_transactions
  ADD COLUMN IF NOT EXISTS item_code TEXT,
  ADD COLUMN IF NOT EXISTS component_type TEXT,
  ADD COLUMN IF NOT EXISTS lot_no TEXT,
  ADD COLUMN IF NOT EXISTS movement_date DATE DEFAULT CURRENT_DATE;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.lis_one_stock_transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%IN%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.lis_one_stock_transactions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.lis_one_stock_transactions
  ADD CONSTRAINT lis_one_stock_transactions_type_check
  CHECK (type IN ('IN', 'OUT', 'ADJUST'));

CREATE INDEX IF NOT EXISTS idx_lis_one_stock_master_item_code
  ON public.lis_one_stock_master (item_code);

CREATE INDEX IF NOT EXISTS idx_lis_one_inventory_lots_item_code
  ON public.lis_one_inventory_lots (item_code);

CREATE INDEX IF NOT EXISTS idx_lis_one_stock_trans_movement_date
  ON public.lis_one_stock_transactions (movement_date);
