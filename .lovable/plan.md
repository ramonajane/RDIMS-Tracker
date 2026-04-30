## Goal

Two related changes:

1. **Projects become a managed dropdown** (like units) — instead of a free-text input on supply forms and checkout, users pick from a curated list managed in Settings.
2. **Supplies are grouped by name** in the dashboard. Identical supplies (e.g. all "A4 Bond Paper" entries across projects) appear as **one card** with one QR and a combined total stock. Clicking a card opens a popup showing the per-project breakdown (stock per project, project totals).

---

## 1. Project list management

**Database (migration):** Add a `projects` text[] column to `user_settings` with a sensible default (`ARRAY[]::text[]`).

**Settings dialog (`SettingsDialog.tsx`):** Add a second section "Projects" mirroring the existing Units UI — chips with remove buttons + an "Add project" input. Save persists both `units` and `projects`.

**Index (`Index.tsx`):**
- Load `projects` from `user_settings` alongside `units`.
- For guests (no logged-in user), derive the project list from existing supplies/transactions so guests still see a populated dropdown.
- Pass `projects` down to `SupplyForm`, `QuickStockInDialog`, `ScanStockInDialog`, and `CheckoutDrawer`.

**Forms (`SupplyForm.tsx`, `QuickStockInDialog.tsx`, `ScanStockInDialog.tsx`):** Replace the free-text Project input with a `Select` populated from `projects`. Keep it required at checkout, optional on stock-in/new supply (same as today).

**Checkout (`CheckoutDrawer.tsx`):** Replace the text input + datalist + chips with a `Select` dropdown of projects. Pre-select the supply's default project if present.

---

## 2. Group supplies by name with per-project breakdown

**Approach:** Keep the database schema as-is (one row per supply+project combo). Do the grouping in the UI.

**Index (`Index.tsx`):**
- Build a `groupedSupplies` memo that buckets `supplies` by a normalized name key (case-insensitive, trimmed) and aggregates:
  - `totalStock` = sum of `stock` across the group
  - `unit` = unit of the first member (assume consistent; show a small warning badge if mixed)
  - `lowThreshold` = sum of thresholds, used for the Low/OK badge
  - `projects` = array of `{ project, stock, unit, supplyId, code }`
  - `representativeCode` = stable code used for the group's QR. Use the code of the lowest-`created_at` member so the QR is deterministic.
- Stats (`Items` count) now reflects unique supply names, not row count.
- Render one card per group: name, total stock, unit, low/out badge, single QR button using the representative code.
- Clicking the **card body** opens a new "Breakdown" dialog (described below). The QR button keeps its current behavior but uses the group code.

**New `SupplyBreakdownDialog` component:**
- Props: the group object + `user` (for showing edit/delete on each row).
- Body: a table/list — one row per project showing project name, stock, unit, low badge, and (for logged-in users) Edit/Delete actions wired to the existing handlers per underlying supply id.
- Footer shows total + "Generate QR" button reusing the group's representative code.

**Search/filter:** Update the existing search to match against the group (any member's name/code/notes) and the low-stock filter to use the group's aggregate.

**Scanner compatibility:** A scanned QR still resolves to a single underlying `supplies` row by `code` — no change to checkout logic. The group QR resolves to the representative member, so checking out from a group QR will decrement that one row. Acceptable because the project picker at checkout determines accounting; if the scanned member's project differs, we fall back to the representative row's stock. (If you want scans to pick the row matching the chosen project, say so and we'll add that lookup.)

---

## Files to change

- `supabase/migrations/<new>.sql` — add `projects` column to `user_settings`
- `src/components/SettingsDialog.tsx` — projects management UI + save
- `src/pages/Index.tsx` — load projects, group supplies, breakdown dialog wiring, stats
- `src/components/SupplyBreakdownDialog.tsx` — new component
- `src/components/CheckoutDrawer.tsx` — project Select instead of text input
- `src/components/SupplyForm.tsx` — project Select
- `src/components/QuickStockInDialog.tsx` — project Select
- `src/components/ScanStockInDialog.tsx` — project Select (if it exposes project)

No changes needed to `src/lib/inventory.ts` or the `supplies`/`transactions` schemas.

---

## Open question

When a guest checks out by scanning a group QR and picks a project that has its own row, should the system **automatically decrement that project's row** (so per-project stock stays accurate), or always decrement the representative row? Default in this plan: decrement the representative row. Tell me if you want auto-routing to the matching project row.