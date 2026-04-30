import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Scanner } from "./Scanner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: string[];
  defaultUnit: string;
};

export const ScanStockInDialog = ({ open, onOpenChange, units, defaultUnit }: Props) => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"scan" | "confirm">("scan");
  const [code, setCode] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState(defaultUnit);
  const [qty, setQty] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [existingName, setExistingName] = useState<string>("");

  useEffect(() => {
    if (open) { setPhase("scan"); setCode(""); setName(""); setUnit(defaultUnit); setQty(1); setExistingId(null); setExistingName(""); }
  }, [open, defaultUnit]);

  const handleDetected = async (decoded: string) => {
    const ownerId = user?.id ?? null;
    setCode(decoded);
    const lookup = supabase.from("supplies").select("id,name,unit").eq("code", decoded);
    const { data } = await (ownerId ? lookup.eq("user_id", ownerId) : lookup.is("user_id", null)).maybeSingle();
    if (data) { setExistingId(data.id); setExistingName(data.name); setUnit(data.unit); }
    setPhase("confirm");
  };

  const submit = async () => {
    if (qty <= 0) { toast.error("Quantity must be > 0"); return; }
    const ownerId = user?.id ?? null;
    setBusy(true);
    try {
      if (existingId) {
        const { data: cur } = await supabase.from("supplies").select("stock").eq("id", existingId).single();
        const { error } = await supabase.from("supplies").update({ stock: (cur?.stock ?? 0) + qty }).eq("id", existingId);
        if (error) throw error;
        await supabase.from("transactions").insert({ user_id: ownerId, supply_id: existingId, type: "in", quantity: qty });
        toast.success(`+${qty} added to ${existingName}`);
      } else {
        if (!name.trim()) { toast.error("Name required for new supply"); setBusy(false); return; }
        const { data: created, error } = await supabase.from("supplies")
          .insert({ user_id: ownerId, name: name.trim(), code, unit, stock: qty }).select().single();
        if (error) throw error;
        await supabase.from("transactions").insert({ user_id: ownerId, supply_id: created!.id, type: "in", quantity: qty });
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
