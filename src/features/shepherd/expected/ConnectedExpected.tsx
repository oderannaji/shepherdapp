import { useState, type FormEvent } from "react";
import { useWorkspace, useWorkspaceData, useWorkspaceMutation } from "../identity";
import {
  readPeople,
  readServices,
  type ExpectedList,
  type ExpectedEntry,
  type Contact,
} from "../shared";
type Totals = {
  expected: number;
  came: number;
  conflicts: number;
  posts: { id: string; display_name: string; state: string; expected: number; came: number }[];
};
export function ConnectedExpected() {
  const { membership } = useWorkspace();
  const [chosen, setChosen] = useState("");
  const [listId, setListId] = useState("");
  const [epoch, setEpoch] = useState(0);
  const services = useWorkspaceData(["services"], (c, m) => readServices(c, m.organisation_id));
  const service = services.data?.find((s) => s.id === chosen) ?? services.data?.[0];
  const people = useWorkspaceData(["expected-people"], (c, m) => readPeople(c, m.organisation_id));
  const lists = useWorkspaceData(
    ["expected", service?.id],
    async (c, m) => {
      const r = await c
        .from("shepherd_expected_lists")
        .select("*,shepherd_expected_entries(person_id,attendance,late)")
        .eq("organisation_id", m.organisation_id)
        .eq("service_id", service!.id);
      if (r.error) throw r.error;
      return r.data as ExpectedList[];
    },
    !!service,
  );
  const totals = useWorkspaceData(
    ["team", service?.id],
    async (c, m) => {
      const r = await c.rpc("shepherd_team_totals", {
        p_organisation_id: m.organisation_id,
        p_service_id: service!.id,
      });
      if (r.error) throw r.error;
      return r.data as Totals;
    },
    !!service,
  );
  const selected =
    lists.data?.find((l) => l.id === listId) ??
    lists.data?.find((l) => l.author_id === membership.user_id);
  return (
    <section>
      <h1>Expected this Sunday</h1>
      <p>
        Publish your invitations, then record who came. A person is counted once in the church
        total, even if several people invited them.
      </p>
      {services.isPending ? (
        <p role="status">Loading services…</p>
      ) : services.isError ? (
        <p role="alert">Could not load services.</p>
      ) : !service ? (
        <p>Your administrator needs to create a service first.</p>
      ) : (
        <>
          <label>
            Service
            <select
              value={service.id}
              onChange={(e) => {
                setChosen(e.target.value);
                setListId("");
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
          {totals.data && (
            <>
              <div className="connected-stats">
                <p>
                  <strong>{totals.data.expected}</strong> people expected
                </p>
                <p>
                  <strong>{totals.data.came}</strong> confirmed arrivals
                </p>
                <p>
                  <strong>{totals.data.conflicts}</strong> attendance conflicts
                </p>
              </div>
              <h2>Team updates</h2>
              <div className="connected-grid">
                {totals.data.posts.map((p) => (
                  <article key={p.id} className="connected-card">
                    <strong>{p.display_name}</strong>
                    <p>
                      {p.expected} invited · {p.came} reported arrivals
                    </p>
                    <p>{p.state === "results" ? "Results posted" : "List published"}</p>
                  </article>
                ))}
              </div>
              <p className="connected-muted">
                Caller totals may overlap. Church totals use reconciled attendance; unresolved
                conflicts are excluded from confirmed arrivals.
              </p>
            </>
          )}
          {lists.isError || people.isError || totals.isError ? (
            <p role="alert">
              Could not load Expected.{" "}
              <button
                onClick={() => {
                  void lists.refetch();
                  void people.refetch();
                  void totals.refetch();
                }}
              >
                Retry
              </button>
            </p>
          ) : lists.isPending || people.isPending ? (
            <p role="status">Loading your list…</p>
          ) : (
            <>
              {membership.role === "admin" && (
                <label>
                  List to review
                  <select
                    value={selected?.id ?? ""}
                    onChange={(e) => {
                      setListId(e.target.value);
                      setEpoch((v) => v + 1);
                    }}
                  >
                    <option value="">My list</option>
                    {lists.data.map((l) => (
                      <option key={l.id} value={l.id}>
                        {totals.data?.posts.find((p) => p.id === l.id)?.display_name ??
                          "Team member"}{" "}
                        · {l.state}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <ExpectedForm
                key={`${service.id}-${selected?.id ?? "new"}-${epoch}`}
                list={selected}
                people={people.data}
                serviceId={service.id}
                serviceDate={service.service_date}
                onSaved={() => setEpoch((v) => v + 1)}
              />
              <GuestForm />
            </>
          )}
        </>
      )}
    </section>
  );
}
function ExpectedForm({
  list,
  people,
  serviceId,
  serviceDate,
  onSaved,
}: {
  list: ExpectedList | undefined;
  people: Contact[];
  serviceId: string;
  serviceDate: string;
  onSaved: () => void;
}) {
  const { client, membership } = useWorkspace();
  const action = useWorkspaceMutation();
  const [base] = useState(list);
  const [id] = useState(() => list?.id ?? crypto.randomUUID());
  const [entries, setEntries] = useState<ExpectedEntry[]>(list?.shepherd_expected_entries ?? []);
  const [note, setNote] = useState(list?.note ?? "");
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(false);
  const locked = membership.role !== "admin" && base?.state === "results";
  const changed = base && list && base.revision !== list.revision;
  const correction = base && (base.state === "results" || base.author_id !== membership.user_id);
  const date = useWorkspaceData(["today"], async (c) => {
    const r = await c.rpc("shepherd_today");
    if (r.error) throw r.error;
    return r.data as string;
  });
  async function save(results: boolean) {
    const payload = {
      p_organisation_id: membership.organisation_id,
      p_service_id: serviceId,
      p_list_id: id,
      p_revision: base?.revision ?? 0,
      p_note: note,
      p_entries: entries,
      p_results: results,
      p_reason: reason,
    };
    const saved = await action.run(
      async () => {
        const r = await client.rpc("shepherd_save_expected", {
          ...payload,
          p_request_id: action.requestId(payload),
        });
        if (r.error) throw r.error;
        return r.data;
      },
      results ? "Results posted." : "Expected list published.",
    );
    if (saved) onSaved();
  }
  return (
    <section className="connected-card connected-wide">
      <h2>{base ? "Your published list" : "Create your Expected list"}</h2>
      {locked && <p>Results are posted and locked. Ask an administrator to correct them.</p>}
      {changed && (
        <p role="alert">
          This list changed in another session. Copy any draft notes, then{" "}
          <button onClick={onSaved}>Reload list</button>.
        </p>
      )}
      <fieldset disabled={action.busy || locked || !!changed}>
        <label>
          Invitation note
          <textarea
            maxLength={1000}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setReview(false);
            }}
          />
        </label>
        <div className="connected-checklist">
          {people.map((p) => {
            const entry = entries.find((e) => e.person_id === p.id);
            return (
              <div key={p.id} className="connected-entry">
                <label className="connected-checkbox">
                  <input
                    type="checkbox"
                    checked={!!entry}
                    disabled={
                      !!base &&
                      !!base.shepherd_expected_entries.find((e) => e.person_id === p.id && !e.late)
                    }
                    onChange={(e) => {
                      setReview(false);
                      setEntries(
                        e.target.checked
                          ? [...entries, { person_id: p.id, attendance: "unknown", late: !!base }]
                          : entries.filter((x) => x.person_id !== p.id),
                      );
                    }}
                  />
                  {p.full_name}
                  {entry?.late ? " · Late addition" : ""}
                </label>
                {entry && (
                  <label>
                    Attendance for {p.full_name}
                    <select
                      disabled={!date.data || serviceDate > date.data}
                      value={entry.attendance}
                      onChange={(e) => {
                        setReview(false);
                        setEntries(
                          entries.map((x) =>
                            x.person_id === p.id
                              ? { ...x, attendance: e.target.value as ExpectedEntry["attendance"] }
                              : x,
                          ),
                        );
                      }}
                    >
                      <option value="unknown">Not checked</option>
                      <option value="came">Came</option>
                      <option value="absent">Absent</option>
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
        {entries.some((e) => !people.some((p) => p.id === e.person_id)) && (
          <p role="alert">
            A listed person is no longer assigned to you. Ask an administrator to update this list.
          </p>
        )}
        {correction && (
          <label>
            Reason for correction
            <input
              required
              minLength={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        <p>
          {entries.filter((e) => !e.late).length} original invitees ·{" "}
          {entries.filter((e) => e.late).length} late additions ·{" "}
          {entries.filter((e) => e.attendance === "came").length} came ·{" "}
          {entries.filter((e) => e.attendance === "unknown").length} not checked
        </p>
        {!review ? (
          <button onClick={() => setReview(true)}>Review list</button>
        ) : (
          <>
            <p>Review the names and attendance above. Unchecked people remain unknown.</p>
            <div className="connected-actions">
              <button
                className="connected-primary"
                onClick={() => void save(false)}
                disabled={!!correction && reason.trim().length < 3}
              >
                {base ? "Save updates" : "Publish list"}
              </button>
              <button
                disabled={
                  !date.data ||
                  serviceDate > date.data ||
                  (!!correction && reason.trim().length < 3)
                }
                onClick={() => void save(true)}
              >
                Post results and lock list
              </button>
            </div>
          </>
        )}
      </fieldset>
      {action.error && <p role="alert">{action.error}</p>}
      {action.message && <p role="status">{action.message}</p>}
    </section>
  );
}
function GuestForm() {
  const { client, membership } = useWorkspace();
  const action = useWorkspaceMutation();
  const [name, setName] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = { p_organisation_id: membership.organisation_id, p_full_name: name };
    const r = await action.run(async () => {
      const r = await client.rpc("shepherd_add_guest", {
        ...payload,
        p_request_id: action.requestId(payload),
      });
      if (r.error) throw r.error;
      return r.data;
    }, "Guest added to your people. You can now select them in your Expected list.");
    if (r) setName("");
  }
  return (
    <form className="connected-card" onSubmit={submit}>
      <h2>Add a new guest</h2>
      <p>Check your people first to avoid duplicate profiles.</p>
      <label>
        Guest’s full name
        <input required maxLength={140} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button disabled={action.busy}>Create guest profile</button>
      {action.error && <p role="alert">{action.error}</p>}
      {action.message && <p role="status">{action.message}</p>}
    </form>
  );
}
