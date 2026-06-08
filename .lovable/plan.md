# Live Google Sheets Sync

Push every stock-in / checkout to a Google Sheet in real time — no refresh needed, works for guest checkouts too.

## What you'll see in the sheet

A new spreadsheet I create on first sync, with two tabs:

**`Inventory`** — live snapshot, one row per supply+project, rewritten on every change.
```
Supply Name | Code | Project | Unit | Stock | Updated At
```

**`Transactions`** — append-only audit log.
```
Timestamp | Type (in/out) | Supply Name | Code | Project | Quantity | Resulting Stock
```

## How it works

```text
Stock change (UI or guest checkout)
   → write to supplies / transactions tables
   → Postgres realtime broadcast
   → frontend subscription fires `sync-sheet` edge function
   → edge function calls Google Sheets API via Lovable connector gateway
   → sheet updates within ~1–2 seconds
```

Because the trigger lives on the realtime stream of the `transactions` table, every open browser stays in sync and guest checkouts also flow through — no manual refresh.

## Steps

1. **Connect Google Sheets** — I'll open the connector picker; you authorize once with your Google account. The sheet will live in that account's Drive.
2. **Enable realtime** on `supplies` and `transactions` via a small migration.
3. **Create edge function `sync-sheet`** with two actions:
   - `init` — creates the spreadsheet + two tabs with headers, stores the spreadsheet ID as a secret (`SHEET_ID`).
   - `sync` — called after each change; rewrites `Inventory` tab from current DB state and appends one row to `Transactions`.
4. **Wire the frontend**:
   - Subscribe to `postgres_changes` on `transactions` in `src/pages/Index.tsx`; on each event, invoke `sync-sheet` (debounced ~500 ms to coalesce bursts).
   - Also call `sync-sheet` directly after `adjustStock` and stock-in dialogs so the writer sees their own change instantly.
5. **Auto-init**: on first invocation if `SHEET_ID` is missing, the function runs `init`, saves the ID, then returns the sheet URL so the UI can show a "View Sheet" link in Settings.

## Technical details

- Edge function uses `https://connector-gateway.lovable.dev/google_sheets/v4` with `Authorization: Bearer LOVABLE_API_KEY` and `X-Connection-Api-Key: GOOGLE_SHEETS_API_KEY`.
- `Inventory` written with `values.update` on `Inventory!A2:F` after a `values.clear`; `Transactions` written with `values:append`.
- Realtime subscription scoped to `transactions` INSERT events; debounced sync avoids hammering the API on bulk changes.
- Spreadsheet ID stored as a project secret so it persists across deploys and is shared by all users.
- A "View Google Sheet" link added in `SettingsDialog.tsx` once `SHEET_ID` is set.

## What I need from you after approval

- Approve the Google Sheets connector authorization popup.
- That's it — I'll create the spreadsheet for you and share its URL in Settings.
