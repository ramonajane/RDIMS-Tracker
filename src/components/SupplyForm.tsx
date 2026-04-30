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
  code: z.string().trim().min(1, "QR Code required").max(64),
  unit: z.string().trim().min(1).max(32),
  stock: z.number().int().min(0).max(1_000_000),
  low_stock_threshold: z.number().int().min(0).max(1_000_000),
  notes: z.string().trim().max(500).optional(),
  project: z.string().trim().max(120).optional(),
});

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: string[];
  defaultUnit: string;
  projects: string[]; // This comes from your settings
  initialCode?: string;
  editing?: Supply | null;
};

export const SupplyForm = ({ open, onOpenChange, units, defaultUnit, projects, initialCode, editing }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? initialCode ?? generateCode());
  const [unit, setUnit] = useState(editing?.unit ?? defaultUnit);
  const [stock, setStock] = useState<number>(editing?.stock ?? 0);
  const [threshold, setThreshold] = useState<number>(editing?.low_stock_threshold ?? 5);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [project, setProject] = useState(editing?.project ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const r = schema.safeParse({ name, code, unit, stock, low_stock_threshold: threshold, notes, project });
    if (!r.success) { toast.error(r.error.errors[0].message); return; }
    
    setBusy(true);
    try {
      // LUMPING LOGIC: Check if this QR code already exists in the system
      const { data: existingItem } = await supabase
        .from("supplies")
        .select("id, stock, name")
        .eq("code", code)
        .maybeSingle();

      if (existingItem && !editing) {
        // ITEM EXISTS: Just update the stock (Lump it)
        const newTotal = (existingItem.stock || 0) + stock;
        await supabase.from("supplies").update({ stock: newTotal }).eq("id", existingItem.id);
        
        // Log transaction with the selected project
        await supabase.from("transactions").insert({
          user_id: user?.id,
          supply_id: existingItem.id,
          type: "in",
          quantity: stock,
          project: project || null,
        });

        toast.success(`Lumped ${stock} into existing ${existingItem.name}`);
      } else if (editing) {
        // Normal Update
        await supabase.from("supplies").update({
          name, code, unit, stock, low_stock_threshold: threshold,
          notes: notes || null, project: project || null
        }).eq("id", editing.id);
        toast.success("Supply updated");
      } else {
        // Create Brand New Supply
        const { data: created, error } = await supabase.from("supplies").insert({
          user_id: user?.id, name, code, unit, stock, low_stock_threshold: threshold,
          notes: notes || null, project: project || null
        }).select().single();
        
        if (created && stock > 0) {
          await supabase.from("transactions").insert({
            user_id: user?.id, supply_id: created.id, type: "in", quantity: stock, project: project || null
          });
        }
        toast.success("New item registered");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-slate-900">{editing ? "Edit Supply" : "Add Supply"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2 text-slate-800">
          <div>
            <Label className="text-slate-700">Name</Label>
            <Input className="border-slate-300 text-slate-900" value={name} onChange={e=>setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-700">QR Code (Global)</Label>
              <Input className="bg-slate-50 border-slate-300 font-mono text-blue-700" value={code} onChange={e=>setCode(e.target.value)} />
            </div>
            <div>
              <Label className="text-slate-700">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="border-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-slate-700">Project Category</Label>
            <Select value={project || "__none__"} onValueChange={(v)=>setProject(v === "__none__" ? "" : v)}>
              <SelectTrigger className="border-slate-300"><SelectValue placeholder="No project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None / General</SelectItem>
                {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-700">Stock Amount</Label>
              <Input type="number" className="border-slate-300" value={stock} onChange={e=>setStock(parseInt(e.target.value)||0)} />
            </div>
            <div>
              <Label className="text-slate-700">Alert at</Label>
              <Input type="number" className="border-slate-300" value={threshold} onChange={e=>setThreshold(parseInt(e.target.value)||0)} />
            </div>
          </div>
        </div>

        <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-4 border-t border-slate-200">
          <Button variant="outline" className="border-slate-300 text-slate-600" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="bg-blue-600 hover:bg-blue-700">
            {busy ? "Saving…" : "Save Supply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
