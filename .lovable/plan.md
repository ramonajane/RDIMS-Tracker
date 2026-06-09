
## Goal

Stop splitting supplies into one row per project. Each supply (e.g. "A4 paper") becomes a single inventory item with one shared stock number. Per-project usage is derived from the `transactions` log (checkouts), so you can still see "RRDIC has checked out 12 reams of A4".

## Data model change

Today: `supplies` has duplicate rows like `A4 / RRDIC / 27` and `A4 / WVHRDC / 15`.
After: one row `A4 / stock=42`. The `project` column is removed from `supplies`. Transactions keep their `project` field — that becomes the source of truth for "who checked out what".

### Migration steps (one migration)
1. Merge duplicate supply rows by name (case-insensitive):
   - Keep the oldest row per name as the canonical one.
   - Sum `stock` from all siblings into it.
   - Repoint `transactions.supply_id` from sibling rows to the canonical row.
   - Delete sibling rows.
2. Drop the `project` column from `supplies`.
3. Add a unique index on `lower(name)` so duplicates can't reappear.

`transactions.project` stays as-is and is what powers per-project reports.

## App changes

### Inventory page (`src/pages/Index.tsx`)
- Remove the grouping-by-name logic and `SupplyBreakdownDialog`. Each card now represents one real row, with one stock number and one QR code. Much simpler.
- Replace the "Breakdown" button with a "Usage by project" button that opens a new dialog showing per-project checkout totals derived from transactions.

### New: `SupplyUsageDialog`
- Queries `transactions` for that `supply_id`, groups by `project`, sums `quantity` where `type='out'` minus `type='in'` returns (or just `out` totals — simpler).
- Shows a list: `RRDIC — 12 reams checked out`, etc., plus a grand total.

### Checkout (`src/components/CheckoutDrawer.tsx` + `src/lib/inventory.ts`)
- Scanning a code finds the single supply row and decrements its stock.
- The project picker is still required — it's saved on the `transactions` row (no longer on supplies).
- Remove the `adjustStock` branch that re-routes the decrement to a project-specific row.

### Stock-in (`QuickStockInDialog`, `ScanStockInDialog`, `SupplyForm`)
- Remove the project field from the supply form and stock-in dialogs — adding stock now just increases the shared count.
- Manual stock-in still asks for a project (recorded on the transaction) so the audit log stays meaningful; if you'd rather skip that for stock-in, say so and I'll drop it.

### Google Sheets sync (`supabase/functions/sync-sheet/index.ts`)
- **Inventory tab** columns become: `Supply Name | Code | Unit | Stock | Updated At` (no Project column — one row per supply).
- **Transactions tab** unchanged — still logs `Project` per row, so per-project history is preserved in the sheet.
- A new optional **Usage by Project** tab (pivot) can be added later if you want; not in this change unless you ask.

## What you'll see after

- Inventory list shows each supply once with a unified stock number.
- Tapping a supply opens "Usage by project" with totals like `RRDIC: 12`, `WVHRDC: 5`.
- Checkout flow is unchanged from the user's perspective — still pick a project at checkout.
- Google Sheet `Inventory` tab no longer duplicates rows per project.

## Open question

For your existing data: `A4` will become one row with stock `27 + 15 = 42`, `Pens` becomes `24 + 8 = 32`, `Tissue` stays `89`. Confirm that's what you want before I run the migration (it's destructive — sibling rows are deleted after their stock and transactions are merged).
