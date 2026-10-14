import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useWorkspace, useWorkspaceData, useWorkspaceMutation } from "../identity";
import { ConnectedFollowUp } from "../follow-up";
import { readServices } from "../shared";
import { ConnectedUsers } from "./ConnectedUsers";
import {
  ConnectedAssignments,
  ConnectedImport,
  ConnectedDuplicates,
  ConnectedAttendance,
} from "./ConnectedOperations";
const sections = [
  ["overview", "Overview"],
  ["people", "People"],
  ["edit", "Edit person"],
  ["users", "Accounts"],
  ["import", "Import"],
  ["duplicates", "Duplicates"],
  ["assignments", "Assignments"],
  ["recovery", "Weekly callers"],
  ["sunday", "Attendance"],
  ["reconciliation", "Reconciliation"],
  ["audit", "Audit history"],
];
export function ConnectedAdmin({ section }: { section: string }) {
  const { membership } = useWorkspace();
  if (membership.role !== "admin") return <p role="alert">Administrator access required.</p>;
  return (
    <>
      <nav aria-label="Administration" className="connected-tabs">
        {sections.map(([id, label]) => (
          <Link
            key={id}
            to="/admin/$section"
            params={{ section: id! }}
            activeProps={{ className: "active" }}
          >
            {label}
          </Link>
        ))}
      </nav>
      {section === "overview" ? (
        <Overview />
      ) : section === "people" ? (
        <ConnectedFollowUp />
      ) : section === "users" ? (
        <ConnectedUsers />
      ) : section === "assignments" ? (
        <ConnectedAssignments />
      ) : section === "edit" ? (
        <ConnectedAssignments edit />
      ) : section === "recovery" ? (
        <ConnectedAssignments weekly />
      ) : section === "import" ? (
        <ConnectedImport />
      ) : section === "duplicates" ? (
        <ConnectedDuplicates />
      ) : section === "sunday" ? (
        <ConnectedAttendance />
      ) : section === "reconciliation" ? (
        <ConnectedAttendance reconcile />
      ) : section === "audit" ? (
        <Audit />
      ) : (
        <p>This administration page does not exist.</p>
      )}
    </>
  );
}
function Overview() {
  const services = useWorkspaceData(["services"], (c, m) => readServices(c, m.organisation_id));
  const stats = useWorkspaceData(["admin-overview"], async (c, m) => {
    const p = await c
      .from("shepherd_people")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", m.organisation_id);
    const u = await c.rpc("shepherd_members", { p_organisation_id: m.organisation_id });
    if (p.error || u.error) throw new Error("Could not load overview");
    return { people: p.count ?? 0, accounts: u.data.length };
  });
  const action = useWorkspaceMutation();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("Sunday service");
  return (
    <section>
      <h1>Administrator dashboard</h1>
      <p>Manage your team, church records and Sunday services.</p>
      {stats.data && (
        <div className="connected-stats">
          <p>
            <strong>{stats.data.people}</strong> people
          </p>
          <p>
            <strong>{stats.data.accounts}</strong> accounts
          </p>
          <p>
            <strong>{services.data?.length ?? 0}</strong> services
          </p>
        </div>
      )}
      {(stats.isError || services.isError) && <p role="alert">Could not load the overview.</p>}
      <form
        className="connected-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await action.adminAction("create_service", { date, title });
          if (r) setDate("");
        }}
      >
        <h2>Create a service</h2>
        <label>
          Service date
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Service name
          <input
            required
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button disabled={action.busy}>Create service</button>
        {action.error && <p role="alert">{action.error}</p>}
        {action.message && <p role="status">{action.message}</p>}
      </form>
      <h2>Services</h2>
      {services.data?.map((s) => (
        <p key={s.id}>
          {s.service_date} · {s.title}
        </p>
      ))}
      {services.data?.length === 0 && (
        <p>Create the first service to start Expected lists and attendance.</p>
      )}
    </section>
  );
}
function Audit() {
  const [page, setPage] = useState(0);
  const audit = useWorkspaceData(["audit", page], async (c, m) => {
    const r = await c
      .from("shepherd_audit_events")
      .select("*", { count: "exact" })
      .eq("organisation_id", m.organisation_id)
      .order("id", { ascending: false })
      .range(page * 50, page * 50 + 49);
    const members = await c.rpc("shepherd_members", { p_organisation_id: m.organisation_id });
    if (r.error || members.error) throw new Error("Could not read audit history");
    return {
      rows: r.data as {
        id: number;
        actor_id: string;
        action: string;
        created_at: string;
        details: Record<string, unknown>;
      }[],
      count: r.count ?? 0,
      members: members.data as { user_id: string; display_name: string }[],
    };
  });
  return (
    <section>
      <h1>Audit history</h1>
      <p>
        Attributable changes recorded by the database. These records cannot be edited from the app.
      </p>
      {audit.isPending ? (
        <p role="status">Loading audit history…</p>
      ) : audit.isError ? (
        <p role="alert">Could not load audit history.</p>
      ) : (
        <>
          <div>
            {audit.data.rows.map((r) => (
              <article key={r.id} className="connected-note">
                <strong>{r.action.replaceAll("_", " ")}</strong>
                <p>
                  {audit.data.members.find((m) => m.user_id === r.actor_id)?.display_name ??
                    "Former member"}{" "}
                  · {new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}
                </p>
                {typeof r.details["reason"] === "string" && <p>Reason: {r.details["reason"]}</p>}
              </article>
            ))}
          </div>
          <div className="connected-actions">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button
              disabled={(page + 1) * 50 >= audit.data.count}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
