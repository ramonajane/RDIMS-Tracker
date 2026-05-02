# One QR per supply (shared across projects)

## Goal
Every supply row that shares the same name uses the **same QR code**. Scanning that QR brings up the grouped item; the project is chosen at checkout time (existing flow). The dashboard card and the breakdown dialog show that same single QR.

## Behavior

- **Dashboard card**: "QR" button shows the group's shared QR (same image for every project under that name).
- **Breakdown dialog**: Per-project rows no longer have a "QR" button — there's just one QR per supply, shown from the card. (Avoids the misleading impression that each project has its own QR.)
- **Scanning to checkout**: Works as today — the scanner finds *a* supply row with that code; the user picks the project in the popup; stock is decremented from the row matching that project (falls back to the representative row if no exact match).
- **Stock-in by scan**: Same code resolves to the supply group; user picks (or creates) a project. If the picked project already has a row, increment it; otherwise create a new row reusing the shared code.
- **Adding a new supply (form)**: If the typed name matches an existing supply, the code field auto-fills with that group's shared code and becomes read-only. New names get a freshly generated code.
- **Editing**: Renaming a supply re-syncs its code to the matching group (or generates a new one if the new name is unique).

## Technical changes

### `src/lib/inventory.ts`
- Add helper `getCodeForName(name: string): Promise<string | null>` — returns the existing shared code for any row whose lowercased trimmed name matches, or `null`.
- Update `adjustStock(supply, delta, type, project?)` to optionally route the decrement to the row matching `project` within the same name-group:
  - On checkout (`type==="out"`), look up `supplies` where `lower(name)=lower(supply.name)` and `project=trimmedProject`. If found, decrement that row; else decrement the scanned `supply` (current behavior). Transaction log records `supply_id` of the actual row decremented.

### `src/components/SupplyForm.tsx`
- On name change (debounced or on blur), call `getCodeForName`. If a code exists, set `code` to it and disable the input with a hint: "Shared QR with existing '<name>' supplies."
- On save, if `editing` and the name changed, re-resolve the code the same way before submitting.

### `src/components/QuickStockInDialog.tsx` and `src/components/ScanStockInDialog.tsx`
- After resolving the scanned/typed code:
  - If a row exists with the same code AND the chosen project, increment that row.
  - Else create a new row reusing the shared code with the chosen project.
- For manual entry, when the user types a name for a brand-new code, also call `getCodeForName(name)` and reuse if found.

### `src/pages/Index.tsx`
- The card's QR button already opens `qrFor={g.members[0]}`. Since all members share the code now, this is correct — no change needed beyond a label tweak ("Shared QR for all projects").

### `src/components/SupplyBreakdownDialog.tsx`
- Remove the per-row QR button (kept Edit/Delete for managers). Add a single "Show shared QR" button in the dialog header area instead, wired through a new `onShowGroupQR` prop.

### One-time data migration (SQL)
Existing rows have distinct codes per project. Sync them so all rows with the same lowercased name share the oldest row's code:

```sql
WITH ranked AS (
  SELECT id, code,
    FIRST_VALUE(code) OVER (
      PARTITION BY lower(trim(name))
      ORDER BY created_at ASC
    ) AS shared_code
  FROM public.supplies
)
UPDATE public.supplies s
SET code = r.shared_code
FROM ranked r
WHERE s.id = r.id AND s.code <> r.shared_code;
```

(No schema change — `code` stays non-unique, which it already is.)

## Out of scope
- Merging duplicate rows that share both name AND project (none should exist; if they do, they remain as-is and breakdown shows both).
- Changing how transactions are stored.

## Files touched
- `supabase/migrations/<new>.sql` (data sync only)
- `src/lib/inventory.ts`
- `src/components/SupplyForm.tsx`
- `src/components/QuickStockInDialog.tsx`
- `src/components/ScanStockInDialog.tsx`
- `src/components/SupplyBreakdownDialog.tsx`
- `src/pages/Index.tsx` (minor: pass shared-QR handler, remove per-row QR prop)
