-- Allow a unified guest/shared inventory by permitting NULL user_id rows readable/writable by anyone.
ALTER TABLE public.supplies ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN user_id DROP NOT NULL;

-- Public (anon + authenticated) access to shared rows (user_id IS NULL) on supplies
CREATE POLICY "public supplies select" ON public.supplies
  FOR SELECT TO anon, authenticated
  USING (user_id IS NULL);

CREATE POLICY "public supplies insert" ON public.supplies
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL);

CREATE POLICY "public supplies update" ON public.supplies
  FOR UPDATE TO anon, authenticated
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY "public supplies delete" ON public.supplies
  FOR DELETE TO anon, authenticated
  USING (user_id IS NULL);

-- Public access to shared transactions
CREATE POLICY "public tx select" ON public.transactions
  FOR SELECT TO anon, authenticated
  USING (user_id IS NULL);

CREATE POLICY "public tx insert" ON public.transactions
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL);
