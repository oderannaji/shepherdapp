import { useState } from "react";
import { HeartHandshake, Phone, MessageCircle, ArrowLeft, Save, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  useDemo,
  Avatar,
  AttendanceStrip,
  Empty,
  Status,
  absenceLevel,
  outcomes,
  streak,
  type Outcome,
} from "../shared";

export function ContactDetail({ id }: { id: string }) {
  const { people, updatePerson, notify, failSave } = useDemo();
  const person = people.find((p) => p.id === id);
  const [outcome, setOutcome] = useState<Outcome>(person?.outcome ?? "Reached");
  const [callback, setCallback] = useState(person?.callback ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  if (!person)
    return <Empty title="Person not found" text="This demo record may have been merged." />;
  const dirty =
    outcome !== person.outcome || callback !== person.callback || note.trim().length > 0;
  const level = absenceLevel(person);
  function save() {
    if (!person) return;
    if (failSave) {
      setError("Your changes could not be saved. They are still here — try again.");
      return;
    }
    updatePerson(id, {
      outcome,
      callback,
      notes: note.trim()
        ? [{ date: "12 Oct 2026 · Just now", text: note.trim() }, ...person.notes]
        : person.notes,
    });
    setNote("");
    setError("");
    notify("Follow-up saved. Thank you for reaching out.");
  }
  return (
    <>
      <Button asChild variant="link" className="back-link">
        <Link to="/">
          <ArrowLeft />
          Back to my people
        </Link>
      </Button>
      <div className="contact-heading">
        <Avatar name={person.name} />
        <div>
          <h1>{person.name}</h1>
          <p>
            Assigned to {person.owner} <Status>Permanent owner</Status>
          </p>
        </div>
      </div>
      <div className="contact-layout">
        <div>
          <section className="detail-section">
            <h2>Stay in touch</h2>
            <p className="text-muted-foreground">{person.phone || "No phone number available"}</p>
            <div className="contact-actions">
              <Button
                disabled={!person.phone || outcome === "Do not contact"}
                onClick={() => notify("Demo call preview only. No real call was placed.")}
              >
                <Phone />
                Call
              </Button>
              <Button
                variant="outline"
                disabled={!person.phone || outcome === "Do not contact"}
                onClick={() => notify("Demo WhatsApp preview only. No message was sent.")}
              >
                <MessageCircle />
                WhatsApp
              </Button>
            </div>
            {!person.phone && (
              <p className="inline-info">
                <AlertCircle size={15} />
                Contact actions are unavailable until a number is added.
              </p>
            )}
            {outcome === "Do not contact" && (
              <p className="inline-info">Do not contact — calling and messaging are disabled.</p>
            )}
          </section>
          <section className="detail-section">
            <div className="section-title">
              <h2>Sunday attendance</h2>
              <Status tone={person.attendance.at(-1) ? "success" : "warning"}>
                {streak(person)}
              </Status>
            </div>
            <AttendanceStrip attendance={person.attendance} dates />
            {level > 0 && (
              <div className="recovery-detail">
                <RotateIcon />
                <div>
                  <strong>Also on this week’s Recovery</strong>
                  <p>
                    {level} consecutive {level === 1 ? "absence" : "absences"} · Weekly caller:{" "}
                    {person.recoveryCaller ?? person.owner}
                  </p>
                  {person.recoveryCaller && person.recoveryCaller !== person.owner && (
                    <p>Permanent owner remains {person.owner}.</p>
                  )}
                </div>
              </div>
            )}
          </section>
          <section className="detail-section">
            <h2>Conversation notes</h2>
            <div className="notes-timeline">
              {person.notes.map((n, i) => (
                <article key={i}>
                  <small>
                    {n.date} · {person.owner}
                  </small>
                  <p>{n.text}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
        <div>
          <section className="followup-form">
            <h2>Log a follow-up</h2>
            <label>
              Contact outcome
              <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
                {outcomes.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Conversation note
              <textarea
                rows={5}
                placeholder="What did you talk about?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label>
              Next follow-up
              <input type="date" value={callback} onChange={(e) => setCallback(e.target.value)} />
            </label>
            {dirty && <p className="unsaved">● Unsaved changes</p>}
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            <Button className="w-full" disabled={!dirty || !callback} onClick={save}>
              <Save />
              Save follow-up
            </Button>
          </section>
          <p className="demo-footnote">Demo mode · No real calls or messages are sent.</p>
        </div>
      </div>
    </>
  );
}
function RotateIcon() {
  return <HeartHandshake size={22} />;
}
