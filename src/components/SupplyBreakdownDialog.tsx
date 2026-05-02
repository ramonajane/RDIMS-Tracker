import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, QrCode, Package2 } from "lucide-react";
import { SupplyQR, downloadQR } from "@/components/SupplyQR";
import type { Supply } from "@/lib/inventory";

export type SupplyGroup = {
  key: string;
  name: string;
  unit: string;
  totalStock: number;
  lowThreshold: number;
  representativeCode: string;
  members: Supply[];
  mixedUnits: boolean;
};

type Props = {
  group: SupplyGroup | null;
  onOpenChange: (o: boolean) => void;
  canManage: boolean;
  onEdit: (s: Supply) => void;
  onDelete: (s: Supply) => void;
};

export const SupplyBreakdownDialog = ({ group, onOpenChange, canManage, onEdit, onDelete }: Props) => {
  return (
    <Dialog open={!!group} onOpenChange={(o)=>{ if (!o) onOpenChange(false); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5 text-primary" />
            <span className="truncate">{group?.name}</span>
          </DialogTitle>
        </DialogHeader>
        {group && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 border p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total stock</p>
                <p className="text-3xl font-bold text-primary mt-1">
                  {group.totalStock} <span className="text-base font-normal text-muted-foreground">{group.unit}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {group.members.length} project entr{group.members.length === 1 ? "y" : "ies"}
                  {group.mixedUnits && <span className="text-warning ml-2">· mixed units</span>}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <SupplyQR code={group.representativeCode} size={96} />
                <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[110px]">{group.representativeCode}</p>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                  onClick={()=>downloadQR(group.representativeCode, group.name)}>
                  <QrCode className="h-3 w-3 mr-1" /> Download
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {group.members.map(m => {
                const low = m.stock <= m.low_stock_threshold;
                const out = m.stock === 0;
                return (
                  <div key={m.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {m.project ?? <span className="italic text-muted-foreground">Unassigned</span>}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{m.code}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{m.stock} <span className="text-xs text-muted-foreground font-normal">{m.unit}</span></p>
                      <Badge variant={out ? "destructive" : low ? "outline" : "secondary"}
                        className={`text-[10px] mt-0.5 ${low && !out ? "border-warning text-warning" : ""}`}>
                        {out ? "Out" : low ? "Low" : "OK"}
                      </Badge>
                    </div>
                    {canManage && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="outline" onClick={()=>onEdit(m)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" onClick={()=>onDelete(m)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
