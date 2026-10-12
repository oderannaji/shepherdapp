import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo, PageHeading, Status } from "../shared";

export function UserManagement() {
  const { users, setUsers, record, notify } = useDemo();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <>
      <PageHeading
        title="Users"
        description="A clear view of the people helping our church stay connected."
      />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Caller</th>
              <th>Role</th>
              <th>Status</th>
              <th>Care continuity</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i}>
                <td>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </td>
                <td>
                  <select
                    aria-label={`${u.name} role`}
                    value={u.role}
                    onChange={(e) => {
                      setUsers((old) =>
                        old.map((x, n) => (n === i ? { ...x, role: e.target.value } : x)),
                      );
                      record(`${u.name} demo role updated`);
                    }}
                  >
                    <option>Volunteer</option>
                    <option>Admin</option>
                  </select>
                </td>
                <td>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={u.active}
                      onChange={(e) => {
                        setUsers((old) =>
                          old.map((x, n) => (n === i ? { ...x, active: e.target.checked } : x)),
                        );
                        record(`${u.name} ${e.target.checked ? "activated" : "deactivated"}`);
                      }}
                    />
                    {u.active ? "Active" : "Inactive"}
                  </label>
                </td>
                <td>
                  <Status tone={u.active ? "success" : "warning"}>
                    {u.active ? "Assigned and active" : "Needs reassignment"}
                  </Status>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="detail-section invite-form">
        <h2>Invite a demo caller</h2>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fictional full name"
          />
        </label>
        <label>
          Demo email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.test"
          />
        </label>
        <Button
          disabled={!name.trim() || !email.includes("@")}
          onClick={() => {
            setUsers((u) => [...u, { name: name.trim(), email, role: "Volunteer", active: true }]);
            record(`Demo invitation prepared for ${name}`);
            notify("Demo invitation created. No email was sent.");
            setName("");
            setEmail("");
          }}
        >
          <Plus />
          Create demo invitation
        </Button>
        <p>No real invitation or email will be sent.</p>
      </section>
    </>
  );
}
