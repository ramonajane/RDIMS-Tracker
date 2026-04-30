import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Scanner } from "@/components/Scanner";
import { Supply, adjustStock } from "@/lib/inventory";
import { toast } from "sonner";
import { X, Undo2, Volume2, Vibrate, Minus, Plus, ShoppingCart, Briefcase } from "lucide-react";
import { beepError, beepSuccess, getFeedbackPrefs, setFeedbackPrefs } from "@/lib/feedback";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplies: Supply[];
  projects: string[];
};

type Pending = { supply: Supply; previousStock: number };

const PRESET_QUANTITIES = [1, 2, 5, 10, 25];

export const CheckoutDrawer = ({ open, onOpenChange, supplies, projects }: Props) => {
  const [feedback, setFeedback] = useState<"ok" | "err" | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [last, setLast] = useState<{ name: string; stock: number; unit: string; qty: number; project: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState(() => getFeedbackPrefs());
  const [qty, setQty] = useState(1);
  const [project, setProject] = useState("");

  // Project options: union of managed list + any projects already on supplies (so guests still see options)
  const projectOptions = useMemo(() => {
    const set = new Set<string>(projects);
    supplies.forEach(s => { if (s.project) set.add(s.project); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [supplies, projects]);

  useEffect(() => { setFeedbackPrefs(prefs); }, [prefs]);

  useEffect(() => {
    if (!open) { setPending(null); setFeedback(null); setLast(null); setQty(1); setProject(""); }
  }, [open]);

  useEffect(() => {
    if (pending) {
      setQty(1);
      setProject(pending.supply.project ?? "");
    }
  }, [pending]);

  const flash = (kind: "ok" | "err") => {
    setFeedback(kind);
    setTimeout(() => setFeedback(null), 700);
  };

  const handleDetected = (code: string) => {
    if (pending || busy) return;
    const supply = supplies.find((s) => s.code === code.trim());
    if (!supply) { beepError(); flash("err"); toast.error(`Unknown code: ${code}`); return; }
    if (supply.stock <= 0) { beepError(); flash("err"); toast.error(`${supply.name} is out of stock`); return; }
    beepSuccess(); flash("ok");
    setPending({ supply, previousStock: supply.stock });
  };

  const changeQty = (delta: number) => {
    if (!pending) return;
    setQty(q => Math.min(Math.max(1, q + delta), pending.previousStock));
  };

  const setPreset = (n: number) => {
    if (!pending) return;
    setQty(Math.min(n, pending.previousStock));
  };

  const confirmCheckout = async () => {
    if (!pending) return;
    const finalQty = Math.min(qty, pending.previousStock);
    if (finalQty <= 0) { toast.error("Quantity must be at least 1"); return; }
    const trimmedProject = project.trim();
    if (!trimmedProject) { toast.error("Please indicate which project this supply is for"); return; }
    setBusy(true);
    try {
      await adjustStock(pending.supply, -finalQty, "out", trimmedProject);
      setLast({
        name: pending.supply.name,
        stock: pending.previousStock - finalQty,
        unit: pending.supply.unit,
        qty: finalQty,
        project: trimmedProject,
      });
      toast.success(`Checked out ${finalQty} ${pending.supply.unit} of ${pending.supply.name} for ${trimmedProject}`);
      setPending(null);
    } catch (e: any) {
      beepError(); toast.error(e.message ?? "Checkout failed");
    } finally { setBusy(false); }
  };

  const cancelPending = () => { setPending(null); toast("Scan discarded"); };

  const undoLast = async () => {
    if (!last) return;
    const supply = supplies.find((s) => s.name === last.name);
    if (!supply) { toast.error("Could not find item to undo"); return; }
    setBusy(true);
    try {
      await adjustStock(supply, last.qty, "in", last.project);
      toast.success(`Undid checkout — ${last.name} restored`);
      setLast(null);
    } catch (e: any) { toast.error(e.message ?? "Undo failed"); }
    finally { setBusy(false); }
  };

  return (
    <>
      {/* ── Main full-screen scanner dialog ── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-full w-screen h-screen p-0 gap-0 rounded-none border-0 sm:max-w-full flex flex-col"
          style={{ background: "linear-gradient(160deg, #0f172a 0%, #0e2a4a 60%, #0c1e38 100%)" }}
        >
          {/* Header — white text on dark bg */}
          <DialogHeader className="px-5 py-4 border-b border-white/10 flex flex-row items-center justify-between space-y-0 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-blue-300" />
              </div>
              <DialogTitle className="text-white font-semibold text-base leading-none">
                Scan to Checkout
              </DialogTitle>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/10 border border-white/20">
                <X className="h-4 w-4 mr-1" /> Close
              </Button>
            </DialogClose>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-5 space-y-5">
            <Scanner
              onDetected={handleDetected}
              onClose={() => onOpenChange(false)}
              cooldownMs={1500}
              paused={!!pending}
              feedback={feedback}
            />

            {/* Feedback prefs */}
            <div className="flex items-center justify-center gap-6 text-sm">
              <label className="flex items-center gap-2 cursor-pointer text-blue-300">
                <Volume2 className="h-4 w-4" />
                <Switch checked={prefs.sound} onCheckedChange={(v) => setPrefs((p) => ({ ...p, sound: v }))}
                  className="data-[state=checked]:bg-blue-500" />
                <span>Beep</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-blue-300">
                <Vibrate className="h-4 w-4" />
                <Switch checked={prefs.vibrate} onCheckedChange={(v) => setPrefs((p) => ({ ...p, vibrate: v }))}
                  className="data-[state=checked]:bg-blue-500" />
                <span>Vibrate</span>
              </label>
            </div>

            {/* Undo strip */}
            {!pending && last && (
              <div className="max-w-sm mx-auto rounded-xl border border-green-500/30 bg-green-950/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm min-w-0">
                    <p className="font-semibold text-green-300 truncate">{last.name}</p>
                    <p className="text-xs text-green-500 mt-0.5">
                      Checked out: <span className="font-bold text-green-300">{last.qty}</span> · Remaining:{" "}
                      <span className="font-bold text-green-200">{last.stock}</span> {last.unit}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={undoLast} disabled={busy}
                    className="border-green-600/40 text-green-300 bg-transparent hover:bg-green-900/30 shrink-0">
                    <Undo2 className="h-4 w-4 mr-1" /> Undo
                  </Button>
                </div>
              </div>
            )}

            {!pending && !last && (
              <p className="text-center text-sm text-blue-400/70">
                Point the camera at a supply's QR code to begin.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Quantity popup — clean light modal that slides over the scanner ── */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) cancelPending(); }}>
        <DialogContent className="max-w-sm w-[92vw] rounded-2xl border-0 bg-white p-0 shadow-2xl gap-0 overflow-hidden">

          {/* Popup header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
            <DialogTitle className="text-lg font-bold text-gray-900">Add to checkout</DialogTitle>
            <button
              onClick={cancelPending}
              className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {pending && (
            <div className="p-5 space-y-5">
              {/* Item info */}
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="font-bold text-gray-900 text-lg leading-tight">{pending.supply.name}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5 tracking-wide">{pending.supply.code}</p>
                <p className="text-sm text-gray-500 mt-2">
                  In stock:{" "}
                  <span className="font-bold text-gray-900">{pending.previousStock} {pending.supply.unit}</span>
                </p>
              </div>

              {/* − qty + stepper */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => changeQty(-1)}
                  disabled={qty <= 1}
                  className="h-14 w-14 rounded-2xl border-2 border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:border-gray-300 hover:bg-gray-50 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed transition-all shrink-0 shadow-sm"
                >
                  <Minus className="h-5 w-5" />
                </button>

                <div className="flex-1 h-14 rounded-2xl border-2 border-blue-400 bg-white flex items-center justify-center shadow-sm">
                  <span className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{qty}</span>
                </div>

                <button
                  onClick={() => changeQty(1)}
                  disabled={!!pending && qty >= pending.previousStock}
                  className="h-14 w-14 rounded-2xl border-2 border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:border-gray-300 hover:bg-gray-50 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed transition-all shrink-0 shadow-sm"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Preset quantity chips */}
              <div className="flex gap-2">
                {PRESET_QUANTITIES.map((n) => {
                  const disabled = n > pending.previousStock;
                  const active = qty === n && !disabled;
                  return (
                    <button
                      key={n}
                      onClick={() => setPreset(n)}
                      disabled={disabled}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border-2 active:scale-95 ${
                        active
                          ? "bg-blue-500 border-blue-500 text-white shadow-md"
                          : disabled
                          ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                          : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              {/* Project picker */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Briefcase className="h-4 w-4 text-blue-500" />
                  Project this supply is for
                </label>
                <input
                  type="text"
                  list="checkout-project-suggestions"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  placeholder="e.g. Marketing Campaign Q3"
                  className="w-full h-12 rounded-xl border-2 border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
                />
                <datalist id="checkout-project-suggestions">
                  {knownProjects.map((p) => <option key={p} value={p} />)}
                </datalist>
                {knownProjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {knownProjects.slice(0, 6).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProject(p)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          project === p
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary line */}
              <p className="text-center text-sm text-gray-400">
                <span className="font-semibold text-gray-700">{qty}</span>
                {" × "}
                {pending.supply.name}
                {" ("}
                {pending.supply.unit}
                {") "}
                {project.trim() && (
                  <>
                    → <span className="font-semibold text-blue-600">{project.trim()}</span>
                  </>
                )}
              </p>

              {/* Buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  onClick={confirmCheckout}
                  disabled={busy || !project.trim()}
                  className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-100"
                >
                  {busy ? "Saving…" : project.trim() ? "Confirm checkout" : "Enter project to continue"}
                </button>
                <button
                  onClick={cancelPending}
                  disabled={busy}
                  className="w-full py-3.5 rounded-2xl bg-white border-2 border-gray-200 hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-semibold text-base transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
