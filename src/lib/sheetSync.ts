import { supabase } from "@/integrations/supabase/client";

let timer: number | undefined;
let pendingTxId: string | null = null;
let lastUrl: string | null = null;

/**
 * Debounced live-sync to Google Sheets. Coalesces bursts of changes into
 * one call ~600ms after the last change. If a transaction id is provided
 * within the window, it is appended to the Transactions tab.
 */
export function triggerSheetSync(txId?: string | null) {
  if (txId) pendingTxId = txId;
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(async () => {
    const body: Record<string, unknown> = { action: "sync" };
    if (pendingTxId) body.txId = pendingTxId;
    pendingTxId = null;
    try {
      const { data, error } = await supabase.functions.invoke("sync-sheet", { body });
      if (error) {
        console.warn("[sheet-sync] failed", error);
        return;
      }
      if (data?.url) lastUrl = data.url;
    } catch (e) {
      console.warn("[sheet-sync] error", e);
    }
  }, 600);
}

export async function getSheetUrl(): Promise<string | null> {
  if (lastUrl) return lastUrl;
  const { data } = await supabase.from("app_settings").select("value").eq("key", "sheet_id").maybeSingle();
  if (data?.value) {
    lastUrl = `https://docs.google.com/spreadsheets/d/${data.value}/edit`;
    return lastUrl;
  }
  return null;
}

export async function initSheet(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("sync-sheet", { body: { action: "sync" } });
    if (error) throw error;
    if (data?.url) { lastUrl = data.url; return data.url; }
  } catch (e) {
    console.warn("[sheet-sync] init failed", e);
  }
  return null;
}
