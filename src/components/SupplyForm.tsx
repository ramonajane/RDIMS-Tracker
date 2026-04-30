import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generateCode, Supply } from "@/lib/inventory";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  code: z.string().trim().min(1).max(64),
  unit: z.string().trim().min(1).max(32),
  stock: z.number().int().min(0).max(1_000_000),
  low_stock_threshold: z.number().int().min(0).max(1_000_000),
  notes: z.string().trim().max(500).optional(),
});

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: string[];
  defaultUnit: string;
  initialCode?: string;
  editing?: Supply | null;
};

export const SupplyForm = ({ open, onOpenChange, units, defaultUnit, initialCode, editing }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? initialCode ?? generateCode());
  const [unit, setUnit] = useState(editing?.unit ?? defaultUnit);
  const [stock, setStock] = useState<number>(editing?.stock ?? 0);
  const [threshold, setThreshold] = useState<number>(editing?.low_stock_threshold ?? 5);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);

  // Reset when opening
  const reset = () => {
    setName(editing?.name ?? "");
    setCode(editing?.code ?? initialCode ?? generateCode());
    setUnit(editing?.unit ?? defaultUnit);
    setStock(editing?.stock ?? 0);
    setThreshold(editing?.low_stock_threshold ?? 5);
    setNotes(editing?.notes ?? "");
  };

  const handleOpen = (o: boolean) => {
    if (o) reset();
    onOpenChange(o);
  };

  const save = async () => {
    if (!user) return;
    const r = schema.safeParse({ name, code, unit, stock, low_stock_threshold: threshold, notes });
    if (!r.success) { toast.error(r.error.errors[0].message); return; }
    setBusy(true);
    try {
      if (editing) {
        const { error } = await supabase.from("supplies").update({
          name, code, unit, stock, low_stock_threshold: threshold, notes: notes || null,
        }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Supply updated");
      } else {
        const { error } = await supabase.from("supplies").insert({
          user_id: user.id, name, code, unit, stock, low_stock_threshold: threshold, notes: notes || null,
        });
        if (error) throw error;
        if (stock > 0) {
          await supabase.from("transactions").insert({
            user_id: user.id, supply_id: (await supabase.from("supplies").select("id").eq("user_id", user.id).eq("code", code).single()).data!.id,
            type: "in", quantity: stock,
          });
        }
        toast.success("Supply added");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Supply" : "Add Supply"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. A4 Bond Paper" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code (QR)</Label>
              <Input value={code} onChange={e=>setCode(e.target.value)} />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Initial Stock</Label>
              <Input type="number" min={0} value={stock} onChange={e=>setStock(parseInt(e.target.value)||0)} />
            </div>
            <div>
              <Label>Low-stock at</Label>
              <Input type="number" min={0} value={threshold} onChange={e=>setThreshold(parseInt(e.target.value)||0)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes ?? ""} onChange={e=>setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
