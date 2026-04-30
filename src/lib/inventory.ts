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

export async function adjustStock(
  supply: Supply,
  delta: number,
  type: "in" | "out",
  project?: string | null,
) {
  const newStock = Math.max(0, supply.stock + delta);
  const { error: e1 } = await supabase
    .from("supplies")
    .update({ stock: newStock })
    .eq("id", supply.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("transactions").insert({
    user_id: null, // shared inventory: transactions are not owner-scoped
    supply_id: supply.id,
    type,
    quantity: Math.abs(delta),
    project: project?.trim() || null,
  });
  if (e2) throw e2;
}
