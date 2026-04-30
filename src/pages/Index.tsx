import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Supply } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package2, Plus, Search, ShoppingCart, Settings, LogOut, LogIn, ScanLine, Pencil, QrCode, Trash2, AlertTriangle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { CheckoutDrawer } from "@/components/CheckoutDrawer";
import { SupplyForm } from "@/components/SupplyForm";
import { SettingsDialog } from "@/components/SettingsDialog";
import { QuickStockInDialog } from "@/components/QuickStockInDialog";
import { ScanStockInDialog } from "@/components/ScanStockInDialog";
import { SupplyQR, downloadQR } from "@/components/SupplyQR";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [units, setUnits] = useState<string[]>(["piece","ream","box","pack","bottle"]);
  const [defaultUnit, setDefaultUnit] = useState("piece");

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supply | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualIn, setManualIn] = useState(false);
  const [scanIn, setScanIn] = useState(false);
  const [qrFor, setQrFor] = useState<Supply | null>(null);

  // Guests are allowed: no redirect to /auth.

  // Initial fetch + ensure settings row
  useEffect(() => {
    if (loading) return;
    (async () => {
      const supQuery = supabase.from("supplies").select("*").order("created_at", { ascending: false });
      const { data: sup } = await (user ? supQuery.eq("user_id", user.id) : supQuery.is("user_id", null));
      setSupplies(sup ?? []);

      if (user) {
        const { data: st } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
        if (!st) {
          await supabase.from("user_settings").insert({ user_id: user.id });
        } else {
          setUnits(st.units); setDefaultUnit(st.default_unit);
        }
      }
    })();
  }, [user, loading]);

  // Realtime subscription
  useEffect(() => {
    if (loading) return;
    const filter = user ? `user_id=eq.${user.id}` : `user_id=is.null`;
    const ch = supabase.channel("supplies-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "supplies", filter },
        (payload) => {
          setSupplies(prev => {
            if (payload.eventType === "INSERT") return [payload.new as Supply, ...prev];
            if (payload.eventType === "UPDATE") return prev.map(s => s.id === (payload.new as Supply).id ? payload.new as Supply : s);
            if (payload.eventType === "DELETE") return prev.filter(s => s.id !== (payload.old as Supply).id);
            return prev;
          });
        });
    if (user) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: "user_settings", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) { setUnits((payload.new as any).units); setDefaultUnit((payload.new as any).default_unit); }
        });
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loading]);

  const filtered = useMemo(() => {
    let list = supplies;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.notes ?? "").toLowerCase().includes(q));
    }
    if (lowOnly) list = list.filter(s => s.stock <= s.low_stock_threshold);
    return list;
  }, [supplies, search, lowOnly]);

  const lowCount = supplies.filter(s => s.stock <= s.low_stock_threshold).length;
  const totalItems = supplies.reduce((n, s) => n + s.stock, 0);

  const removeSupply = async (s: Supply) => {
    if (!confirm(`Delete "${s.name}"? This also removes its history.`)) return;
    const { error } = await supabase.from("supplies").delete().eq("id", s.id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-subtle"><Package2 className="h-8 w-8 text-primary animate-pulse" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-gradient-header text-primary-foreground shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary-foreground/10 backdrop-blur flex items-center justify-center shrink-0">
              <Package2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg sm:text-xl truncate">RDIMS Office Supplies Tracker</h1>
              <p className="text-xs text-primary-foreground/70 truncate">
                {user ? user.email : "Guest — shared inventory"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={()=>setSettingsOpen(true)}>
                <Settings className="h-5 w-5" />
              </Button>
            )}
            {user ? (
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={signOut} title="Sign out">
                <LogOut className="h-5 w-5" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={()=>nav("/auth")}>
                <LogIn className="h-4 w-4 mr-1.5" /> Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Items</p>
            <p className="text-2xl font-bold text-primary mt-1">{supplies.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Stock</p>
            <p className="text-2xl font-bold text-primary mt-1">{totalItems}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Low Stock</p>
            <p className={`text-2xl font-bold mt-1 ${lowCount > 0 ? "text-warning" : "text-primary"}`}>{lowCount}</p>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={()=>setCheckoutOpen(true)} size="lg" className="flex-1 min-w-[160px] shadow-md">
            <ShoppingCart className="h-5 w-5 mr-2" /> Checkout
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg" variant="secondary" className="flex-1 min-w-[160px] shadow-md">
                <Plus className="h-5 w-5 mr-2" /> Stock In <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={()=>setManualIn(true)}>
                <Pencil className="h-4 w-4 mr-2" /> Manually add a supply
              </DropdownMenuItem>
              <DropdownMenuItem onClick={()=>setScanIn(true)}>
                <ScanLine className="h-4 w-4 mr-2" /> Scan for stock-in
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={()=>{ setEditing(null); setFormOpen(true); }} size="lg" variant="outline" className="shadow-sm">
            <Plus className="h-5 w-5 mr-2" /> New Supply
          </Button>
        </div>

        {/* Search + filter */}
        <Card className="p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, code, or notes…" value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch id="low" checked={lowOnly} onCheckedChange={setLowOnly} />
            <Label htmlFor="low" className="cursor-pointer text-sm flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Low stock only
            </Label>
          </div>
        </Card>

        {/* Supply list */}
        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Package2 className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-muted-foreground">{supplies.length === 0 ? "No supplies yet. Add your first item." : "No supplies match your filter."}</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(s => {
              const low = s.stock <= s.low_stock_threshold;
              const out = s.stock === 0;
              return (
                <Card key={s.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{s.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono truncate">{s.code}</p>
                    </div>
                    <Badge variant={out ? "destructive" : low ? "outline" : "secondary"}
                      className={low && !out ? "border-warning text-warning" : ""}>
                      {out ? "Out" : low ? "Low" : "OK"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-primary">{s.stock}</span>
                    <span className="text-sm text-muted-foreground">{s.unit}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Low at ≤ {s.low_stock_threshold}</p>
                  {s.notes && <p className="text-xs mt-2 line-clamp-2 text-muted-foreground">{s.notes}</p>}
                  <div className="flex gap-1 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={()=>setQrFor(s)}>
                      <QrCode className="h-4 w-4 mr-1" /> QR
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={()=>{ setEditing(s); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button size="icon" variant="outline" onClick={()=>removeSupply(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <CheckoutDrawer open={checkoutOpen} onOpenChange={setCheckoutOpen} supplies={supplies} />
      <SupplyForm open={formOpen} onOpenChange={(o)=>{ setFormOpen(o); if (!o) setEditing(null); }}
        units={units} defaultUnit={defaultUnit} editing={editing} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} units={units} defaultUnit={defaultUnit} />
      <QuickStockInDialog open={manualIn} onOpenChange={setManualIn} units={units} defaultUnit={defaultUnit} />
      <ScanStockInDialog open={scanIn} onOpenChange={setScanIn} units={units} defaultUnit={defaultUnit} />

      <Dialog open={!!qrFor} onOpenChange={(o)=>{ if(!o) setQrFor(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="truncate">{qrFor?.name}</DialogTitle></DialogHeader>
          {qrFor && (
            <div className="flex flex-col items-center gap-3">
              <SupplyQR code={qrFor.code} size={220} />
              <p className="text-xs font-mono text-muted-foreground">{qrFor.code}</p>
              <Button onClick={()=>downloadQR(qrFor.code, qrFor.name)} className="w-full">Download PNG</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
