import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #0e2a4a 60%, #0c1e38 100%)" }}
    >
      {/* Decorative background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-blue-400/8 blur-3xl" />
      </div>
 
      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl border border-blue-700/40 bg-blue-950/60 backdrop-blur-xl p-8 shadow-2xl shadow-blue-900/50">
          {/* Logo + Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
              <Package2 className="h-8 w-8 text-blue-300" />
            </div>
            <h1 className="text-xl font-bold text-blue-50 text-center leading-tight">RDIMS Office Supplies Tracker</h1>
            <p className="text-sm text-blue-400 mt-1.5">Sign in to manage your inventory</p>
          </div>
 
          <Tabs defaultValue="in">
            <TabsList className="grid grid-cols-2 w-full bg-blue-900/40 border border-blue-700/40 p-1 rounded-xl mb-6">
              <TabsTrigger
                value="in"
                className="rounded-lg text-blue-400 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md font-medium transition-all"
              >
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="up"
                className="rounded-lg text-blue-400 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md font-medium transition-all"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>
 
            {(["in", "up"] as const).map(m => (
              <TabsContent key={m} value={m} className="space-y-4 mt-0">
                <div className="space-y-1.5">
                  <Label className="text-blue-300 text-sm font-medium">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="bg-blue-900/30 border-blue-700/50 text-blue-100 placeholder:text-blue-500 focus:border-blue-400 focus:ring-blue-400/20 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-blue-300 text-sm font-medium">Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-blue-900/30 border-blue-700/50 text-blue-100 placeholder:text-blue-500 focus:border-blue-400 focus:ring-blue-400/20 h-11"
                  />
                </div>
                <Button
                  onClick={() => handle(m)}
                  disabled={busy}
                  className="w-full h-11 bg-blue-500 hover:bg-blue-400 text-white font-semibold shadow-lg shadow-blue-500/30 mt-2 rounded-xl"
                  size="lg"
                >
                  {busy ? "Please wait…" : m === "in" ? "Sign In" : "Create Account"}
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
};
 
export default Auth;
