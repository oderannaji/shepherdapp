import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { connection } from "./runtime";
import { membershipSchema, WorkspaceContext } from "./context";

export function IdentityGate({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  useEffect(() => {
    if (connection.mode !== "connected") return;
    const next = createClient(connection.url, connection.key);
    setClient(next);
    return () => {
      next.auth.stopAutoRefresh();
    };
  }, []);
  if (connection.mode !== "connected")
    return (
      <div className="connected-center">
        <h1>Connection setup needed</h1>
        <p>{connection.mode === "invalid" ? connection.error : "Connected mode is not enabled."}</p>
      </div>
    );
  if (!client)
    return (
      <div className="connected-center" role="status">
        Opening Shepherd…
      </div>
    );
  return <SessionGate client={client}>{children}</SessionGate>;
}

function SessionGate({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    let active = true;
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      if (!next) queryClient.clear();
      setSession(next);
      setReady(true);
    });
    client.auth
      .getSession()
      .then(({ data: result, error }) => {
        if (!active) return;
        setSession(result.session);
        setReady(true);
        if (error) setAuthError("Your session could not be restored. Please sign in again.");
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setAuthError("Unable to restore your session.");
        }
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, queryClient]);
  if (!ready)
    return (
      <div className="connected-center" role="status">
        Checking your session…
      </div>
    );
  if (!session) return <SignIn client={client} initialError={authError} />;
  return (
    <MembershipGate key={session.user.id} client={client} session={session}>
      {children}
    </MembershipGate>
  );
}

function SignIn({ client, initialError }: { client: SupabaseClient; initialError: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) setError("Sign-in failed. Check your email and password, then try again.");
    } catch {
      setError("Could not connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="connected-center">
      <div className="connected-card">
        <p className="connected-brand">Shepherd</p>
        <h1>Welcome back</h1>
        <p>Sign in with your church account.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="connected-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="connected-muted">
          Need an account or a password reset? Contact your church administrator.
        </p>
      </div>
    </main>
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

function Mfa({ client, onVerified }: { client: SupabaseClient; onVerified: () => void }) {
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const listed = await client.auth.mfa.listFactors();
      if (listed.error) throw listed.error;
      const existing = listed.data.totp.find((f) => f.status === "verified");
      if (existing) setFactor(existing.id);
      else {
        // Remove abandoned, unverified TOTP enrolments so setup can be retried.
        for (const pending of listed.data.all.filter(
          (f) => f.factor_type === "totp" && f.status === "unverified",
        ))
          await client.auth.mfa.unenroll({ factorId: pending.id });
        const enrolled = await client.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Shepherd authenticator",
        });
        if (enrolled.error) throw enrolled.error;
        setFactor(enrolled.data.id);
        setQr(enrolled.data.totp.qr_code);
      }
    } catch {
      setError(
        "Could not start verification. Check that authenticator MFA is enabled for this project.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: problem } = await client.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (problem)
        setError("That code could not be verified. Enter the latest code and try again.");
      else onVerified();
    } catch {
      setError("Verification failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="connected-card">
      <h1>Verify your account</h1>
      <p>Use your authenticator app to continue. Administrators must use two-step verification.</p>
      {!factor ? (
        <button disabled={busy} onClick={() => void prepare()}>
          Set up or verify authenticator
        </button>
      ) : (
        <form onSubmit={verify}>
          {qr && (
            <>
              <p>Scan this code in your authenticator app.</p>
              <img className="connected-qr" src={qr} alt="Authenticator setup QR code" />
            </>
          )}
          <label>
            Six-digit code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button disabled={busy}>Verify</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
