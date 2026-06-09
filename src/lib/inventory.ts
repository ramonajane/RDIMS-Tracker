import { supabase } from "@/integrations/supabase/client";

export type Supply = {
  id: string;
  user_id: string | null;
  name: string;
  code: string;
  unit: string;
  stock: number;
  low_stock_threshold: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CartItem = { supply: Supply; qty: number };

export const generateCode = () =>
  "RDIMS-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

/**
 * Returns the QR code for a supply with this name (case-insensitive), or null.
 * Names are now unique across the inventory.
 */
export async function getCodeForName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data } = await supabase
    .from("supplies")
    .select("code")
    .ilike("name", trimmed)
    .maybeSingle();
  return data?.code ?? null;
}

/**
 * Adjust a supply's unified stock.
 * The `project` is recorded on the transaction only (for per-project usage reporting).
 */
export async function adjustStock(
  supply: Supply,
  delta: number,
  type: "in" | "out",
  project?: string | null,
) {
  const trimmedProject = project?.trim() || null;
  const newStock = Math.max(0, supply.stock + delta);

  const { error: e1 } = await supabase
    .from("supplies")
    .update({ stock: newStock })
    .eq("id", supply.id);
  if (e1) throw e1;

  const { error: e2 } = await supabase.from("transactions").insert({
    user_id: null,
    supply_id: supply.id,
    type,
    quantity: Math.abs(delta),
    project: trimmedProject,
  });
  if (e2) throw e2;
}
