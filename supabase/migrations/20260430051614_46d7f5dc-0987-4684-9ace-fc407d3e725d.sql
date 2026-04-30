-- Add project column
ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS project text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS project text;

-- Backfill: move all existing rows to the shared inventory (user_id = NULL)
UPDATE public.supplies SET user_id = NULL WHERE user_id IS NOT NULL;
UPDATE public.transactions SET user_id = NULL WHERE user_id IS NOT NULL;

-- Drop existing owner/public policies and replace with unified shared-inventory policies
DROP POLICY IF EXISTS "own supplies select" ON public.supplies;
DROP POLICY IF EXISTS "own supplies insert" ON public.supplies;
DROP POLICY IF EXISTS "own supplies update" ON public.supplies;
DROP POLICY IF EXISTS "own supplies delete" ON public.supplies;
DROP POLICY IF EXISTS "public supplies select" ON public.supplies;
DROP POLICY IF EXISTS "public supplies insert" ON public.supplies;
DROP POLICY IF EXISTS "public supplies update" ON public.supplies;
DROP POLICY IF EXISTS "public supplies delete" ON public.supplies;

DROP POLICY IF EXISTS "own tx select" ON public.transactions;
DROP POLICY IF EXISTS "own tx insert" ON public.transactions;
DROP POLICY IF EXISTS "public tx select" ON public.transactions;
DROP POLICY IF EXISTS "public tx insert" ON public.transactions;

-- Supplies: everyone can read
CREATE POLICY "supplies read all" ON public.supplies
  FOR SELECT TO anon, authenticated USING (true);

-- Supplies: only authenticated users can add/edit/delete the catalog
CREATE POLICY "supplies insert auth" ON public.supplies
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "supplies delete auth" ON public.supplies
  FOR DELETE TO authenticated USING (true);

-- Updates allowed for both (guests need to decrement stock on checkout)
CREATE POLICY "supplies update all" ON public.supplies
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Transactions: everyone can read and insert
CREATE POLICY "tx read all" ON public.transactions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tx insert all" ON public.transactions
  FOR INSERT TO anon, authenticated WITH CHECK (true);