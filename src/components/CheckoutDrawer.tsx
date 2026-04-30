import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scanner } from "./Scanner";
import { Supply, CartItem, adjustStock } from "@/lib/inventory";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Minus, Plus, Trash2, ScanLine, Receipt, ShoppingCart } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplies: Supply[];
};

export const CheckoutDrawer = ({ open, onOpenChange, supplies }: Props) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(true);
  const cartRef = useRef(cart);
  cartRef.current = cart;

  useEffect(() => { if (open) { setCart([]); setSearch(""); setScanning(true); } }, [open]);

  const addByCode = (code: string) => {
    const s = supplies.find(s => s.code === code);
    if (!s) { toast.error(`Unknown code: ${code}`); return; }
    addSupply(s);
  };

  const addSupply = (s: Supply) => {
    setCart(prev => {
      const i = prev.findIndex(c => c.supply.id === s.id);
      if (i >= 0) {
        const max = s.stock;
        if (prev[i].qty >= max) { toast.warning(`Only ${max} ${s.unit} in stock`); return prev; }
        const next = [...prev]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next;
      }
      if (s.stock <= 0) { toast.error(`${s.name} is out of stock`); return prev; }
      toast.success(`Added ${s.name}`);
      return [...prev, { supply: s, qty: 1 }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setCart(prev => prev.map(c => {
      if (c.supply.id !== id) return c;
      const clamped = Math.max(1, Math.min(c.supply.stock, qty));
      return { ...c, qty: clamped };
    }));
  };
  const remove = (id: string) => setCart(prev => prev.filter(c => c.supply.id !== id));

  const totalItems = cart.reduce((n, c) => n + c.qty, 0);

  const checkout = async () => {
    if (!user || cart.length === 0) return;
    setBusy(true);
    try {
      // Sequential to keep stock accurate; realtime will broadcast
      for (const c of cart) {
        await adjustStock(c.supply, -c.qty, "out");
      }
      toast.success(`Checked out ${totalItems} item${totalItems!==1?"s":""}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Checkout failed");
    } finally { setBusy(false); }
  };

  const filtered = search.trim()
    ? supplies.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b bg-gradient-header text-primary-foreground">
          <SheetTitle className="text-primary-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Checkout
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-3 border-b">
          {scanning ? (
            <Scanner onDetected={addByCode} onClose={() => setScanning(false)} cooldownMs={1500} />
          ) : (
            <Button onClick={() => setScanning(true)} variant="outline" className="w-full">
              <ScanLine className="h-4 w-4 mr-2" /> Open Scanner
            </Button>
          )}
          <div className="relative">
            <Input placeholder="Search by name or code…" value={search} onChange={e=>setSearch(e.target.value)} />
            {filtered.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-56 overflow-auto">
                {filtered.slice(0, 8).map(s => (
                  <button key={s.id} onClick={()=>{ addSupply(s); setSearch(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-accent/10 flex justify-between items-center">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.stock} {s.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">
              Scan or search to add items
            </div>
          ) : (
            <div className="py-3 space-y-2">
              {cart.map(c => (
                <div key={c.supply.id} className="rounded-lg border bg-card p-3 shadow-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.supply.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.supply.code}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={()=>remove(c.supply.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="secondary">{c.supply.unit}</Badge>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={()=>setQty(c.supply.id, c.qty-1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Input type="number" min={1} max={c.supply.stock} value={c.qty}
                        onChange={e=>setQty(c.supply.id, parseInt(e.target.value)||1)}
                        className="w-16 text-center h-8" />
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={()=>setQty(c.supply.id, c.qty+1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">In stock: {c.supply.stock}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />
        <div className="p-4 space-y-3 bg-secondary/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Items</span>
            <span className="font-semibold">{totalItems}</span>
          </div>
          <Button onClick={checkout} disabled={busy || cart.length === 0} size="lg" className="w-full">
            <Receipt className="h-4 w-4 mr-2" />
            {busy ? "Processing…" : `Confirm Checkout (${totalItems})`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
