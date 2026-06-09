
-- 1) Merge duplicate supplies (by lower(name)). Keep the oldest as canonical.
WITH ranked AS (
  SELECT id, lower(trim(name)) AS k,
         row_number() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at ASC) AS rn,
         first_value(id) OVER (PARTITION BY lower(trim(name)) ORDER BY created_at ASC) AS canonical_id
  FROM public.supplies
),
mapping AS (
  SELECT id, canonical_id FROM ranked WHERE id <> canonical_id
)
-- Repoint transactions to canonical supply
UPDATE public.transactions t
SET supply_id = m.canonical_id
FROM mapping m
WHERE t.supply_id = m.id;

-- Sum stock from duplicates into the canonical row
WITH ranked AS (
  SELECT id, lower(trim(name)) AS k,
         first_value(id) OVER (PARTITION BY lower(trim(name)) ORDER BY created_at ASC) AS canonical_id
  FROM public.supplies
),
sums AS (
  SELECT canonical_id, SUM(s.stock) AS total
  FROM ranked r JOIN public.supplies s ON s.id = r.id
  WHERE r.id <> r.canonical_id
  GROUP BY canonical_id
)
UPDATE public.supplies s
SET stock = s.stock + sums.total
FROM sums
WHERE s.id = sums.canonical_id;

-- Delete duplicate rows
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY lower(trim(name)) ORDER BY created_at ASC) AS rn
  FROM public.supplies
)
DELETE FROM public.supplies
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Drop project column from supplies
ALTER TABLE public.supplies DROP COLUMN IF EXISTS project;

-- 3) Enforce unique supply name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS supplies_name_unique_lower ON public.supplies (lower(trim(name)));
