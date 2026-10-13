import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "../identity";
import { outcomes } from "../shared";
import {
  livePersonSchema,
  attemptSchema,
  contactLinks,
  saveError,
  type LivePerson,
} from "./live-data";

export function ConnectedContact({ id }: { id: string }) {
  const { client, membership } = useWorkspace();
  const person = useQuery({
    queryKey: ["person", membership.organisation_id, membership.user_id, id],
    queryFn: async () => {
      const r = await client
        .from("shepherd_people")
        .select("*")
        .eq("id", id)
        .eq("organisation_id", membership.organisation_id)
        .maybeSingle();
      if (r.error) throw new Error("Contact unavailable");
      return r.data ? livePersonSchema.parse(r.data) : null;
    },
    retry: false,
    refetchInterval: 10000,
  });
  return (
    <>
      <Link className="connected-back" to="/">
        ← My people
      </Link>
      {person.isPending ? (
        <p role="status">Loading contact…</p>
      ) : person.isError ? (
        <div role="alert">
          <p>
            Could not load this contact. Check your connection or ask your administrator about
            access.
          </p>
          <button onClick={() => void person.refetch()}>Retry</button>
        </div>
      ) : !person.data ? (
        <p role="alert">This contact is unavailable or is not assigned to you.</p>
      ) : (
        <ContactForm key={id} person={person.data} />
      )}
    </>
  );
}
function ContactForm({ person }: { person: LivePerson }) {
  const { client, membership } = useWorkspace();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState(person.outcome);
  const [callback, setCallback] = useState(person.callback_on ?? "");
  const [note, setNote] = useState("");
  const [revision, setRevision] = useState(person.revision);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const attempts = useQuery({
    queryKey: ["attempts", membership.organisation_id, membership.user_id, person.id, historyPage],
    queryFn: async () => {
      const r = await client
        .from("shepherd_contact_attempts")
        .select("id,actor_name,outcome,callback_on,note,created_at", { count: "exact" })
        .eq("person_id", person.id)
        .eq("organisation_id", membership.organisation_id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(historyPage * 20, historyPage * 20 + 19);
      if (r.error) throw new Error("Could not load history");
      return { rows: attemptSchema.array().parse(r.data), count: r.count ?? 0 };
    },
    retry: false,
    refetchInterval: 10000,
  });
  const links = contactLinks(person);
  const changedElsewhere = person.revision > revision;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || changedElsewhere) return;
    setBusy(true);
    setError("");
    setSaved(false);
    const payload = {
      p_person_id: person.id,
      p_revision: revision,
      p_outcome: outcome,
      p_callback_on: outcome === "Callback" ? callback : null,
      p_note: note.trim(),
    };
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    try {
      const r = await client.rpc("shepherd_record_follow_up", {
        ...payload,
        p_request_id: request.current.id,
      });
      if (r.error) {
        setError(saveError(r.error.code));
        return;
      }
      setRevision(revision + 1);
      setNote("");
      setSaved(true);
      request.current = null;
      setHistoryPage(0);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["person"] }),
        queryClient.invalidateQueries({ queryKey: ["people"] }),
        queryClient.invalidateQueries({ queryKey: ["attempts"] }),
      ]);
    } catch {
      setError(saveError());
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{person.full_name}</h1>
      <p>{person.phone_e164 || "No phone number recorded"}</p>
      {links ? (
        <div className="connected-actions">
          <a className="connected-action" href={links.call}>
            Call
          </a>
          <a
            className="connected-action"
            href={links.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open WhatsApp
          </a>
        </div>
      ) : (
        <p className="connected-muted">
          Contact links are unavailable for missing or incorrect numbers and “Do not contact”
          records.
        </p>
      )}
      <div className="connected-grid">
        <section className="connected-card">
          <h2>Record a follow-up</h2>
          {changedElsewhere && (
            <p role="alert">
              This contact changed in another session. Copy your draft, then reload to review the
              latest version.
            </p>
          )}
          <form onSubmit={submit}>
            <label>
              Outcome
              <select
                aria-label="Outcome"
                value={outcome}
                disabled={busy}
                onChange={(e) => {
                  setOutcome(e.target.value as LivePerson["outcome"]);
                  setSaved(false);
                }}
              >
                {outcomes.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            {outcome === "Callback" && (
              <label>
                Callback date
                <input
                  type="date"
                  required
                  disabled={busy}
                  value={callback}
                  onChange={(e) => {
                    setCallback(e.target.value);
                    setSaved(false);
                  }}
                />
              </label>
            )}
            <label>
              Conversation note
              <textarea
                maxLength={4000}
                disabled={busy}
                value={note}
                placeholder="Add a useful note for the next conversation…"
                onChange={(e) => {
                  setNote(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            {saved && <p role="status">Follow-up saved.</p>}
            <div className="connected-actions">
              <button
                className="connected-primary"
                disabled={busy || changedElsewhere || (outcome === "Callback" && !callback)}
              >
                {busy ? "Saving…" : "Save follow-up"}
              </button>
              {(error || changedElsewhere) && (
                <button type="button" onClick={() => window.location.reload()}>
                  Reload contact
                </button>
              )}
            </div>
          </form>
          <p className="connected-muted">
            Notes are saved with your name and the time. Opening a call or WhatsApp does not record
            a completed conversation.
          </p>
        </section>
        <section>
          <h2>Conversation history</h2>
          {attempts.isPending ? (
            <p>Loading history…</p>
          ) : attempts.isError ? (
            <p role="alert">Could not load conversation history.</p>
          ) : (
            <>
              {attempts.data.rows.length === 0 && <p>No follow-ups recorded yet.</p>}
              {attempts.data.rows.map((a) => (
                <article className="connected-note" key={a.id}>
                  <small>
                    {a.actor_name} ·{" "}
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Europe/London",
                    }).format(new Date(a.created_at))}{" "}
                    (London)
                  </small>
                  <strong>
                    {a.outcome}
                    {a.callback_on ? ` · Callback ${a.callback_on}` : ""}
                  </strong>
                  {a.note && <p>{a.note}</p>}
                </article>
              ))}
              {attempts.data.count > 20 && (
                <div className="connected-actions">
                  <button disabled={historyPage === 0} onClick={() => setHistoryPage((p) => p - 1)}>
                    Newer notes
                  </button>
                  <button
                    disabled={(historyPage + 1) * 20 >= attempts.data.count}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Older notes
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
