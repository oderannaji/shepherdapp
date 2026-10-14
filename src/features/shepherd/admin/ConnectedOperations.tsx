import { useState, type FormEvent } from "react";
import { useWorkspaceData, useWorkspaceMutation } from "../identity";
import {
  readPeople,
  readServices,
  type Contact,
  type WorkspaceMember,
  type AttendanceRow,
} from "../shared";
import { parseCsv, peopleImport } from "./csv";
function useAdminPeople() {
  return useWorkspaceData(["admin-people"], async (c, m) => {
    const people = await readPeople(c, m.organisation_id);
    const members = await c.rpc("shepherd_members", { p_organisation_id: m.organisation_id });
    if (members.error) throw members.error;
    return { people, members: members.data as WorkspaceMember[] };
  });
}
export function ConnectedAssignments({
  weekly = false,
  edit = false,
}: {
  weekly?: boolean;
  edit?: boolean;
}) {
  const data = useAdminPeople();
  const services = useWorkspaceData(["services"], (c, m) => readServices(c, m.organisation_id));
  const [selected, setSelected] = useState("");
  const person = data.data?.people.find((p) => p.id === selected) ?? data.data?.people[0];
  return (
    <section>
      <h1>{edit ? "Edit person" : weekly ? "Weekly Recovery callers" : "Permanent assignments"}</h1>
      <p>
        {weekly
          ? "A weekly caller can access this person from six days before to six days after the selected service. Their permanent owner stays the same."
          : "Changes are saved with your identity and a reason."}
      </p>
      {data.isError || services.isError ? (
        <p role="alert">Could not load people and owners.</p>
      ) : data.isPending ? (
        <p role="status">Loading…</p>
      ) : !person ? (
        <p>Add people before managing assignments.</p>
      ) : (
        <>
          <label>
            Person
            <select
              aria-label="Person"
              value={person.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {data.data.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <AssignmentForm
            key={`${person.id}-${weekly}-${edit}`}
            person={person}
            members={data.data.members}
            services={services.data ?? []}
            weekly={weekly}
            edit={edit}
          />
        </>
      )}
    </section>
  );
}
function AssignmentForm({
  person,
  members,
  services,
  weekly,
  edit,
}: {
  person: Contact;
  members: WorkspaceMember[];
  services: { id: string; service_date: string; title: string }[];
  weekly: boolean;
  edit: boolean;
}) {
  const action = useWorkspaceMutation();
  const [base, setBase] = useState(person);
  const [owner, setOwner] = useState(person.owner_user_id);
  const [service, setService] = useState("");
  const [name, setName] = useState(person.full_name);
  const [phone, setPhone] = useState(person.phone_e164 ?? "");
  const [reason, setReason] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await action.adminAction(
      edit ? "update_person" : weekly ? "set_recovery_caller" : "assign_person",
      {
        person_id: base.id,
        revision: base.revision,
        reason,
        ...(edit
          ? { full_name: name, phone_e164: phone }
          : weekly
            ? { caller_id: owner, service_id: service || services[0]?.id }
            : { owner_id: owner }),
      },
    );
    if (r) {
      setBase({ ...base, revision: base.revision + 1 });
      setReason("");
    }
  }
  return (
    <form className="connected-card" onSubmit={submit}>
      {base.revision !== person.revision && (
        <p role="alert">
          This person changed.{" "}
          <button
            type="button"
            onClick={() => {
              setBase(person);
              setOwner(person.owner_user_id);
              setName(person.full_name);
              setPhone(person.phone_e164 ?? "");
            }}
          >
            Reload details
          </button>
        </p>
      )}
      {edit ? (
        <>
          <label>
            Full name
            <input
              value={name}
              required
              maxLength={140}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Phone number
            <input
              type="tel"
              pattern="\+[1-9][0-9]{7,14}"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        </>
      ) : (
        <label>
          {weekly ? "Weekly caller" : "Permanent owner"}
          <select
            aria-label={weekly ? "Weekly caller" : "Permanent owner"}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            {members
              .filter((m) => m.active)
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name}
                </option>
              ))}
          </select>
        </label>
      )}
      {weekly && (
        <label>
          Service
          <select
            value={service || services[0]?.id || ""}
            onChange={(e) => setService(e.target.value)}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.service_date} · {s.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Reason
        <input
          required
          minLength={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button className="connected-primary" disabled={action.busy || (weekly && !services.length)}>
        Save changes
      </button>
      {action.error && <p role="alert">{action.error}</p>}
      {action.message && <p role="status">{action.message}</p>}
    </form>
  );
}
export function ConnectedImport() {
  const data = useAdminPeople();
  const action = useWorkspaceMutation();
  const [source, setSource] = useState("");
  const [owner, setOwner] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof peopleImport> | null>(null);
  const [error, setError] = useState("");
  function review() {
    try {
      const rows = peopleImport(
        parseCsv(source),
        owner || data.data?.members.find((m) => m.active)?.user_id || "",
      );
      if (
        rows.some(
          (r) => r.phone_e164 && data.data?.people.some((p) => p.phone_e164 === r.phone_e164),
        )
      )
        throw new Error(
          "A phone number already exists. Remove that row or review it in Duplicates.",
        );
      setPreview(rows);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setPreview(null);
    }
  }
  return (
    <section>
      <h1>Import people</h1>
      <p>
        Use a CSV with <code>name,phone</code> column headings. Phone is optional; quoted fields and
        international phone numbers are supported. Review up to 500 rows per import.
      </p>
      <label>
        Assign imported people to
        <select
          value={owner || data.data?.members.find((m) => m.active)?.user_id || ""}
          onChange={(e) => {
            setOwner(e.target.value);
            setPreview(null);
          }}
        >
          {data.data?.members
            .filter((m) => m.active)
            .map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
              </option>
            ))}
        </select>
      </label>
      <label>
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 2_000_000) {
                setError("Choose a CSV smaller than 2 MB.");
                return;
              }
              setSource(await file.text());
              setPreview(null);
            }
          }}
        />
      </label>
      <label>
        CSV content
        <textarea
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPreview(null);
          }}
          placeholder={"name,phone\nExample Person,+447700900123"}
        />
      </label>
      <button onClick={review} disabled={!data.data || action.busy}>
        Validate and preview
      </button>
      {data.isError && <p role="alert">Could not load existing people for duplicate checks.</p>}
      {error && <p role="alert">{error}</p>}
      {preview && (
        <section className="connected-card connected-wide">
          <h2>Review {preview.length} people</h2>
          <ol>
            {preview.map((p, i) => (
              <li key={i}>
                {p.full_name} · {p.phone_e164 || "No phone"}
              </li>
            ))}
          </ol>
          <p>This creates new profiles, not login accounts.</p>
          <button
            className="connected-primary"
            disabled={action.busy}
            onClick={async () => {
              const r = await action.adminAction("import_people", { rows: preview });
              if (r) {
                setPreview(null);
                setSource("");
              }
            }}
          >
            Confirm import
          </button>
        </section>
      )}
      {action.error && <p role="alert">{action.error}</p>}
      {action.message && <p role="status">{action.message}</p>}
    </section>
  );
}
export function ConnectedDuplicates() {
  const data = useAdminPeople();
  const action = useWorkspaceMutation();
  const [keep, setKeep] = useState("");
  const [remove, setRemove] = useState("");
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<{ survivor: Contact; duplicate: Contact } | null>(null);
  const survivor = data.data?.people.find((p) => p.id === keep);
  const duplicate = data.data?.people.find((p) => p.id === remove);
  const suggestions = data.data?.people.filter(
    (p, i, all) => p.phone_e164 && all.some((x, j) => i !== j && x.phone_e164 === p.phone_e164),
  );
  return (
    <section>
      <h1>Review duplicates</h1>
      <p>
        Merge only after verifying these are the same person. The surviving profile keeps its owner
        and phone. Notes and attendance are retained; conflicting attendance needs reconciliation.
        Do-not-contact preferences are preserved.
      </p>
      {data.isError && <p role="alert">Could not load people.</p>}
      {!!suggestions?.length && (
        <p>Matching phone numbers: {suggestions.map((p) => p.full_name).join(", ")}</p>
      )}
      <form
        className="connected-card"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!survivor || !duplicate) return;
          if (!review) {
            setReview({ survivor, duplicate });
            return;
          }
          const r = await action.adminAction("merge_people", {
            person_id: review.survivor.id,
            revision: review.survivor.revision,
            duplicate_id: review.duplicate.id,
            duplicate_revision: review.duplicate.revision,
            reason,
          });
          if (r) {
            setKeep("");
            setRemove("");
            setReview(null);
            setReason("");
          }
        }}
      >
        <label>
          Keep this profile
          <select
            required
            value={keep}
            onChange={(e) => {
              setKeep(e.target.value);
              setReview(null);
            }}
          >
            <option value="">Select person</option>
            {data.data?.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} · {p.phone_e164 || "No phone"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Merge this duplicate into it
          <select
            required
            value={remove}
            onChange={(e) => {
              setRemove(e.target.value);
              setReview(null);
            }}
          >
            <option value="">Select duplicate</option>
            {data.data?.people
              .filter((p) => p.id !== keep)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} · {p.phone_e164 || "No phone"}
                </option>
              ))}
          </select>
        </label>
        <label>
          Reason
          <input
            required
            minLength={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {review && (
          <p>
            Confirm: combine {review.duplicate.full_name} into {review.survivor.full_name}. The
            duplicate profile will be retired.
          </p>
        )}
        <button disabled={action.busy}>{review ? "Confirm merge" : "Review merge"}</button>
      </form>
      {action.error && <p role="alert">{action.error}</p>}
      {action.message && <p role="status">{action.message}</p>}
    </section>
  );
}
export function ConnectedAttendance({ reconcile = false }: { reconcile?: boolean }) {
  const services = useWorkspaceData(["services"], (c, m) => readServices(c, m.organisation_id));
  const [service, setService] = useState("");
  const selected = service || services.data?.[0]?.id;
  const rows = useWorkspaceData(
    ["attendance", selected],
    async (c, m) => {
      const r = await c.rpc("shepherd_attendance", {
        p_organisation_id: m.organisation_id,
        p_service_id: selected,
      });
      if (r.error) throw r.error;
      return r.data as AttendanceRow[];
    },
    !!selected,
  );
  const [epoch, setEpoch] = useState(0);
  return (
    <section>
      <h1>{reconcile ? "Reconcile attendance" : "Sunday attendance"}</h1>
      <p>
        {reconcile
          ? "Review conflicting reports and record a decision with a reason. New reports reopen the conflict for review."
          : "Record the register, including walk-ins. Unchecked people remain unknown. Add a new walk-in under People first."}
      </p>
      <label>
        Service
        <select
          value={selected || ""}
          onChange={(e) => {
            setService(e.target.value);
            setEpoch((v) => v + 1);
          }}
        >
          {services.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.service_date} · {s.title}
            </option>
          ))}
        </select>
      </label>
      {services.isError || rows.isError ? (
        <p role="alert">Could not load attendance.</p>
      ) : !selected ? (
        <p>Create a service in Overview first.</p>
      ) : rows.isPending ? (
        <p role="status">Loading register…</p>
      ) : (
        <AttendanceForm
          key={`${selected}-${epoch}-${reconcile}`}
          rows={rows.data}
          service={selected}
          reconcile={reconcile}
          onSaved={() => setEpoch((v) => v + 1)}
        />
      )}
    </section>
  );
}
function AttendanceForm({
  rows,
  service,
  reconcile,
  onSaved,
}: {
  rows: AttendanceRow[];
  service: string;
  reconcile: boolean;
  onSaved: () => void;
}) {
  const action = useWorkspaceMutation();
  const [baseRows] = useState(rows);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState("");
  function loadCsv() {
    try {
      const items = parseCsv(csv);
      const next: Record<string, string> = {};
      for (const item of items) {
        const id = item["person_id"] ?? "";
        const status = item["status"] ?? "";
        if (
          !rows.some((r) => r.person_id === id) ||
          !["came", "absent", "unknown"].includes(status) ||
          next[id]
        )
          throw new Error("Use each existing person_id once, with status came, absent or unknown.");
        next[id] = status;
      }
      setChanges(next);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await action.adminAction(reconcile ? "resolve_attendance" : "record_attendance", {
          service_id: service,
          reason,
          rows: Object.entries(changes).map(([person_id, status]) => ({
            person_id,
            status,
            version: baseRows.find((r) => r.person_id === person_id)?.version,
          })),
        });
        if (r) onSaved();
      }}
    >
      {!reconcile && (
        <details>
          <summary>Import an attendance CSV</summary>
          <p>
            Columns: person_id,status. Copy IDs from the register below. Imported rows are reviewed
            before saving.
          </p>
          <label>
            Attendance CSV
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} />
          </label>
          <button type="button" onClick={loadCsv}>
            Validate and preview attendance
          </button>
        </details>
      )}
      <div className="connected-grid">
        {rows
          .filter((r) => !reconcile || r.conflict)
          .map((r) => (
            <article className="connected-card" key={r.person_id}>
              <strong>{r.full_name}</strong>
              {!reconcile && <small className="connected-id">{r.person_id}</small>}
              <p>
                {r.conflict
                  ? "Conflicting reports"
                  : r.status === "unknown"
                    ? "Not confirmed"
                    : r.status}
              </p>
              {reconcile &&
                r.observations.map((o, i) => (
                  <p key={i}>
                    {o.source}: {o.status}
                  </p>
                ))}
              <label>
                {reconcile ? "Decision" : "Register entry"}
                <select
                  value={changes[r.person_id] ?? ""}
                  onChange={(e) => setChanges({ ...changes, [r.person_id]: e.target.value })}
                >
                  <option value="" disabled>
                    Keep unchanged
                  </option>
                  <option value="came">Came</option>
                  <option value="absent">Absent</option>
                  <option value="unknown">Not checked</option>
                </select>
              </label>
            </article>
          ))}
      </div>
      {reconcile && !rows.some((r) => r.conflict) && <p>No conflicts to resolve.</p>}
      <label>
        Reason / source
        <input
          required
          minLength={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Checked the welcome desk register"
        />
      </label>
      <p>{Object.keys(changes).length} changes ready to save.</p>
      <button className="connected-primary" disabled={action.busy || !Object.keys(changes).length}>
        Confirm attendance changes
      </button>
      {error && <p role="alert">{error}</p>}
      {action.error && <p role="alert">{action.error}</p>}
      {action.message && <p role="status">{action.message}</p>}
    </form>
  );
}
