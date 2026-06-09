import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Briefcase, Package2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Supply } from "@/lib/inventory";

type Row = { project: string; qty: number };

type Props = {
  supply: Supply | null;
  onOpenChange: (o: boolean) => void;
};

export const SupplyUsageDialog = ({ supply, onOpenChange }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supply) { setRows([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("transactions")
        .select("project, quantity, type")
        .eq("supply_id", supply.id)
        .eq("type", "out");
      if (cancelled) return;
      const totals = new Map<string, number>();
      (data ?? []).forEach((t: any) => {
        const key = (t.project ?? "").trim() || "— No project —";
        totals.set(key, (totals.get(key) ?? 0) + (t.quantity ?? 0));
      });
      const list = Array.from(totals.entries())
        .map(([project, qty]) => ({ project, qty }))
        .sort((a, b) => b.qty - a.qty);
      setRows(list);
      setLoading(false);
    })();

    // Live-refresh when new transactions arrive for this supply
    const ch = supabase
      .channel(`usage-${supply.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `supply_id=eq.${supply.id}` },
        (payload: any) => {
          if (payload.new?.type !== "out") return;
          const key = (payload.new.project ?? "").trim() || "— No project —";
          setRows(prev => {
            const map = new Map(prev.map(r => [r.project, r.qty]));
            map.set(key, (map.get(key) ?? 0) + (payload.new.quantity ?? 0));
            return Array.from(map.entries()).map(([project, qty]) => ({ project, qty })).sort((a, b) => b.qty - a.qty);
          });
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [supply]);

  const total = rows.reduce((n, r) => n + r.qty, 0);

  return (
    <Dialog open={!!supply} onOpenChange={(o)=>{ if (!o) onOpenChange(false); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5 text-primary" />
            <span className="truncate">{supply?.name} — Usage by project</span>
          </DialogTitle>
        </DialogHeader>
        {supply && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 border p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current stock</p>
              <p className="text-3xl font-bold text-primary mt-1">
                {supply.stock} <span className="text-base font-normal text-muted-foreground">{supply.unit}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Total checked out (all time): <span className="font-semibold text-foreground">{total} {supply.unit}</span>
              </p>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Loading usage…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No checkouts recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {rows.map(r => (
                  <div key={r.project} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Briefcase className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-sm font-medium truncate">{r.project}</p>
                    </div>
                    <p className="font-bold shrink-0">
                      {r.qty} <span className="text-xs text-muted-foreground font-normal">{supply.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
