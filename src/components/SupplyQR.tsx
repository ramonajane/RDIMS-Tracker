import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SupplyQR = ({ code, size = 180 }: { code: string; size?: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current && code) {
      QRCode.toCanvas(ref.current, code, {
        width: size,
        margin: 2,
        color: {
          dark: "#0f172a", // Slate-900: Deep dark gray for maximum visibility
          light: "#ffffff", // Pure white background
        },
      });
    }
  }, [code, size]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Container with border ensures visibility on white backgrounds */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <canvas ref={ref} className="rounded-sm" />
      </div>
      
      {/* Label showing the code text (Visibility Fix) */}
      <div className="px-3 py-1 bg-slate-100 rounded-md border border-slate-200">
        <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest">
          {code}
        </p>
      </div>
    </div>
  );
};

export const downloadQR = async (code: string, name: string) => {
  // 1024 width ensures the QR is crisp when printed on physical labels
  const dataUrl = await QRCode.toDataURL(code, { 
    width: 1024, 
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff"
    }
  });
  
  const link = document.createElement("a");
  link.href = dataUrl;
  
  // Format filename based on supply name (Lumping)
  const safeName = name.replace(/\s+/g, "_").toLowerCase();
  link.download = `QR_${safeName}.png`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
