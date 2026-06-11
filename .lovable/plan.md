
# Fix shared projects not saving

## Root cause

`Index.tsx` reads projects from the **shared** `app_settings` row (`key = 'shared_projects'`) and subscribes to realtime changes on that row. But `SettingsDialog.tsx` saves projects to the **per-user** `user_settings.projects` column instead. So every save writes to a place nothing reads from, the shared list never changes, and the UI shows it as "not saved."

On top of that, `app_settings` currently only has a `SELECT` policy for `anon`/`authenticated`. There is no `INSERT` or `UPDATE` policy, so even if we point the dialog at `app_settings` today, the upsert would silently fail with an RLS error.

(The "admin actions reflecting on guests" part is by design — inventory and projects are intentionally shared. You confirmed: keep shared, just fix saving.)

## Changes

### 1. Database migration

Add write policies to `app_settings` so signed-in admins can upsert shared settings rows. Guests stay read-only.

```sql
CREATE POLICY "app_settings insert auth"
  ON public.app_settings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "app_settings update auth"
  ON public.app_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
```

### 2. `src/components/SettingsDialog.tsx`

Change `save()` so the projects list is written to the shared `app_settings` row, while units / default_unit continue to go to `user_settings`:

- Upsert `{ key: 'shared_projects', value: JSON.stringify(projList) }` into `app_settings` (onConflict: `key`).
- Upsert `{ user_id, units, default_unit }` into `user_settings` (drop `projects` from this payload).
- Both happen in the same Save click; toast on success/failure.

### 3. `src/pages/Index.tsx`

No structural change — it already reads/subscribes to `app_settings` for `SHARED_PROJECTS_KEY`. Just remove the dead `projects`-from-`user_settings` read path so there's one source of truth.

## Result

- Add a project → Save → it persists in `app_settings`, realtime fans it out to every open browser (admins and guests), and it appears in the Checkout project dropdown for everyone immediately.
- Supplies and projects remain shared (current behavior preserved).
- Guests still can't modify the projects list (RLS blocks writes for `anon`).
