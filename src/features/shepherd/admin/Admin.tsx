import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useDemo, Empty, Status } from "../shared";
import { Expected } from "../expected";
import { Overview } from "./Overview";
import { AdminPeople } from "./AdminPeople";
import { ImportWizard } from "./ImportWizard";
import { DuplicateReview } from "./DuplicateReview";
import { Assignments } from "./Assignments";
import { AdminRecovery } from "./AdminRecovery";
import { Reconciliation } from "./Reconciliation";
import { UserManagement } from "./UserManagement";
import { Audit } from "./Audit";

const adminSections = [
  ["overview", "Overview"],
  ["people", "People"],
  ["import", "Import people"],
  ["duplicates", "Duplicate review"],
  ["assignments", "Assignments"],
  ["recovery", "Weekly Recovery"],
  ["sunday", "Sunday view"],
  ["reconciliation", "Reconciliation"],
  ["users", "Users"],
  ["audit", "Audit activity"],
] as const;
export function Admin({ section }: { section: string }) {
  const { role } = useDemo();
  return (
    <>
      <div className="admin-topline">
        <ShieldCheck size={16} />
        <span>ADMIN WORKSPACE</span>
        <Status>Demo permissions only</Status>
      </div>
      <div className="admin-nav">
        {adminSections.map(([s, label]) => (
          <Link
            key={s}
            to="/admin/$section"
            params={{ section: s }}
            className={section === s ? "active" : ""}
          >
            {label}
          </Link>
        ))}
      </div>
      {role !== "Admin" ? (
        <div className="empty-state">
          <ShieldCheck size={32} />
          <h2>Preview the Admin experience</h2>
          <p>Use the demo role switcher to open this workspace. This is not real authorisation.</p>
        </div>
      ) : section === "overview" ? (
        <Overview />
      ) : section === "people" ? (
        <AdminPeople />
      ) : section === "import" ? (
        <ImportWizard />
      ) : section === "duplicates" ? (
        <DuplicateReview />
      ) : section === "assignments" ? (
        <Assignments />
      ) : section === "recovery" ? (
        <AdminRecovery />
      ) : section === "sunday" ? (
        <Expected adminView />
      ) : section === "reconciliation" ? (
        <Reconciliation />
      ) : section === "users" ? (
        <UserManagement />
      ) : section === "audit" ? (
        <Audit />
      ) : (
        <Empty title="Workspace not found" />
      )}
    </>
  );
}
