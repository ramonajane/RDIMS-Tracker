import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * The "owner" of a row. For signed-in users this is their auth id.
 * For guests (no session) it is null, which targets the shared/public inventory
 * (RLS allows anon read/write on rows where user_id IS NULL).
 */
export const ownerIdFor = (user: User | null | undefined): string | null =>
  user?.id ?? null;

/** Apply the appropriate user_id filter to a Supabase query builder. */
export const filterByOwner = <T extends { eq: any; is: any }>(q: T, user: User | null | undefined): T => {
  return user ? q.eq("user_id", user.id) : q.is("user_id", null);
};

/** Realtime postgres_changes filter string for the owner. */
export const ownerRealtimeFilter = (user: User | null | undefined): string =>
  user ? `user_id=eq.${user.id}` : `user_id=is.null`;

// re-export for convenience
export { supabase };
