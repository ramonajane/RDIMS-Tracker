import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export const SupplyQR = ({ code, size = 180 }: { code: string; size?: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) QRCode.toCanvas(ref.current, code, { width: size, margin: 1 });
  }, [code, size]);
  return <canvas ref={ref} className="rounded-lg bg-white p-2 shadow-sm" />;
};

export const downloadQR = async (code: string, name: string) => {
  const dataUrl = await QRCode.toDataURL(code, { width: 512, margin: 2 });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${name.replace(/\s+/g, "_")}_QR.png`;
  a.click();
};
