import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export function Mfa({ client, onVerified }: { client: SupabaseClient; onVerified: () => void }) {
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
