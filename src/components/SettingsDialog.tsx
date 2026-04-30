import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: string[];
  defaultUnit: string;
  projects: string[];
};

export const SettingsDialog = ({ open, onOpenChange, units, defaultUnit, projects }: Props) => {
  const { user } = useAuth();
  const [list, setList] = useState<string[]>(units);
  const [def, setDef] = useState<string>(defaultUnit);
  const [add, setAdd] = useState("");
  const [projList, setProjList] = useState<string[]>(projects);
  const [addProj, setAddProj] = useState("");
  const [busy, setBusy] = useState(false);

  const addUnit = () => {
    const v = add.trim().toLowerCase();
    if (!v) return;
    if (list.includes(v)) { toast.error("Already exists"); return; }
    if (v.length > 32) { toast.error("Too long"); return; }
    setList([...list, v]); setAdd("");
  };
  const removeUnit = (u: string) => {
    if (list.length <= 1) { toast.error("Keep at least one unit"); return; }
    const next = list.filter(x => x !== u);
    setList(next);
    if (def === u) setDef(next[0]);
  };

  const addProject = () => {
    const v = addProj.trim();
    if (!v) return;
    if (projList.some(p => p.toLowerCase() === v.toLowerCase())) { toast.error("Project already exists"); return; }
    if (v.length > 120) { toast.error("Too long"); return; }
    setProjList([...projList, v]); setAddProj("");
  };
  const removeProject = (p: string) => setProjList(projList.filter(x => x !== p));

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("user_settings").upsert({
        user_id: user.id, units: list, default_unit: def, projects: projList,
      });
      if (error) throw error;
      toast.success("Settings saved");
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Settings — Measurement Units</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Available Units</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {list.map(u => (
                <Badge key={u} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                  {u}
                  <button onClick={()=>removeUnit(u)} className="ml-1 rounded-full hover:bg-destructive/20 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input placeholder="e.g. ream, box, bottle" value={add} onChange={e=>setAdd(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addUnit()} />
              <Button variant="outline" onClick={addUnit}>Add</Button>
            </div>
          </div>
          <div>
            <Label>Default Unit (for new supplies)</Label>
            <Select value={def} onValueChange={setDef}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>{list.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="border-t pt-4">
            <Label>Projects</Label>
            <p className="text-xs text-muted-foreground mt-1">Used as the dropdown when adding supplies and checking out.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {projList.length === 0 && <p className="text-xs text-muted-foreground italic">No projects yet — add one below.</p>}
              {projList.map(p => (
                <Badge key={p} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                  {p}
                  <button onClick={()=>removeProject(p)} className="ml-1 rounded-full hover:bg-destructive/20 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input placeholder="e.g. Marketing Campaign Q3" value={addProj} onChange={e=>setAddProj(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addProject()} />
              <Button variant="outline" onClick={addProject}>Add</Button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
