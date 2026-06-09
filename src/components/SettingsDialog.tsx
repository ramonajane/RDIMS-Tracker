import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, ExternalLink, RefreshCw, FileSpreadsheet } from "lucide-react";
import { getSheetUrl, initSheet } from "@/lib/sheetSync";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: string[];
  defaultUnit: string;
  projects: string[];
};

export const SettingsDialog = ({ open, onOpenChange, units, defaultUnit, projects }: Props) => {
  const { user } = useAuth();

  // ── Local state mirrors the props. Re-sync every time the dialog opens
  //    so you always see the latest saved values (fixes the stale-prop problem).
  const [list, setList]       = useState<string[]>([]);
  const [def, setDef]         = useState<string>("");
  const [add, setAdd]         = useState("");
  const [projList, setProjList] = useState<string[]>([]);
  const [addProj, setAddProj] = useState("");
  const [busy, setBusy]       = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);

  // Re-initialise local state every time the dialog opens (not just on mount).
  useEffect(() => {
    if (!open) return;
    setList([...units]);
    setDef(defaultUnit);
    setProjList([...projects]);
    setAdd("");
    setAddProj("");
    getSheetUrl().then(setSheetUrl);
  }, [open, units, defaultUnit, projects]);

  // ── Sheet helpers ──────────────────────────────────────────────────────
  const connectSheet = async () => {
    setSheetBusy(true);
    try {
      const url = await initSheet();
      if (url) { setSheetUrl(url); toast.success("Google Sheet ready"); }
      else toast.error("Could not set up sheet");
    } finally { setSheetBusy(false); }
  };

  // ── Unit helpers ───────────────────────────────────────────────────────
  const addUnit = () => {
    const v = add.trim().toLowerCase();
    if (!v) return;
    if (list.includes(v)) { toast.error("Already exists"); return; }
    if (v.length > 32) { toast.error("Too long"); return; }
    setList(prev => [...prev, v]);
    setAdd("");
  };

  const removeUnit = (u: string) => {
    if (list.length <= 1) { toast.error("Keep at least one unit"); return; }
    const next = list.filter(x => x !== u);
    setList(next);
    if (def === u) setDef(next[0]);
  };

  // ── Project helpers ────────────────────────────────────────────────────
  const addProject = () => {
    const v = addProj.trim();
    if (!v) return;
    if (projList.some(p => p.toLowerCase() === v.toLowerCase())) {
      toast.error("Project already exists");
      return;
    }
    if (v.length > 120) { toast.error("Too long"); return; }
    setProjList(prev => [...prev, v]);
    setAddProj("");
  };

  const removeProject = (p: string) =>
    setProjList(prev => prev.filter(x => x !== p));

  // ── Save ───────────────────────────────────────────────────────────────
  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const payload = {
        user_id: user.id,
        units: list,
        default_unit: def,
        projects: projList,
      };

      const { error } = await supabase
        .from("user_settings")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      toast.success("Settings saved");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Units ── */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Measurement Units</Label>
            <div className="flex flex-wrap gap-2">
              {list.map(u => (
                <Badge key={u} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                  {u}
                  <button
                    onClick={() => removeUnit(u)}
                    className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. ream, box, bottle"
                value={add}
                onChange={e => setAdd(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addUnit()}
              />
              <Button variant="outline" onClick={addUnit}>Add</Button>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Default unit for new supplies</Label>
              <Select value={def} onValueChange={setDef}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {list.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Projects ── */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <Label className="text-base font-semibold">Projects</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Used as the dropdown when checking out supplies.
              </p>
            </div>

            {projList.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No projects yet — add one below.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {projList.map(p => (
                  <Badge key={p} variant="secondary" className="pl-2 pr-1 py-1 gap-1 max-w-full">
                    <span className="truncate max-w-[200px]">{p}</span>
                    <button
                      onClick={() => removeProject(p)}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5 shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="e.g. Marketing Campaign Q3"
                value={addProj}
                onChange={e => setAddProj(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addProject()}
              />
              <Button variant="outline" onClick={addProject}>Add</Button>
            </div>
          </div>

          {/* ── Google Sheets sync ── */}
          <div className="border-t pt-4 space-y-2">
            <Label className="text-base font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Live Google Sheets Sync
            </Label>
            <p className="text-xs text-muted-foreground">
              Every stock-in and checkout is pushed to a Google Sheet in real time.
            </p>
            {sheetUrl ? (
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="flex-1" asChild>
                  <a href={sheetUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" /> Open Sheet
                  </a>
                </Button>
                <Button variant="outline" onClick={connectSheet} disabled={sheetBusy}>
                  <RefreshCw className={`h-4 w-4 ${sheetBusy ? "animate-spin" : ""}`} />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={connectSheet}
                disabled={sheetBusy}
              >
                {sheetBusy ? "Creating sheet…" : "Create live-sync sheet"}
              </Button>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
