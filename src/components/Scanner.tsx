import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2 } from "lucide-react";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
  /** Min ms between successful scans — slows scanning */
  cooldownMs?: number;
  /** Pause scanning (e.g. while showing a confirmation) */
  paused?: boolean;
  /** "ok" briefly highlights green, "err" red */
  feedback?: "ok" | "err" | null;
};

export const Scanner = ({ onDetected, onClose, cooldownMs = 1500, paused = false, feedback = null }: Props) => {
  const elId = "rdims-scanner-region";
  const qrRef = useRef<Html5Qrcode | null>(null);
  const lastRef = useRef<{ code: string; t: number }>({ code: "", t: 0 });
  const pausedRef = useRef(paused);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const q = new Html5Qrcode(elId, { verbose: false });
    qrRef.current = q;
    q.start(
      { facingMode: "environment" },
      { fps: 4, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
      (decoded) => {
        if (pausedRef.current) return;
        const now = Date.now();
        if (decoded === lastRef.current.code && now - lastRef.current.t < cooldownMs) return;
        if (now - lastRef.current.t < 600) return;
        lastRef.current = { code: decoded, t: now };
        onDetected(decoded);
      },
      () => {}
    )
      .then(() => setReady(true))
      .catch((e) => setErr(e?.message ?? "Camera unavailable"));

    return () => {
      const inst = qrRef.current;
      if (inst && inst.isScanning) {
        inst.stop().then(() => inst.clear()).catch(() => {});
      }
    };
  }, [cooldownMs, onDetected]);

  const ringClass =
    feedback === "ok"
      ? "ring-4 ring-success animate-pulse"
      : feedback === "err"
      ? "ring-4 ring-destructive animate-pulse"
      : "ring-2 ring-primary/30";

  const flashClass =
    feedback === "ok"
      ? "bg-success/30"
      : feedback === "err"
      ? "bg-destructive/30"
      : "bg-transparent";

  return (
    <div className="space-y-3">
      <div className={`relative rounded-xl overflow-hidden bg-black aspect-square max-w-sm mx-auto transition-all ${ringClass}`}>
        <div id={elId} className="w-full h-full" />
        <div className={`absolute inset-0 pointer-events-none transition-colors duration-200 ${flashClass}`} />
        <div className="absolute inset-0 pointer-events-none border-[3px] border-primary/60 rounded-xl" />

        {/* Animated scan line */}
        {ready && !paused && !feedback && (
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="h-0.5 bg-primary/80 shadow-[0_0_12px_hsl(var(--primary))] animate-scanline" />
          </div>
        )}

        {/* Status pill */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur ${
            paused ? "bg-warning/80 text-warning-foreground" :
            ready ? "bg-success/80 text-success-foreground" :
            "bg-black/60 text-white"
          }`}>
            {paused ? (
              <>● Paused</>
            ) : ready ? (
              <><span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Scanning…</>
            ) : (
              <><Loader2 className="h-3 w-3 animate-spin" /> Starting camera…</>
            )}
          </span>
        </div>
      </div>
      {err && <p className="text-sm text-destructive text-center">{err}</p>}
      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
        <Camera className="h-3.5 w-3.5" /> Hold the QR code steady inside the frame
      </p>
      <Button variant="outline" onClick={onClose} className="w-full">
        <X className="h-4 w-4 mr-2" /> Stop Scanner
      </Button>
    </div>
  );
};
