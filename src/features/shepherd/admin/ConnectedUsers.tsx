import { useState, type FormEvent } from "react";
import { useWorkspace, useWorkspaceData, useWorkspaceMutation } from "../identity";
import type { WorkspaceMember } from "../shared";
export function ConnectedUsers() {
  const { client, membership } = useWorkspace();
  const action = useWorkspaceMutation();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("volunteer");
  const users = useWorkspaceData(["users"], async (c, m) => {
    const r = await c.rpc("shepherd_members", { p_organisation_id: m.organisation_id });
    if (r.error) throw r.error;
    return r.data as WorkspaceMember[];
  });
  async function send(kind: "invite" | "reset", address = email, display = name, nextRole = role) {
    return action.run(
      async () => {
        const r = await client.functions.invoke("account-admin", {
          body: {
            organisation_id: membership.organisation_id,
            action: kind,
            email: address,
            name: display,
            role: nextRole,
          },
        });
        if (r.error) {
          let detail =
            "Account email could not be sent. Check the email service configuration and try again.";
          try {
            const b = await r.error.context?.json();
            if (typeof b?.error === "string") detail = b.error;
          } catch {
            /* network errors have no JSON body */
          }
          throw new Error(detail);
        }
        return r.data;
      },
      kind === "invite"
        ? "Invitation sent. The recipient chooses their own password."
        : "Password-reset email requested.",
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const saved = await send("invite");
    if (saved) {
      setEmail("");
      setName("");
    }
  }
  return (
    <section>
      <h1>Accounts and access</h1>
      <p>
        Give each person their own account. Volunteers cannot open administration or grant
        themselves a different role.
      </p>
      <form className="connected-card" onSubmit={submit}>
        <h2>Invite a team member</h2>
        <label>
          Full name
          <input required maxLength={140} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email address
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Account role
          <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="volunteer">Volunteer</option>
            <option value="admin">Administrator (MFA required)</option>
          </select>
        </label>
        <p>The invitation email lets them verify their address and set their own password.</p>
        <button className="connected-primary" disabled={action.busy}>
          Send invitation email
        </button>
      </form>
      {action.error && <p role="alert">{action.error}</p>}
      {action.message && <p role="status">{action.message}</p>}
      {users.isPending ? (
        <p role="status">Loading accounts…</p>
      ) : users.isError ? (
        <p role="alert">
          Could not load accounts. <button onClick={() => void users.refetch()}>Retry</button>
        </p>
      ) : (
        <div className="connected-grid">
          {users.data.map((user) => (
            <MemberCard
              key={user.user_id}
              user={user}
              self={user.user_id === membership.user_id}
              onEmail={() =>
                void send(
                  user.confirmed ? "reset" : "invite",
                  user.email,
                  user.display_name,
                  user.role,
                )
              }
              emailBusy={action.busy}
            />
          ))}
        </div>
      )}
    </section>
  );
}
function MemberCard({
  user,
  self,
  onEmail,
  emailBusy,
}: {
  user: WorkspaceMember;
  self: boolean;
  onEmail: () => void;
  emailBusy: boolean;
}) {
  const action = useWorkspaceMutation();
  const [revision, setRevision] = useState(user.revision);
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const [reason, setReason] = useState("");
  return (
    <article className="connected-card">
      <h2>
        {user.display_name}
        {self ? " (you)" : ""}
      </h2>
      <p>{user.email}</p>
      <p>
        {user.confirmed ? "Email verified" : "Awaiting email verification"} ·{" "}
        {user.active ? "Active" : "Disabled"}
      </p>
      {!self && revision !== user.revision && (
        <p role="alert">
          This account changed.{" "}
          <button
            onClick={() => {
              setRevision(user.revision);
              setRole(user.role);
              setActive(user.active);
            }}
          >
            Reload account access
          </button>
        </p>
      )}
      {!self && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await action.adminAction("set_member", {
              revision,
              user_id: user.user_id,
              role,
              active,
              reason,
            });
            if (result) {
              setRevision((v) => v + 1);
              setReason("");
            }
          }}
        >
          <label>
            Role
            <select
              aria-label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="volunteer">Volunteer</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <label>
            Access
            <select
              aria-label="Access"
              value={String(active)}
              onChange={(e) => setActive(e.target.value === "true")}
            >
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <label>
            Reason for access change
            <input
              minLength={3}
              maxLength={1000}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p>
            Disabling access immediately blocks workspace data. Reassign this person’s contacts in
            Assignments.
          </p>
          <button disabled={action.busy}>Save access</button>
        </form>
      )}
      {self && <p>Another administrator must change your role or disable your account.</p>}
      <button onClick={onEmail} disabled={emailBusy || !user.active}>
        {user.confirmed ? "Send password-reset email" : "Resend invitation email"}
      </button>
      {action.error && <p role="alert">{action.error}</p>}
      {action.message && <p role="status">{action.message}</p>}
    </article>
  );
}
