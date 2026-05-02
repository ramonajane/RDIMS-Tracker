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
  projects: string[];
};

export const QuickStockInDialog = ({ open, onOpenChange, units, defaultUnit, projects }: Props) => {

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState(defaultUnit);
  const [qty, setQty] = useState<number>(1);
  const [project, setProject] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setCode(""); setName(""); setUnit(defaultUnit); setQty(1); setProject(""); };

  const submit = async () => {
    if (qty <= 0) { toast.error("Quantity must be > 0"); return; }
    setBusy(true);
    try {
      const trimmedProject = project.trim() || null;
      // Find any existing supply with this code (shared QR across projects)
      const { data: existingRows } = await supabase
        .from("supplies").select("*").eq("code", code.trim());
      const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

      // If we have a project, prefer the row matching that project; else fall back to any
      const projectMatch = existingRows?.find(
        r => (r.project ?? null) === trimmedProject
      );

      if (projectMatch) {
        const newStock = projectMatch.stock + qty;
        const { error } = await supabase.from("supplies").update({ stock: newStock }).eq("id", projectMatch.id);
        if (error) throw error;
        await supabase.from("transactions").insert({ user_id: null, supply_id: projectMatch.id, type: "in", quantity: qty, project: trimmedProject });
        toast.success(`+${qty} ${projectMatch.unit} of ${projectMatch.name}`);
      } else if (existing) {
        // Same supply name exists but for other projects — create a new row reusing the shared code
        const { data: created, error } = await supabase.from("supplies")
          .insert({ user_id: null, name: existing.name, code: existing.code, unit: existing.unit, stock: qty, project: trimmedProject })
          .select().single();
        if (error) throw error;
        await supabase.from("transactions").insert({ user_id: null, supply_id: created!.id, type: "in", quantity: qty, project: trimmedProject });
        toast.success(`Added ${existing.name} for ${trimmedProject ?? "no project"} (+${qty})`);
      } else {
        if (!name.trim()) { toast.error("Name required for new supply"); setBusy(false); return; }
        // Brand new supply — but if name matches an existing group, reuse that shared code
        const { getCodeForName } = await import("@/lib/inventory");
        const sharedCode = await getCodeForName(name.trim());
        const finalCode = sharedCode ?? code.trim();
        const { data: created, error } = await supabase.from("supplies")
          .insert({ user_id: null, name: name.trim(), code: finalCode, unit, stock: qty, project: trimmedProject })
          .select().single();
        if (error) throw error;
        await supabase.from("transactions").insert({ user_id: null, supply_id: created!.id, type: "in", quantity: qty, project: trimmedProject });
        toast.success(`Added ${name} (+${qty})`);
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
            <p className="text-xs text-muted-foreground mt-1">Existing codes will add to stock. New codes create a supply.</p>
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
          <div>
            <Label>Project (optional)</Label>
            <Select value={project || "__none__"} onValueChange={(v)=>setProject(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No project</SelectItem>
                {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
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
