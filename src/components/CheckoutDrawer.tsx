import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Supply } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { toast } from "sonner";
import { ShoppingCart, X, Trash2, PackageMinus } from "lucide-react";

export interface CheckoutDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplies: Supply[];
  projects: string[];
}

interface CartItem {
  supply: Supply;
  quantity: number;
}

export const CheckoutDrawer = ({ open, onOpenChange, supplies, projects }: CheckoutDrawerProps) => {
  const { user } = useAuth();
  
  // Form & Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedSupplyId, setSelectedSupplyId] = useState<string>("");
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [borrowerName, setBorrowerName] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Reset everything when drawer closes
  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setCart([]);
      setSelectedSupplyId("");
      setSelectedQty(1);
      setBorrowerName("");
      setSelectedProject("");
    }
    onOpenChange(newOpen);
  };

  const addToCart = () => {
    if (!selectedSupplyId) return toast.error("Please select a supply to add.");
    const supply = supplies.find((s) => s.id === selectedSupplyId);
    if (!supply) return;

    if (selectedQty <= 0) return toast.error("Quantity must be at least 1.");
    if (selectedQty > supply.stock) return toast.error(`Only ${supply.stock} ${supply.unit} available in stock.`);

    // Check if item is already in cart to combine quantities
    const existingIndex = cart.findIndex((c) => c.supply.id === supply.id);
    
    if (existingIndex >= 0) {
      const newTotal = cart[existingIndex].quantity + selectedQty;
      if (newTotal > supply.stock) {
        return toast.error(`Adding this exceeds available stock (${supply.stock} ${supply.unit}).`);
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity = newTotal;
      setCart(updatedCart);
    } else {
      setCart([...cart, { supply, quantity: selectedQty }]);
    }

    // Reset inputs for next item
    setSelectedSupplyId("");
    setSelectedQty(1);
  };

  const removeFromCart = (supplyId: string) => {
    setCart(cart.filter((c) => c.supply.id !== supplyId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error("Your cart is empty.");
    if (!user && !borrowerName.trim()) return toast.error("Guests must provide a borrower name.");
    if (!selectedProject) return toast.error("Please select a project or department.");

    setLoading(true);
    try {
      // Process each item in the cart
      for (const item of cart) {
        // 1. Insert the transaction record
        const { error: txError } = await supabase.from("transactions").insert({
          supply_id: item.supply.id,
          user_id: user ? user.id : null,
          borrower_name: user ? null : borrowerName.trim(),
          project: selectedProject,
          quantity: item.quantity,
          type: "checkout",
        });
        if (txError) throw txError;

        // 2. Deduct from actual supply stock
        const newStock = item.supply.stock - item.quantity;
        const { error: stockError } = await supabase
          .from("supplies")
          .update({ stock: newStock })
          .eq("id", item.supply.id);
        if (stockError) throw stockError;
      }

      toast.success("Checkout completed successfully!");
      handleClose(false); // Close drawer and reset on success
    } catch (error: any) {
      toast.error(`Checkout failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Only show supplies that actually have stock available
  const availableSupplies = supplies.filter((s) => s.stock > 0);

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[95vh] flex flex-col">
        
        {/* THIS IS THE SINGLE, UNIFIED CLOSE BUTTON FOR ALL USERS */}
        <DrawerClose asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-4 top-4 z-10 rounded-full text-slate-500 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </DrawerClose>

        <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-xl">
              <ShoppingCart className="h-5 w-5 text-primary" /> Checkout Supplies
            </DrawerTitle>
            <DrawerDescription>
              {user 
                ? "You are signed in. This checkout will be linked to your account." 
                : "Guest Checkout. Please provide your name for the records."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 space-y-6">
            
            {/* --- 1. Borrower Details --- */}
            <div className="space-y-4 bg-slate-50 p-4 rounded-lg border">
              {!user && (
                <div className="space-y-2">
                  <Label htmlFor="borrowerName">Borrower Name (Required)</Label>
                  <Input
                    id="borrowerName"
                    placeholder="e.g. John Doe"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="project">Project / Department (Required)</Label>
                <select
                  id="project"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">Select a project...</option>
                  {projects.map((proj, idx) => (
                    <option key={idx} value={proj}>{proj}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* --- 2. Add Items to Cart --- */}
            <div className="space-y-3">
              <Label>Select Supplies</Label>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={selectedSupplyId}
                    onChange={(e) => setSelectedSupplyId(e.target.value)}
                  >
                    <option value="">Choose an item...</option>
                    {availableSupplies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.stock} {s.unit} left)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min="1"
                    value={selectedQty}
                    onChange={(e) => setSelectedQty(Number(e.target.value))}
                  />
                </div>
                <Button variant="secondary" onClick={addToCart}>Add</Button>
              </div>
            </div>

            {/* --- 3. Cart Summary --- */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="flex items-center gap-2">
                <PackageMinus className="h-4 w-4" /> Items to Checkout
              </Label>
              
              {cart.length === 0 ? (
                <div className="text-sm text-muted-foreground italic text-center py-4 bg-slate-50 rounded-md border border-dashed">
                  No items added yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {cart.map((item, idx) => (
                    <li key={idx} className="flex items-center justify-between bg-white p-3 rounded-md border shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{item.supply.name}</span>
                        <span className="text-xs text-muted-foreground">{item.supply.code}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm">
                          {item.quantity} <span className="text-xs font-normal text-muted-foreground">{item.supply.unit}</span>
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromCart(item.supply.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </div>

        {/* --- 4. Actions --- */}
        <DrawerFooter className="border-t bg-slate-50/50">
          <Button onClick={handleCheckout} disabled={loading || cart.length === 0} className="w-full">
            {loading ? "Processing..." : `Confirm Checkout (${cart.length} items)`}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
        
      </DrawerContent>
    </Drawer>
  );
};
