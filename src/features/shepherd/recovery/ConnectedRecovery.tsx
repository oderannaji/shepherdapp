import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useWorkspaceData } from "../identity";
import { readPeople, readServices, consecutiveAbsences, type AttendanceRow } from "../shared";
export function ConnectedRecovery() {
  const [minimum, setMinimum] = useState(1);
  const data = useWorkspaceData(["recovery"], async (c, m) => {
    const today = await c.rpc("shepherd_today");
    if (today.error) throw today.error;
    const services = (await readServices(c, m.organisation_id))
      .filter((s) => s.service_date < today.data)
      .slice(0, 4);
    const people = await readPeople(c, m.organisation_id);
    const records = await Promise.all(
      services.map(async (s) => {
        const r = await c.rpc("shepherd_attendance", {
          p_organisation_id: m.organisation_id,
          p_service_id: s.id,
        });
        if (r.error) throw r.error;
        return r.data as AttendanceRow[];
      }),
    );
    return {
      services,
      people: people.map((p) => {
        const statuses = records.map(
          (rows) => rows.find((r) => r.person_id === p.id)?.status ?? "unknown",
        );
        return { ...p, statuses, missed: consecutiveAbsences(statuses) };
      }),
    };
  });
  return (
    <section>
      <h1>Recovery</h1>
      <p>
        Reconnect with people who have confirmed absences. Unchecked or conflicting attendance is
        not counted as an absence.
      </p>
      <label>
        Priority
        <select value={minimum} onChange={(e) => setMinimum(Number(e.target.value))}>
          <option value={1}>Missed at least one service</option>
          <option value={2}>Missed at least two services</option>
          <option value={3}>Missed at least three services</option>
        </select>
      </label>
      {data.isPending ? (
        <p role="status">Loading Recovery…</p>
      ) : data.isError ? (
        <p role="alert">
          Could not load attendance. <button onClick={() => void data.refetch()}>Retry</button>
        </p>
      ) : (
        <>
          <p>Based on the last {data.data.services.length} recorded services before today.</p>
          <div className="connected-grid">
            {data.data.people
              .filter((p) => p.missed >= minimum)
              .sort((a, b) => b.missed - a.missed)
              .map((p) => (
                <Link
                  className="connected-person"
                  key={p.id}
                  to="/people/$id"
                  params={{ id: p.id }}
                >
                  <strong>{p.full_name}</strong>
                  <p>{p.missed} consecutive confirmed absences</p>
                  {data.data.services.map((s, i) => (
                    <p key={s.id}>
                      {s.service_date}:{" "}
                      {p.statuses[i] === "unknown" ? "Not confirmed" : p.statuses[i]}
                    </p>
                  ))}
                </Link>
              ))}
          </div>
          {!data.data.people.some((p) => p.missed >= minimum) && (
            <p>
              No people match this priority. Attendance must be recorded before Recovery can
              identify absences.
            </p>
          )}
        </>
      )}
    </section>
  );
}
