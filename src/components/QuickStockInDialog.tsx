import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: string[];
  defaultUnit: string;
  projects: string[]; // unused — kept for API parity
};

export const QuickStockInDialog = ({ open, onOpenChange, units, defaultUnit }: Props) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState(defaultUnit);
  const [qty, setQty] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  const reset = () => { setCode(""); setName(""); setUnit(defaultUnit); setQty(1); };

  const submit = async () => {
    if (qty <= 0) { toast.error("Quantity must be > 0"); return; }
    setBusy(true);
    try {
      // Existing supply by code?
      const { data: existing } = await supabase
        .from("supplies").select("*").eq("code", code.trim()).maybeSingle();

      if (existing) {
        const newStock = existing.stock + qty;
        const { error } = await supabase.from("supplies").update({ stock: newStock }).eq("id", existing.id);
        if (error) throw error;
        await supabase.from("transactions").insert({
          supply_id: existing.id, type: "in", quantity: qty, project: null,
        });
        toast.success(`+${qty} ${existing.unit} of ${existing.name}`);
      } else {
        if (!name.trim()) { toast.error("Name required for new supply"); setBusy(false); return; }
        // Reuse existing supply if same name already exists
        const { data: byName } = await supabase
          .from("supplies").select("*").ilike("name", name.trim()).maybeSingle();
        if (byName) {
          const newStock = byName.stock + qty;
          await supabase.from("supplies").update({ stock: newStock }).eq("id", byName.id);
          await supabase.from("transactions").insert({
            supply_id: byName.id, type: "in", quantity: qty, project: null,
          });
          toast.success(`+${qty} ${byName.unit} of ${byName.name}`);
        } else {
          const { data: created, error } = await supabase.from("supplies")
            .insert({ name: name.trim(), code: code.trim(), unit, stock: qty })
            .select().single();
          if (error) throw error;
          await supabase.from("transactions").insert({
            supply_id: created!.id, type: "in", quantity: qty, project: null,
          });
          toast.success(`Added ${name} (+${qty})`);
        }
      }
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Stock-in failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o)=>{ if(!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Stock In <Badge variant="secondary" className="ml-2">Manual</Badge></DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Code</Label>
            <Input value={code} onChange={e=>setCode(e.target.value)} placeholder="Existing or new code" />
            <p className="text-xs text-muted-foreground mt-1">Existing codes add to the unified stock. New codes create a supply.</p>
          </div>
          <div>
            <Label>Name (only for new supplies)</Label>
            <Input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. A4 Bond Paper" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={1} value={qty} onChange={e=>setQty(parseInt(e.target.value)||1)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !code.trim()}>{busy ? "Saving…" : "Add Stock"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
