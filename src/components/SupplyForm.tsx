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
    const r = schema.safeParse({ name, code, unit, stock, low_stock_threshold: threshold, notes });
    if (!r.success) { toast.error(r.error.errors[0].message); return; }
    
    setBusy(true);
    try {
      // 1. Check if a supply with this QR code already exists (Lumping logic)
      const { data: existing } = await supabase
        .from("supplies")
        .select("id, stock, name")
        .eq("code", code)
        .maybeSingle();

      if (existing && !editing) {
        // 2. Add to existing supply stock instead of creating a new one
        const newStock = (existing.stock || 0) + stock;
        const { error: updateError } = await supabase
          .from("supplies")
          .update({ stock: newStock })
          .eq("id", existing.id);

        if (updateError) throw updateError;

        await supabase.from("transactions").insert({
          user_id: user?.id,
          supply_id: existing.id,
          type: "in",
          quantity: stock,
        });

        toast.success(`Added ${stock} to existing ${existing.name}`);
      } else if (editing) {
        // 3. Standard Edit
        const { error } = await supabase.from("supplies").update({
          name, code, unit, stock, low_stock_threshold: threshold,
          notes: notes || null,
        }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Supply updated");
      } else {
        // 4. Create New Global Supply
        const { data: created, error } = await supabase.from("supplies").insert({
          user_id: user?.id, name, code, unit, stock, low_stock_threshold: threshold,
          notes: notes || null,
        }).select().single();
        
        if (error) throw error;
        if (stock > 0 && created) {
          await supabase.from("transactions").insert({
            user_id: user?.id, supply_id: created.id, type: "in", quantity: stock 
          });
        }
        toast.success("New supply registered");
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
          <DialogTitle className="text-slate-900">{editing ? "Edit Supply" : "Add Supply"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 text-slate-700">
          <div>
            <Label className="text-slate-900 font-semibold">Name</Label>
            <Input className="border-slate-300 focus:border-blue-500" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. A4 Bond Paper" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-900 font-semibold">Code (QR)</Label>
              <Input className="bg-slate-50 border-slate-300 font-mono" value={code} onChange={e=>setCode(e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-900 font-semibold">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="border-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-900 font-semibold">Initial Stock</Label>
              <Input type="number" className="border-slate-300" value={stock} onChange={e=>setStock(parseInt(e.target.value)||0)} />
            </div>
            <div>
              <Label className="text-slate-900 font-semibold">Low-stock at</Label>
              <Input type="number" className="border-slate-300" value={threshold} onChange={e=>setThreshold(parseInt(e.target.value)||0)} />
            </div>
          </div>
          <div>
            <Label className="text-slate-900 font-semibold">Notes</Label>
            <Textarea className="border-slate-300" value={notes ?? ""} onChange={e=>setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-4 rounded-b-lg border-t border-slate-200">
          <Button variant="outline" className="text-slate-600 border-slate-300" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="bg-blue-600 hover:bg-blue-700">
            {busy ? "Saving…" : "Save Supply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
