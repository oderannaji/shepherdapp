import { useEffect, useState, type ReactNode } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { connection } from "./runtime";
import { membershipSchema, WorkspaceContext } from "./context";
import { Mfa } from "./Mfa";
import { SignIn, PasswordSetup } from "./PasswordForms";
import {
  passwordLinkIntent,
  pendingPasswordAction,
  savePasswordAction,
  clearPasswordAction,
  type PasswordAction,
} from "./password-action";

export function IdentityGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [action, setAction] = useState<PasswordAction | null>(null);
  const [linkError, setLinkError] = useState(false);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    if (connection.mode !== "connected") return;
    let active = true;
    let previousUser: string | null = null;
    const intent = passwordLinkIntent(window.location.href);
    const nextClient = createClient(connection.url, connection.key);
    setClient(nextClient);
    // Subscribe before initialization completes so recovery callbacks cannot be missed.
    const { data: subscription } = nextClient.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (previousUser !== next?.user.id) {
        queryClient.clear();
        setAction(next ? pendingPasswordAction(window.sessionStorage, next.user.id) : null);
      }
      previousUser = next?.user.id ?? null;
      setSession(next);
      if (event === "PASSWORD_RECOVERY" && next) {
        savePasswordAction(window.sessionStorage, next.user.id, "recovery");
        setAction("recovery");
      }
      if (event === "SIGNED_OUT") {
        clearPasswordAction(window.sessionStorage);
        setAction(null);
      }
    });
    void (async () => {
      try {
        const initialized = await nextClient.auth.initialize();
        const result = await nextClient.auth.getSession();
        if (!active) return;
        setSession(result.data.session);
        if (intent.hasCallback && (intent.hasError || initialized.error || !result.data.session)) {
          // A bad link must never turn an existing account session into a reset session.
          window.history.replaceState(window.history.state, "", window.location.pathname);
          setLinkError(true);
        } else if (result.data.session) {
          const userId = result.data.session.user.id;
          if (intent.action) savePasswordAction(window.sessionStorage, userId, intent.action);
          setAction(intent.action ?? pendingPasswordAction(window.sessionStorage, userId));
        }
        if (result.error && !intent.hasCallback)
          setAuthError("Your session could not be restored. Please sign in again.");
      } catch {
        if (active) setAuthError("Unable to restore your session. Please sign in again.");
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
      nextClient.auth.stopAutoRefresh();
    };
  }, [queryClient]);
  if (connection.mode !== "connected")
    return (
      <div className="connected-center">
        <h1>Connection setup needed</h1>
        <p>{connection.mode === "invalid" ? connection.error : "Connected mode is not enabled."}</p>
      </div>
    );
  if (!ready || !client)
    return (
      <div className="connected-center" role="status">
        Checking your session…
      </div>
    );
  if (linkError)
    return (
      <div className="connected-center">
        <section className="connected-card">
          <h1>This sign-in link could not be verified</h1>
          <p>
            The link may have expired or already been used. Request a new password-reset link, or
            ask your administrator for a new invitation.
          </p>
          <button
            onClick={async () => {
              const result = await client.auth.signOut({ scope: "local" });
              if (!result.error) setLinkError(false);
            }}
          >
            Back to sign in
          </button>
        </section>
      </div>
    );
  if (!session) return <SignIn client={client} initialError={authError} />;
  if (action)
    return (
      <PasswordSetup
        key={session.user.id}
        client={client}
        session={session}
        action={action}
        onComplete={() => {
          clearPasswordAction(window.sessionStorage);
          queryClient.clear();
          setAction(null);
        }}
      />
    );
  return (
    <MembershipGate key={session.user.id} client={client} session={session}>
      {children}
    </MembershipGate>
  );
}

function MembershipGate({
  client,
  session,
  children,
}: {
  client: SupabaseClient;
  session: Session;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const memberships = useQuery({
    queryKey: ["membership", session.user.id],
    queryFn: async () => {
      const { data, error } = await client
        .from("shepherd_memberships")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("active", true);
      if (error) throw new Error("Membership unavailable");
      return membershipSchema.array().parse(data);
    },
    refetchInterval: 5000,
    retry: false,
  });
  const membership =
    memberships.data?.find((m) => m.organisation_id === selected) ?? memberships.data?.[0];
  const assurance = useQuery({
    queryKey: ["assurance", session.user.id, session.access_token],
    queryFn: async () => {
      const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  async function signOut() {
    queryClient.clear();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) setSignOutError("Sign-out failed. Please try again.");
  }
  let content: ReactNode;
  if (memberships.isPending || assurance.isPending)
    content = <p role="status">Checking workspace access…</p>;
  else if (memberships.isError || assurance.isError)
    content = (
      <div role="alert">
        <p>Could not verify your access. Check the connection and try again.</p>
        <button
          onClick={() => {
            void memberships.refetch();
            void assurance.refetch();
          }}
        >
          Retry
        </button>
      </div>
    );
  else if (!membership || !session.user.email_confirmed_at)
    content = (
      <p role="alert">
        This account has no active Shepherd workspace. Ask your administrator to confirm your email
        and membership.
      </p>
    );
  else if (
    assurance.data?.currentLevel !== "aal2" &&
    (membership.role === "admin" || assurance.data?.nextLevel === "aal2")
  )
    content = (
      <Mfa
        client={client}
        onVerified={() => {
          void queryClient.invalidateQueries({ queryKey: ["assurance"] });
        }}
      />
    );
  else
    content = (
      <WorkspaceContext.Provider key={membership.organisation_id} value={{ client, membership }}>
        {children}
      </WorkspaceContext.Provider>
    );
  return (
    <div className="connected-app">
      <header className="connected-header">
        <a href="/" className="connected-brand">
          Shepherd
        </a>
        <div>
          <span>{membership?.display_name ?? session.user.email}</span>
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>
      {signOutError && <p role="alert">{signOutError}</p>}
      {(memberships.data?.length ?? 0) > 1 && (
        <label className="connected-workspace">
          Workspace
          <select
            aria-label="Workspace"
            value={membership?.organisation_id}
            onChange={(e) => {
              queryClient.removeQueries({ queryKey: ["people"] });
              queryClient.removeQueries({ queryKey: ["person"] });
              setSelected(e.target.value);
            }}
          >
            {memberships.data?.map((m) => (
              <option key={m.organisation_id} value={m.organisation_id}>
                {m.display_name} · {m.organisation_id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      )}
      <main className="connected-main">{content}</main>
    </div>
  );
}
