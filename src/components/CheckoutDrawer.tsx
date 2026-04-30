import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Scanner } from "@/components/Scanner";
import { Supply, adjustStock } from "@/lib/inventory";
import { toast } from "sonner";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplies: Supply[];
};

export const CheckoutDrawer = ({ open, onOpenChange, supplies }: Props) => {
  const [last, setLast] = useState<{ name: string; stock: number } | null>(null);

  const handleDetected = async (code: string) => {
    const supply = supplies.find((s) => s.code === code.trim());
    if (!supply) {
      toast.error(`Unknown code: ${code}`);
      return;
    }
    if (supply.stock <= 0) {
      toast.error(`${supply.name} is out of stock`);
      return;
    }
    try {
      await adjustStock(supply, -1, "out");
      const newStock = supply.stock - 1;
      setLast({ name: supply.name, stock: newStock });
      toast.success(`Checked out 1 ${supply.unit} of ${supply.name}`);
    } catch (e: any) {
      toast.error(e.message ?? "Checkout failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full w-screen h-screen sm:h-screen p-0 gap-0 rounded-none border-0 sm:max-w-full">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
          <DialogTitle>Scan a QR code</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              <X className="h-4 w-4 mr-1" /> Close
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {open && (
            <Scanner
              onDetected={handleDetected}
              onClose={() => onOpenChange(false)}
              cooldownMs={1500}
            />
          )}
          {last && (
            <div className="max-w-sm mx-auto rounded-lg border bg-card p-3 text-center text-sm">
              <span className="font-medium">{last.name}</span> — remaining stock:{" "}
              <span className="font-bold text-primary">{last.stock}</span>
            </div>
          )}
          <p className="text-center text-sm text-muted-foreground">
            Point the camera at a supply's QR code.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
