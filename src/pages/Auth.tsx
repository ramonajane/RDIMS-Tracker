import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Package2 } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
});

const Auth = () => {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) nav("/", { replace: true }); }, [user, loading, nav]);

  const handle = async (mode: "in" | "up") => {
    const r = schema.safeParse({ email, password });
    if (!r.success) { toast.error(r.error.errors[0].message); return; }
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created — check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) { toast.error(e.message ?? "Auth failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-3">
            <Package2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-center">RDIMS Office Supplies Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage your inventory</p>
        </div>
        <Tabs defaultValue="in">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="in">Sign In</TabsTrigger>
            <TabsTrigger value="up">Sign Up</TabsTrigger>
          </TabsList>
          {(["in","up"] as const).map(m => (
            <TabsContent key={m} value={m} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button onClick={()=>handle(m)} disabled={busy} className="w-full" size="lg">
                {busy ? "Please wait…" : m === "in" ? "Sign In" : "Create Account"}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </div>
  );
};
export default Auth;
