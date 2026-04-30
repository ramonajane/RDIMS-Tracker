import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Scanner } from "@/components/Scanner";
import { Supply, adjustStock } from "@/lib/inventory";
import { toast } from "sonner";
import { X, Check, Undo2, Volume2, Vibrate, CheckCircle2, XCircle } from "lucide-react";
import { beepError, beepSuccess, getFeedbackPrefs, setFeedbackPrefs } from "@/lib/feedback";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplies: Supply[];
};

type Pending = { supply: Supply; previousStock: number };

export const CheckoutDrawer = ({ open, onOpenChange, supplies }: Props) => {
  const [feedback, setFeedback] = useState<"ok" | "err" | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [last, setLast] = useState<{ name: string; stock: number; unit: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState(getFeedbackPrefs());

  useEffect(() => { setFeedbackPrefs(prefs); }, [prefs]);

  // Reset state when reopened
  useEffect(() => {
    if (!open) {
      setPending(null); setFeedback(null); setLast(null);
    }
  }, [open]);

  const flash = (kind: "ok" | "err") => {
    setFeedback(kind);
    setTimeout(() => setFeedback(null), 700);
  };

  const handleDetected = (code: string) => {
    if (pending || busy) return;
    const supply = supplies.find((s) => s.code === code.trim());
    if (!supply) {
      beepError();
      flash("err");
      toast.error(`Unknown code: ${code}`);
      return;
    }
    if (supply.stock <= 0) {
      beepError();
      flash("err");
      toast.error(`${supply.name} is out of stock`);
      return;
    }
    beepSuccess();
    flash("ok");
    setPending({ supply, previousStock: supply.stock });
  };

  const confirmCheckout = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await adjustStock(pending.supply, -1, "out");
      setLast({
        name: pending.supply.name,
        stock: pending.previousStock - 1,
        unit: pending.supply.unit,
      });
      toast.success(`Checked out 1 ${pending.supply.unit} of ${pending.supply.name}`);
      setPending(null);
    } catch (e: any) {
      beepError();
      toast.error(e.message ?? "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const cancelPending = () => {
    setPending(null);
    toast("Scan discarded");
  };

  const undoLast = async () => {
    if (!last) return;
    const supply = supplies.find((s) => s.name === last.name);
    if (!supply) {
      toast.error("Could not find item to undo");
      return;
    }
    setBusy(true);
    try {
      await adjustStock(supply, 1, "in");
      toast.success(`Undid checkout — ${last.name} restored`);
      setLast(null);
    } catch (e: any) {
      toast.error(e.message ?? "Undo failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full w-screen h-screen sm:h-screen p-0 gap-0 rounded-none border-0 sm:max-w-full flex flex-col">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
          <DialogTitle>Scan a QR code</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              <X className="h-4 w-4 mr-1" /> Close
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <Scanner
            onDetected={handleDetected}
            onClose={() => onOpenChange(false)}
            cooldownMs={1500}
            paused={!!pending}
            feedback={feedback}
          />

          {/* Feedback prefs */}
          <div className="max-w-sm mx-auto flex items-center justify-center gap-5 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Switch
                checked={prefs.sound}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, sound: v }))}
              />
              <span>Beep</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Vibrate className="h-4 w-4 text-muted-foreground" />
              <Switch
                checked={prefs.vibrate}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, vibrate: v }))}
              />
              <Label className="cursor-pointer">Vibrate</Label>
            </label>
          </div>

          {/* Confirmation card */}
          {pending && (
            <div className="max-w-sm mx-auto rounded-xl border-2 border-primary bg-card p-4 shadow-lg">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <CheckCircle2 className="h-5 w-5" /> Confirm checkout
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-lg font-bold">{pending.supply.name}</p>
                <p className="text-sm text-muted-foreground font-mono">{pending.supply.code}</p>
                <p className="text-sm">
                  Stock: <span className="font-semibold">{pending.previousStock}</span> → <span className="font-bold text-primary">{pending.previousStock - 1}</span> {pending.supply.unit}
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={cancelPending} disabled={busy}>
                  <XCircle className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button className="flex-1" onClick={confirmCheckout} disabled={busy}>
                  <Check className="h-4 w-4 mr-1" /> {busy ? "Saving…" : "Confirm"}
                </Button>
              </div>
            </div>
          )}

          {/* Last successful checkout — undo */}
          {!pending && last && (
            <div className="max-w-sm mx-auto rounded-lg border bg-success/10 border-success/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm min-w-0">
                  <p className="font-medium truncate">{last.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Remaining: <span className="font-semibold text-foreground">{last.stock}</span> {last.unit}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={undoLast} disabled={busy}>
                  <Undo2 className="h-4 w-4 mr-1" /> Undo
                </Button>
              </div>
            </div>
          )}

          {!pending && !last && (
            <p className="text-center text-sm text-muted-foreground">
              Point the camera at a supply's QR code.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
