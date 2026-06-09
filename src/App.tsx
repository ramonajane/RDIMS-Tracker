import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client"; // Ensure this path matches your supabase client file!

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// ── NEW: Global Real-time Listener ──
// This invisible component listens to Supabase and tells React Query
// to instantly refresh the screen for all users when a change happens.
const GlobalRealtimeSync = () => {
  const qc = useQueryClient();

  useEffect(() => {
    // Listen for any inserts, updates, or deletes on the 'supplies' table
    const suppliesChannel = supabase
      .channel("public:supplies")
      .on("postgres_changes", { event: "*", schema: "public", table: "supplies" }, () => {
        // Invalidate all queries to trigger a background refetch
        qc.invalidateQueries();
      })
      .subscribe();

    // Listen for any inserts, updates, or deletes on the 'projects' table
    const projectsChannel = supabase
      .channel("public:projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        qc.invalidateQueries();
      })
      .subscribe();

    // Cleanup channels when component unmounts
    return () => {
      supabase.removeChannel(suppliesChannel);
      supabase.removeChannel(projectsChannel);
    };
  }, [qc]);

  return null; // Renders nothing visibly to the screen
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          {/* We place the listener inside the Auth and Query providers */}
          <GlobalRealtimeSync />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
