import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Scanner } from "./Scanner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: string[];
  defaultUnit: string;
  projects: string[];
};

export const ScanStockInDialog = ({ open, onOpenChange, units, defaultUnit, projects }: Props) => {
  
  const [phase, setPhase] = useState<"scan" | "confirm">("scan");
  const [code, setCode] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState(defaultUnit);
  const [qty, setQty] = useState<number>(1);
  const [project, setProject] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [existingName, setExistingName] = useState<string>("");
  const [existingProject, setExistingProject] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setPhase("scan"); setCode(""); setName(""); setUnit(defaultUnit); setQty(1); setProject(""); setExistingId(null); setExistingName(""); setExistingProject(null); }
  }, [open, defaultUnit]);

  const handleDetected = async (decoded: string) => {
    setCode(decoded);
    // Find any row with this shared code; pick the oldest as the "representative"
    const { data: rows } = await supabase
      .from("supplies").select("id,name,unit,project,created_at")
      .eq("code", decoded).order("created_at", { ascending: true });
    if (rows && rows.length > 0) {
      const rep = rows[0];
      setExistingId(rep.id);
      setExistingName(rep.name);
      setUnit(rep.unit);
      setExistingProject(rep.project ?? null);
      setProject(rep.project ?? "");
    }
    setPhase("confirm");
  };

  const submit = async () => {
    if (qty <= 0) { toast.error("Quantity must be > 0"); return; }
    setBusy(true);
    try {
      const finalProject = (project || existingProject || "").trim() || null;

      if (existingId) {
        // Look for a row matching this shared code AND chosen project
        const { data: rows } = await supabase
          .from("supplies").select("*").eq("code", code);
        const projectMatch = rows?.find(r => (r.project ?? null) === finalProject);

        if (projectMatch) {
          const { error } = await supabase.from("supplies")
            .update({ stock: projectMatch.stock + qty }).eq("id", projectMatch.id);
          if (error) throw error;
          await supabase.from("transactions").insert({ user_id: null, supply_id: projectMatch.id, type: "in", quantity: qty, project: finalProject });
          toast.success(`+${qty} added to ${projectMatch.name}${finalProject ? ` (${finalProject})` : ""}`);
        } else {
          // Same supply, new project — create a new row reusing the shared code
          const rep = rows?.[0];
          const { data: created, error } = await supabase.from("supplies")
            .insert({ user_id: null, name: rep?.name ?? existingName, code, unit: rep?.unit ?? unit, stock: qty, project: finalProject }).select().single();
          if (error) throw error;
          await supabase.from("transactions").insert({ user_id: null, supply_id: created!.id, type: "in", quantity: qty, project: finalProject });
          toast.success(`Added ${rep?.name ?? existingName} for ${finalProject ?? "no project"} (+${qty})`);
        }
      } else {
        if (!name.trim()) { toast.error("Name required for new supply"); setBusy(false); return; }
        // If the typed name matches an existing group, reuse its shared code
        const { getCodeForName } = await import("@/lib/inventory");
        const sharedCode = await getCodeForName(name.trim());
        const finalCode = sharedCode ?? code;
        const { data: created, error } = await supabase.from("supplies")
          .insert({ user_id: null, name: name.trim(), code: finalCode, unit, stock: qty, project: finalProject }).select().single();
        if (error) throw error;
        await supabase.from("transactions").insert({ user_id: null, supply_id: created!.id, type: "in", quantity: qty, project: finalProject });
        toast.success(`Added ${name} (+${qty})`);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Stock-in failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{phase === "scan" ? "Scan to Stock In" : existingId ? `Add to ${existingName}` : "New Supply"}</DialogTitle>
        </DialogHeader>
        {phase === "scan" ? (
          <Scanner onDetected={handleDetected} onClose={() => onOpenChange(false)} />
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Code</Label>
              <Input value={code} readOnly className="font-mono" />
            </div>
            {!existingId && (
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={e=>setName(e.target.value)} placeholder="New supply name" autoFocus />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {!existingId && (
                <div>
                  <Label>Unit</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className={existingId ? "col-span-2" : ""}>
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
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={()=>setPhase("scan")}>Scan Again</Button>
              <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Confirm Stock In"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
