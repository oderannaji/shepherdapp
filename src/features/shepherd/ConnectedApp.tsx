import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { IdentityGate } from "./identity";
import "./connected.css";
export function ConnectedApp({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const ready = path === "/" || /^\/people\/[^/]+\/?$/.test(path);
  return (
    <IdentityGate>
      {ready ? (
        children
      ) : (
        <section>
          <h1>This module is being connected</h1>
          <p>
            People and follow-up notes are ready in this workspace. This module is still available
            in the fictional demo.
          </p>
          <Link className="connected-back" to="/">
            Return to my people
          </Link>
        </section>
      )}
    </IdentityGate>
  );
}
