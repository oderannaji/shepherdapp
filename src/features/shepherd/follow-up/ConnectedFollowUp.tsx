import { useState, useRef, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace, membershipSchema } from "../identity";
import { livePersonSchema } from "./live-data";

export function ConnectedFollowUp() {
  const { client, membership } = useWorkspace();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const today = useQuery({
    queryKey: ["london-today"],
    queryFn: async () => {
      const result = await client.rpc("shepherd_today");
      if (result.error || typeof result.data !== "string") throw new Error();
      return result.data;
    },
    refetchInterval: 60000,
  });
  const people = useQuery({
    queryKey: [
      "people",
      membership.organisation_id,
      membership.user_id,
      search,
      filter,
      page,
      today.data,
    ],
    queryFn: async () => {
      let query = client
        .from("shepherd_people")
        .select("*", { count: "exact" })
        .eq("organisation_id", membership.organisation_id)
        .order("full_name")
        .order("id");
      // Escape LIKE wildcard characters. Search is always scoped by RLS and organisation.
      if (search.trim())
        query = query.ilike("full_name", `%${search.trim().replace(/[\\%_]/g, "\\$&")}%`);
      if (filter === "due") query = query.lte("callback_on", today.data!);
      if (filter === "upcoming") query = query.gt("callback_on", today.data!);
      const { data, error, count } = await query.range(page * 50, page * 50 + 49);
      if (error) throw new Error("Could not load contacts");
      return { rows: livePersonSchema.array().parse(data), count: count ?? 0 };
    },
    enabled: filter === "all" || !!today.data,
    retry: false,
    refetchInterval: 10000,
  });
  return (
    <>
      <p className="connected-muted">
        {membership.role === "admin" ? "Church workspace" : "Your church care workspace"}
      </p>
      <h1>{membership.role === "admin" ? "People" : "My people"}</h1>
      <p>Keep conversations, notes and next steps together.</p>
      <div className="connected-toolbar">
        <label>
          Search people
          <input
            type="search"
            value={search}
            maxLength={140}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Follow-up
          <select
            aria-label="Follow-up"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All people</option>
            <option value="due">Due today or overdue</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </label>
        {membership.role === "admin" && (
          <button onClick={() => setAdding((v) => !v)}>
            {adding ? "Close new person" : "Add person"}
          </button>
        )}
      </div>
      {adding && <CreatePerson onCreated={() => setAdding(false)} />}
      {today.isError && filter !== "all" ? (
        <p role="alert">Could not check today’s date. Please retry.</p>
      ) : people.isPending ? (
        <p role="status">Loading people…</p>
      ) : people.isError ? (
        <div role="alert">
          <p>Could not load people. Your connection or access may have changed.</p>
          <button onClick={() => void people.refetch()}>Retry</button>
        </div>
      ) : (
        <>
          <p>
            {people.data.count} {people.data.count === 1 ? "person" : "people"}
          </p>
          <div className="connected-grid">
            {people.data.rows.map((person) => (
              <Link
                className="connected-person"
                key={person.id}
                to="/people/$id"
                params={{ id: person.id }}
              >
                <strong>{person.full_name}</strong>
                <span>{person.outcome}</span>
                {person.callback_on && <p>Callback · {person.callback_on}</p>}
              </Link>
            ))}
          </div>
          {people.data.count === 0 && (
            <p>No people found. Your administrator can add people and assign them to you.</p>
          )}
          <div className="connected-actions">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>Page {page + 1}</span>
            <button
              disabled={(page + 1) * 50 >= people.data.count}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </>
  );
}
function CreatePerson({ onCreated }: { onCreated: () => void }) {
  const { client, membership } = useWorkspace();
  const queryClient = useQueryClient();
  const retry = useRef({ payload: "", id: "" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [owner, setOwner] = useState(membership.user_id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const owners = useQuery({
    queryKey: ["owners", membership.organisation_id],
    queryFn: async () => {
      const r = await client
        .from("shepherd_memberships")
        .select("*")
        .eq("organisation_id", membership.organisation_id)
        .eq("active", true)
        .order("display_name");
      if (r.error) throw r.error;
      return membershipSchema.array().parse(r.data);
    },
    retry: false,
  });
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = JSON.stringify({ name, phone, owner });
      if (retry.current.payload !== payload) retry.current = { payload, id: crypto.randomUUID() };
      const r = await client.rpc("shepherd_create_person_once", {
        p_request_id: retry.current.id,
        p_organisation_id: membership.organisation_id,
        p_full_name: name.trim(),
        p_phone_e164: phone.trim(),
        p_owner_user_id: owner,
      });
      if (r.error) throw r.error;
      await queryClient.invalidateQueries({ queryKey: ["people"] });
      onCreated();
    } catch {
      setError(
        "Could not confirm creation. Your draft is still here; retrying the same details is safe. Use an international phone number and an active owner.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="connected-card">
      <h2>Add a person</h2>
      <form onSubmit={submit}>
        <label>
          Full name
          <input value={name} required maxLength={140} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Phone number (optional)
          <input
            type="tel"
            placeholder="+447700900123"
            pattern="\+[1-9][0-9]{7,14}"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label>
          Permanent owner
          <select
            aria-label="Permanent owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            {owners.data?.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
        {owners.isError && <p role="alert">Could not load active owners.</p>}
        {error && <p role="alert">{error}</p>}
        <button
          disabled={busy || !owners.data?.length || !name.trim()}
          className="connected-primary"
        >
          {busy ? "Adding…" : "Add person"}
        </button>
      </form>
    </section>
  );
}
