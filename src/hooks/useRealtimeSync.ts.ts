import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useRealtimeSync = (onDatabaseChange: () => void) => {
  useEffect(() => {
    // Listen for any changes (INSERT, UPDATE, DELETE) on the 'supplies' table
    const suppliesChannel = supabase
      .channel("public:supplies")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "supplies" },
        () => {
          onDatabaseChange();
        }
      )
      .subscribe();

    // Listen for any changes on the 'projects' table (if projects are in their own table)
    const projectsChannel = supabase
      .channel("public:projects")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => {
          onDatabaseChange();
        }
      )
      .subscribe();

    // Cleanup the listeners when the component unmounts
    return () => {
      supabase.removeChannel(suppliesChannel);
      supabase.removeChannel(projectsChannel);
    };
  }, [onDatabaseChange]);
};