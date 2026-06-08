// Live Google Sheets sync for the inventory app.
// - On first call, creates a new spreadsheet with Inventory + Transactions tabs.
// - On every call, rewrites the Inventory tab from current DB state.
// - Optionally appends one row to the Transactions tab (when a tx payload is provided).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GS_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const gsHeaders = {
  "Authorization": `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": GS_KEY,
  "Content-Type": "application/json",
};

async function gs(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gsHeaders, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function getSheetId(): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings").select("value").eq("key", "sheet_id").maybeSingle();
  return data?.value ?? null;
}

async function setSheetId(id: string) {
  await supabase.from("app_settings").upsert({ key: "sheet_id", value: id, updated_at: new Date().toISOString() });
}

async function createSpreadsheet(): Promise<string> {
  const created = await gs("/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title: `Inventory Live Sync — ${new Date().toLocaleDateString()}` },
      sheets: [
        { properties: { title: "Inventory", gridProperties: { rowCount: 1000, columnCount: 6 } } },
        { properties: { title: "Transactions", gridProperties: { rowCount: 5000, columnCount: 7 } } },
      ],
    }),
  });
  const id = created.spreadsheetId as string;
  // Write headers
  await gs(`/spreadsheets/${id}/values/Inventory!A1:F1?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [["Supply Name", "Code", "Project", "Unit", "Stock", "Updated At"]] }),
  });
  await gs(`/spreadsheets/${id}/values/Transactions!A1:G1?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [["Timestamp", "Type", "Supply Name", "Code", "Project", "Quantity", "Resulting Stock"]] }),
  });
  await setSheetId(id);
  return id;
}

async function syncInventory(sheetId: string) {
  const { data: supplies } = await supabase
    .from("supplies").select("name, code, project, unit, stock, updated_at")
    .order("name", { ascending: true }).order("project", { ascending: true });
  const rows = (supplies ?? []).map(s => [
    s.name, s.code, s.project ?? "", s.unit, s.stock, s.updated_at,
  ]);
  await gs(`/spreadsheets/${sheetId}/values/Inventory!A2:F?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: rows.length ? rows : [["", "", "", "", "", ""]] }),
  });
  // Clear any extra trailing rows from previous syncs
  await gs(`/spreadsheets/${sheetId}/values/Inventory!A${rows.length + 2}:F?`, {
    method: "POST",
  }).catch(() => {});
}

async function appendTransaction(sheetId: string, txId: string) {
  const { data: tx } = await supabase
    .from("transactions").select("created_at, type, quantity, project, supply_id").eq("id", txId).maybeSingle();
  if (!tx) return;
  const { data: sup } = await supabase
    .from("supplies").select("name, code, stock").eq("id", tx.supply_id).maybeSingle();
  const row = [
    tx.created_at,
    tx.type,
    sup?.name ?? "",
    sup?.code ?? "",
    tx.project ?? "",
    tx.quantity,
    sup?.stock ?? "",
  ];
  await gs(`/spreadsheets/${sheetId}/values/Transactions!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [row] }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? "sync";

    let sheetId = await getSheetId();
    if (!sheetId) sheetId = await createSpreadsheet();
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

    if (action === "info") {
      return new Response(JSON.stringify({ sheetId, url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await syncInventory(sheetId);
    if (body.txId) await appendTransaction(sheetId, body.txId);

    return new Response(JSON.stringify({ ok: true, sheetId, url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
