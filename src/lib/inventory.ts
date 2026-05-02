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
  project: string | null;
  created_at: string;
  updated_at: string;
};

export type CartItem = { supply: Supply; qty: number };

export const generateCode = () =>
  "RDIMS-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

/**
 * Returns the shared QR code already in use for any supply whose name
 * matches (case-insensitive, trimmed). Returns null if no match.
 */
export async function getCodeForName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("supplies")
    .select("code")
    .ilike("name", trimmed)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.code ?? null;
}

/**
 * Adjust stock for a supply.
 * For checkouts ("out"), if a `project` is provided we route the decrement
 * to the row in the same name-group that matches that project — keeping
 * per-project stock accurate even when checking out via the shared QR.
 */
export async function adjustStock(
  supply: Supply,
  delta: number,
  type: "in" | "out",
  project?: string | null,
) {
  const trimmedProject = project?.trim() || null;
  let target = supply;

  if (type === "out" && trimmedProject) {
    const { data: match } = await supabase
      .from("supplies")
      .select("*")
      .ilike("name", supply.name.trim())
      .eq("project", trimmedProject)
      .maybeSingle();
    if (match && match.stock > 0) target = match as Supply;
  }

  const newStock = Math.max(0, target.stock + delta);
  const { error: e1 } = await supabase
    .from("supplies")
    .update({ stock: newStock })
    .eq("id", target.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("transactions").insert({
    user_id: null,
    supply_id: target.id,
    type,
    quantity: Math.abs(delta),
    project: trimmedProject,
  });
  if (e2) throw e2;
}
