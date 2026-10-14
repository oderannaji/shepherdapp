import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { IdentityGate, useWorkspace } from "./identity";
import "./connected.css";
export function ConnectedApp({ children }: { children: ReactNode }) {
  return (
    <IdentityGate>
      <WorkspaceNavigation>{children}</WorkspaceNavigation>
    </IdentityGate>
  );
}
function WorkspaceNavigation({ children }: { children: ReactNode }) {
  const { membership } = useWorkspace();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const admin = membership.role === "admin";
  if (path.startsWith("/admin/") && !admin)
    return (
      <section role="alert">
        <h1>Administrator access required</h1>
        <p>Your volunteer account cannot open this workspace.</p>
        <Link to="/">Return to my dashboard</Link>
      </section>
    );
  if (path === "/" && admin)
    return <Navigate to="/admin/$section" params={{ section: "overview" }} replace />;
  return (
    <>
      <nav className="connected-nav" aria-label="Workspace navigation">
        <Link to={admin ? "/admin/$section" : "/"} params={{ section: "people" }}>
          {" "}
          {admin ? "People" : "My people"}
        </Link>
        <Link to="/recovery">Recovery</Link>
        <Link to="/expected">Expected</Link>
        {admin && (
          <Link to="/admin/$section" params={{ section: "overview" }}>
            Administration
          </Link>
        )}
        <span className="connected-role">{admin ? "Administrator" : "Volunteer"}</span>
      </nav>
      {children}
    </>
  );
}
