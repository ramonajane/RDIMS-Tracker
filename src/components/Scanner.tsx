import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
  /** Min ms between successful scans — slows scanning */
  cooldownMs?: number;
};

export const Scanner = ({ onDetected, onClose, cooldownMs = 1500 }: Props) => {
  const elId = "rdims-scanner-region";
  const qrRef = useRef<Html5Qrcode | null>(null);
  const lastRef = useRef<{ code: string; t: number }>({ code: "", t: 0 });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = new Html5Qrcode(elId, { verbose: false });
    qrRef.current = q;
    q.start(
      { facingMode: "environment" },
      // fps lowered to 4 to slow scanning down
      { fps: 4, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
      (decoded) => {
        const now = Date.now();
        if (decoded === lastRef.current.code && now - lastRef.current.t < cooldownMs) return;
        if (now - lastRef.current.t < 600) return; // global throttle
        lastRef.current = { code: decoded, t: now };
        onDetected(decoded);
      },
      () => {}
    ).catch((e) => setErr(e?.message ?? "Camera unavailable"));

    return () => {
      const inst = qrRef.current;
      if (inst && inst.isScanning) {
        inst.stop().then(() => inst.clear()).catch(() => {});
      }
    };
  }, [cooldownMs, onDetected]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-sm mx-auto ring-2 ring-primary/30">
        <div id={elId} className="w-full h-full" />
        <div className="absolute inset-0 pointer-events-none border-[3px] border-primary/60 rounded-xl" />
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
