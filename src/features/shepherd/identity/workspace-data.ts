import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useWorkspace, type Membership } from "./context";
export function useWorkspaceData<T>(
  key: unknown[],
  load: (client: SupabaseClient, member: Membership) => Promise<T>,
  enabled = true,
) {
  const { client, membership } = useWorkspace();
  return useQuery({
    queryKey: ["workspace", membership.organisation_id, membership.user_id, ...key],
    queryFn: () => load(client, membership),
    enabled,
    retry: false,
    refetchInterval: 15000,
  });
}
export function useWorkspaceMutation() {
  const { client, membership } = useWorkspace();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const retry = useRef({ payload: "", id: "" });
  const lock = useRef(false);
  async function run<T>(work: () => Promise<T>, success = "Saved."): Promise<T | undefined> {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = await work();
      await cache.invalidateQueries();
      setMessage(success);
      retry.current = { payload: "", id: "" };
      return value;
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === "23505"
          ? "This record already exists. Refresh the list before trying again."
          : code === "23514" || code === "23502"
            ? "Check the required details and use international phone numbers where provided."
            : code === "40001"
              ? "This record changed. Your draft is still here; reload and review it before saving again."
              : code === "42501"
                ? "Your account does not have permission for this action."
                : e instanceof Error
                  ? e.message
                  : typeof (e as { message?: string })?.message === "string"
                    ? (e as { message: string }).message
                    : "Could not confirm the save. Your draft is still here. Retry when the connection is restored.",
      );
      return undefined;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function requestId(payload: unknown) {
    const serialized = JSON.stringify(payload);
    if (retry.current.payload !== serialized)
      retry.current = { payload: serialized, id: crypto.randomUUID() };
    return retry.current.id;
  }
  async function adminAction(action: string, payload: Record<string, unknown>) {
    return run(async () => {
      const r = await client.rpc("shepherd_admin_action", {
        p_organisation_id: membership.organisation_id,
        p_action: action,
        p_payload: payload,
        p_request_id: requestId({ action, payload }),
      });
      if (r.error) throw r.error;
      return r.data;
    });
  }
  return { run, adminAction, requestId, busy, error, message };
}
