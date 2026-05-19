-- Inventory/Lab Reagent R1/R2 usage model and transaction-safe auto deduct.
-- Run after 2026_05_18_inventory_full_stock_system.sql.

ALTER TABLE public.lis_one_stock_master
  ADD COLUMN IF NOT EXISTS reagent_name TEXT,
  ADD COLUMN IF NOT EXISTS default_unit_type TEXT DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS default_tests_per_unit NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS default_low_threshold_tests NUMERIC DEFAULT 10;

UPDATE public.lis_one_stock_master
SET reagent_name = COALESCE(reagent_name, name)
WHERE reagent_name IS NULL;

ALTER TABLE public.lis_one_inventory_lots
  ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS unit_qty NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tests_per_unit NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_tests NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS used_tests NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_tests NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_threshold_tests NUMERIC DEFAULT 10,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Normal';

UPDATE public.lis_one_inventory_lots
SET
  component_type = CASE
    WHEN UPPER(COALESCE(component_type, '')) IN ('R1', 'R2', 'R3') THEN UPPER(component_type)
    WHEN UPPER(COALESCE(component_type, '')) IN ('FULL', 'SINGLE') THEN 'Single'
    ELSE COALESCE(NULLIF(component_type, ''), 'Single')
  END,
  unit_type = COALESCE(NULLIF(unit_type, ''), 'test'),
  unit_qty = COALESCE(NULLIF(unit_qty, 0), qty, qty_remaining, 0),
  tests_per_unit = COALESCE(NULLIF(tests_per_unit, 0), 1),
  total_tests = COALESCE(NULLIF(total_tests, 0), qty, qty_remaining, 0),
  used_tests = COALESCE(used_tests, GREATEST(COALESCE(qty, 0) - COALESCE(qty_remaining, 0), 0)),
  remaining_tests = COALESCE(NULLIF(remaining_tests, 0), qty_remaining, qty, 0),
  low_threshold_tests = COALESCE(NULLIF(low_threshold_tests, 0), 10),
  status = COALESCE(NULLIF(status, ''), 'Normal');

ALTER TABLE public.lis_one_stock_transactions
  ADD COLUMN IF NOT EXISTS transaction_type TEXT,
  ADD COLUMN IF NOT EXISTS qty_tests NUMERIC,
  ADD COLUMN IF NOT EXISTS qty_unit NUMERIC,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT;

UPDATE public.lis_one_stock_transactions
SET
  transaction_type = COALESCE(transaction_type, type),
  qty_tests = COALESCE(qty_tests, qty),
  reference_type = COALESCE(reference_type, 'manual'),
  created_by = COALESCE(created_by, user_name)
WHERE transaction_type IS NULL OR qty_tests IS NULL OR reference_type IS NULL OR created_by IS NULL;

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
  CHECK (type IN ('IN', 'OUT', 'ADJUST', 'EXPIRED', 'WASTE'));

ALTER TABLE public.lis_one_test_reagent_mapping
  ADD COLUMN IF NOT EXISTS component_type TEXT DEFAULT 'Single';

CREATE INDEX IF NOT EXISTS idx_lis_one_inventory_component_fifo
  ON public.lis_one_inventory_lots (reagent_id, component_type, exp_date ASC, id ASC)
  WHERE COALESCE(remaining_tests, qty_remaining, 0) > 0;

CREATE INDEX IF NOT EXISTS idx_lis_one_stock_trans_report
  ON public.lis_one_stock_transactions (created_at, reagent_id, component_type);

CREATE OR REPLACE FUNCTION public.lis_one_deduct_reagents_for_order(
  p_order_id TEXT,
  p_test_names TEXT[],
  p_user_name TEXT DEFAULT 'system'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  req RECORD;
  lot RECORD;
  need NUMERIC;
  take_qty NUMERIC;
  shortage JSONB;
  deducted JSONB := '[]'::jsonb;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _lis_req (
    reagent_id BIGINT,
    reagent_name TEXT,
    component_type TEXT,
    qty NUMERIC
  ) ON COMMIT DROP;
  TRUNCATE _lis_req;

  INSERT INTO _lis_req (reagent_id, reagent_name, component_type, qty)
  SELECT
    m.reagent_id,
    COALESCE(m.reagent_name, sm.name),
    CASE
      WHEN UPPER(COALESCE(m.component_type, 'Single')) IN ('FULL', 'SINGLE') THEN 'Single'
      WHEN UPPER(COALESCE(m.component_type, 'Single')) IN ('ALL', 'ALL_COMPONENTS', 'R1/R2', 'R1R2') THEN COALESCE(NULLIF(l.component_type, ''), 'Single')
      ELSE UPPER(m.component_type)
    END,
    SUM(COALESCE(m.qty, 0)) AS qty
  FROM public.lis_one_test_reagent_mapping m
  LEFT JOIN public.lis_one_stock_master sm ON sm.id = m.reagent_id
  LEFT JOIN LATERAL (
    SELECT DISTINCT il.component_type
    FROM public.lis_one_inventory_lots il
    WHERE il.reagent_id = m.reagent_id
      AND COALESCE(il.remaining_tests, il.qty_remaining, 0) > 0
      AND UPPER(COALESCE(il.component_type, 'Single')) IN ('R1', 'R2', 'R3')
  ) l ON UPPER(COALESCE(m.component_type, 'Single')) IN ('ALL', 'ALL_COMPONENTS', 'R1/R2', 'R1R2')
  WHERE m.test_name = ANY(p_test_names)
    AND m.reagent_id IS NOT NULL
  GROUP BY m.reagent_id, COALESCE(m.reagent_name, sm.name),
    CASE
      WHEN UPPER(COALESCE(m.component_type, 'Single')) IN ('FULL', 'SINGLE') THEN 'Single'
      WHEN UPPER(COALESCE(m.component_type, 'Single')) IN ('ALL', 'ALL_COMPONENTS', 'R1/R2', 'R1R2') THEN COALESCE(NULLIF(l.component_type, ''), 'Single')
      ELSE UPPER(m.component_type)
    END;

  SELECT jsonb_agg(jsonb_build_object(
    'reagent_id', r.reagent_id,
    'reagent_name', r.reagent_name,
    'component_type', r.component_type,
    'need', r.qty,
    'have', COALESCE(a.have, 0),
    'short', r.qty - COALESCE(a.have, 0)
  ))
  INTO shortage
  FROM _lis_req r
  LEFT JOIN LATERAL (
    SELECT SUM(COALESCE(il.remaining_tests, il.qty_remaining, 0)) AS have
    FROM public.lis_one_inventory_lots il
    WHERE il.reagent_id = r.reagent_id
      AND (
        (r.component_type = 'Single' AND UPPER(COALESCE(il.component_type, 'Single')) IN ('SINGLE', 'FULL'))
        OR UPPER(COALESCE(il.component_type, 'Single')) = UPPER(r.component_type)
      )
      AND COALESCE(il.remaining_tests, il.qty_remaining, 0) > 0
  ) a ON TRUE
  WHERE COALESCE(a.have, 0) < r.qty;

  IF shortage IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'shortages', shortage, 'deducted', '[]'::jsonb);
  END IF;

  FOR req IN SELECT * FROM _lis_req ORDER BY reagent_name, component_type LOOP
    need := req.qty;
    FOR lot IN
      SELECT *
      FROM public.lis_one_inventory_lots il
      WHERE il.reagent_id = req.reagent_id
        AND (
          (req.component_type = 'Single' AND UPPER(COALESCE(il.component_type, 'Single')) IN ('SINGLE', 'FULL'))
          OR UPPER(COALESCE(il.component_type, 'Single')) = UPPER(req.component_type)
        )
        AND COALESCE(il.remaining_tests, il.qty_remaining, 0) > 0
      ORDER BY il.exp_date ASC NULLS LAST, il.id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN need <= 0;
      take_qty := LEAST(need, COALESCE(lot.remaining_tests, lot.qty_remaining, 0));

      UPDATE public.lis_one_inventory_lots
      SET
        remaining_tests = GREATEST(COALESCE(remaining_tests, qty_remaining, 0) - take_qty, 0),
        qty_remaining = GREATEST(COALESCE(qty_remaining, remaining_tests, 0) - take_qty, 0),
        used_tests = COALESCE(used_tests, 0) + take_qty,
        status = CASE
          WHEN GREATEST(COALESCE(remaining_tests, qty_remaining, 0) - take_qty, 0) <= 0 THEN 'Empty'
          WHEN exp_date IS NOT NULL AND exp_date < CURRENT_DATE THEN 'Expired'
          WHEN GREATEST(COALESCE(remaining_tests, qty_remaining, 0) - take_qty, 0) <= COALESCE(low_threshold_tests, 10) THEN 'Low Stock'
          ELSE 'Normal'
        END
      WHERE id = lot.id;

      INSERT INTO public.lis_one_stock_transactions (
        reagent_id, reagent_name, type, transaction_type, component_type, lot_no,
        qty, qty_tests, qty_unit, reference_type, reference_id, created_by, user_name, note, movement_date
      ) VALUES (
        req.reagent_id, req.reagent_name, 'OUT', 'OUT', req.component_type, lot.lot_no,
        take_qty, take_qty, NULL, 'auto_deduct', p_order_id, p_user_name, p_user_name,
        'Auto deduct for order ' || p_order_id || ' (' || req.component_type || ', lot ' || COALESCE(lot.lot_no, lot.id::text) || ')',
        CURRENT_DATE
      );

      deducted := deducted || jsonb_build_array(jsonb_build_object(
        'reagent_id', req.reagent_id,
        'reagent_name', req.reagent_name,
        'component_type', req.component_type,
        'lot_no', lot.lot_no,
        'qty', take_qty
      ));
      need := need - take_qty;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'shortages', '[]'::jsonb, 'deducted', deducted);
END;
$$;
