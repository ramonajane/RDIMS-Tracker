CREATE POLICY "app_settings insert auth" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "app_settings update auth" ON public.app_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;