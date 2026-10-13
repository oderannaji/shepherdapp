import { createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
export const membershipSchema = z.object({
  organisation_id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  role: z.enum(["admin", "volunteer"]),
  active: z.boolean(),
});
export type Membership = z.infer<typeof membershipSchema>;
export const WorkspaceContext = createContext<{
  client: SupabaseClient;
  membership: Membership;
} | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace is not signed in");
  return value;
}
