-- Patch for environments where older inventory tables were created before
-- reagent category metadata was added.

ALTER TABLE public.lis_one_stock_master
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Other';

ALTER TABLE public.lis_one_stock_master
  ALTER COLUMN category SET DEFAULT 'Other';

UPDATE public.lis_one_stock_master
SET category = 'Other'
WHERE category IS NULL OR btrim(category) = '';

ALTER TABLE public.lis_one_inventory_lots
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Other';

ALTER TABLE public.lis_one_inventory_lots
  ALTER COLUMN category SET DEFAULT 'Other';

UPDATE public.lis_one_inventory_lots il
SET category = COALESCE(NULLIF(il.category, ''), NULLIF(sm.category, ''), 'Other')
FROM public.lis_one_stock_master sm
WHERE il.reagent_id = sm.id
  AND (il.category IS NULL OR btrim(il.category) = '');

UPDATE public.lis_one_inventory_lots
SET category = 'Other'
WHERE category IS NULL OR btrim(category) = '';

CREATE INDEX IF NOT EXISTS idx_lis_one_stock_master_category
  ON public.lis_one_stock_master (category);

CREATE INDEX IF NOT EXISTS idx_lis_one_inventory_lots_category
  ON public.lis_one_inventory_lots (category);
