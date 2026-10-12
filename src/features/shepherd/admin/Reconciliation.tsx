import { useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo, PageHeading, Status, attendanceIssues } from "../shared";

export function Reconciliation() {
  const { posts, savePost, finalised, setFinalised, record, notify, walkins, setWalkins } =
    useDemo();
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [guest, setGuest] = useState("");
  const conflicts = attendanceIssues(posts);
  const allResolved = conflicts.every((c) => resolution[c.id]);
  function finalise() {
    if (!allResolved || !reason.trim()) return;
    posts.forEach((p) =>
      savePost(
        {
          ...p,
          state: "Verified",
          entries: p.entries.map((e) =>
            resolution[e.personId]
              ? { ...e, attendance: resolution[e.personId] === "came" ? "came" : "absent" }
              : e,
          ),
        },
        reason,
      ),
    );
    setFinalised(true);
    record(`Service finalised; ${walkins.length} walk-ins recorded. ${reason}`);
    notify("Service finalised in demo. Attendance reconciled.");
  }
  return (
    <>
      <PageHeading
        title="Attendance reconciliation"
        description="Bring observations together before finalising Sunday attendance."
        action={
          <Status tone={finalised ? "success" : "warning"}>
            {finalised ? "Finalised" : `${conflicts.length} observations to review`}
          </Status>
        }
      />
      {conflicts.map((c) => (
        <section className="reconciliation-row" key={c.id}>
          <div>
            <h3>{c.name}</h3>
            {c.observations.map((o) => (
              <p key={o.author}>
                {o.author}:{" "}
                {o.attendance === "unknown"
                  ? "Not checked yet"
                  : o.attendance === "came"
                    ? "Came"
                    : "Absent"}
              </p>
            ))}
          </div>
          <label>
            Final attendance
            <select
              disabled={finalised}
              value={resolution[c.id] ?? ""}
              onChange={(e) => setResolution((r) => ({ ...r, [c.id]: e.target.value }))}
            >
              <option value="">Resolve observation…</option>
              <option value="came">Came — confirm check-in</option>
              <option value="absent">Absent — correct observation</option>
            </select>
          </label>
        </section>
      ))}
      <section className="detail-section">
        <h2>Walk-ins</h2>
        <div className="guest-input">
          <input
            aria-label="Walk-in name"
            placeholder="Add a fictional walk-in name"
            value={guest}
            onChange={(e) => setGuest(e.target.value)}
            disabled={finalised}
          />
          <Button
            variant="outline"
            disabled={!guest.trim() || finalised}
            onClick={() => {
              setWalkins((w) => [...w, guest.trim()]);
              setGuest("");
            }}
          >
            <Plus />
            Add walk-in
          </Button>
        </div>
        {walkins.map((w, i) => (
          <p key={i}>
            {w} <Status>Walk-in · not originally expected</Status>
          </p>
        ))}
      </section>
      <section className="detail-section">
        <label>
          Reconciliation reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={finalised}
            placeholder="Explain how the observations were resolved…"
          />
        </label>
        <p>
          Unresolved entries remain not checked. Walk-ins are separate from original Expected
          counts.
        </p>
        <Button disabled={!allResolved || !reason.trim() || finalised} onClick={finalise}>
          <CheckCircle2 />
          {finalised ? "Service finalised" : "Finalise demo service"}
        </Button>
      </section>
    </>
  );
}
