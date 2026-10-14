import { useState, type FormEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { Mfa } from "./Mfa";
import { passwordProblem, type PasswordAction } from "./password-action";

export function SignIn({ client, initialError }: { client: SupabaseClient; initialError: string }) {
  const adminEntry = useRouterState({ select: (s) => s.location.pathname.startsWith("/admin/") });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (reset) {
        const result = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/`,
        });
        if (result.error)
          setError("The reset request could not be completed. Please wait a moment and try again.");
        else setSent(true);
      } else {
        const result = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error)
          setError("Sign-in failed. Check your email and password, then try again.");
      }
    } catch {
      setError("Could not connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="connected-center">
      <section className="connected-card">
        <p className="connected-brand">Shepherd</p>
        <h1>
          {reset
            ? "Reset your password"
            : adminEntry
              ? "Administrator sign in"
              : "Volunteer sign in"}
        </h1>
        <p>
          {reset
            ? "Enter the email address you use for Shepherd."
            : adminEntry
              ? "Use your administrator account. Authenticator verification is required."
              : "Use the email your administrator invited."}
        </p>
        {sent ? (
          <p role="status">
            If this email belongs to an account, you will receive a link to choose a new password.
            Check your inbox and spam folder.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {!reset && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            {error && <p role="alert">{error}</p>}
            <button className="connected-primary" disabled={busy}>
              {busy ? "Please wait…" : reset ? "Send reset link" : "Sign in"}
            </button>
          </form>
        )}
        <div className="connected-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setReset(!reset);
              setSent(false);
              setError("");
              setPassword("");
            }}
          >
            {reset ? "Back to sign in" : "Forgot password?"}
          </button>
        </div>
        <p className="connected-muted">Need an account? Contact your church administrator.</p>
        {adminEntry ? (
          <Link to="/">Volunteer sign in</Link>
        ) : (
          <Link to="/admin/$section" params={{ section: "overview" }}>
            Administrator sign in
          </Link>
        )}
      </section>
    </main>
  );
}

export function PasswordSetup({
  client,
  session,
  action,
  onComplete,
}: {
  client: SupabaseClient;
  session: Session;
  action: PasswordAction;
  onComplete: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const assurance = useQuery({
    queryKey: ["password-assurance", session.user.id, session.access_token],
    queryFn: async () => {
      const r = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (r.error) throw r.error;
      return r.data;
    },
    retry: false,
  });
  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = passwordProblem(password, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: problem } = await client.auth.updateUser({ password });
      if (problem)
        setError(
          problem.code === "same_password"
            ? "Choose a different password from your current one."
            : "Could not save your password. Use a strong password, or request a new reset link if your session expired.",
        );
      else {
        setPassword("");
        setConfirmation("");
        setSaved(true);
      }
    } catch {
      setError("Could not confirm the update. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  if (assurance.isPending)
    return (
      <div className="connected-center" role="status">
        Checking account verification…
      </div>
    );
  if (assurance.isError)
    return (
      <div className="connected-center">
        <section className="connected-card">
          <p role="alert">Could not verify this account.</p>
          <button onClick={() => void assurance.refetch()}>Retry</button>
        </section>
      </div>
    );
  if (assurance.data?.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return (
      <div className="connected-app connected-center">
        <Mfa client={client} onVerified={() => void assurance.refetch()} />
      </div>
    );
  return (
    <main className="connected-center">
      <section className="connected-card">
        <p className="connected-brand">Shepherd</p>
        <h1>
          {saved
            ? "Your password is saved"
            : action === "invite"
              ? "Create your password"
              : "Choose a new password"}
        </h1>
        <p>{session.user.email}</p>
        {saved ? (
          <>
            <p role="status">You can now use this password to sign in.</p>
            <button className="connected-primary" onClick={onComplete}>
              Continue to Shepherd
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p>Use at least 12 characters. Your password can be a memorable phrase.</p>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                disabled={busy}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className="connected-primary" disabled={busy}>
              {busy ? "Saving password…" : "Save password"}
            </button>
          </form>
        )}
        <div className="connected-actions">
          <button
            disabled={busy}
            onClick={async () => {
              const r = await client.auth.signOut({ scope: "local" });
              if (r.error) setError("Sign-out failed. Please try again.");
            }}
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
