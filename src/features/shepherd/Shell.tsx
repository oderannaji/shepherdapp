import { Link, useRouterState } from "@tanstack/react-router";
import {
  HeartHandshake,
  RotateCcw,
  Users,
  CalendarCheck2,
  ShieldCheck,
  ChevronDown,
  ArrowUpRight,
  Sprout,
  CheckCircle2,
  X,
  FlaskConical,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, useDemo } from "./shared";
const navigation = [
  { to: "/" as const, label: "Follow-up", icon: HeartHandshake },
  { to: "/recovery" as const, label: "Recovery", icon: RotateCcw },
  { to: "/expected" as const, label: "Expected", icon: CalendarCheck2 },
];
export function ShepherdMark() {
  return (
    <span className="brand-mark">
      <Sprout size={23} strokeWidth={1.7} />
    </span>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const { role, setRole, toast, reset, failSave, setFailSave } = useDemo();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [account, setAccount] = useState(false);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <ShepherdMark />
          <span>
            shepherd<span className="brand-subtitle">DOMINION CITY MANCHESTER</span>
          </span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`nav-item ${(to === "/" ? pathname === "/" || pathname.startsWith("/people") : pathname.startsWith(to)) ? "active" : ""}`}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Follow-up" && <span className="nav-count">5</span>}
            </Link>
          ))}
          {role === "Admin" && (
            <Link
              to="/admin/$section"
              params={{ section: "overview" }}
              className={`nav-item ${pathname.startsWith("/admin") ? "active" : ""}`}
            >
              <ShieldCheck size={19} />
              Admin
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="care-note">
            <span className="care-icon">
              <HeartHandshake size={20} />
            </span>
            <p>
              Every person matters.
              <br />
              <strong>Every connection counts.</strong>
            </p>
          </div>
          <div className="demo-role">
            <span>
              <FlaskConical size={14} /> DEMO ROLE
            </span>
            <select
              aria-label="Demo role"
              value={role}
              onChange={(e) => setRole(e.target.value as "Volunteer" | "Admin")}
            >
              <option>Volunteer</option>
              <option>Admin</option>
            </select>
            <small>Preview only · not authorisation</small>
          </div>
          <Button className="sidebar-account" variant="ghost" onClick={() => setAccount(!account)}>
            <Avatar name="Odera" small />
            <span>
              Odera Nwosu<small>{role}</small>
            </span>
            <ChevronDown size={15} />
          </Button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="desktop-context">
            <span className="context-dot" />
            Dominion City Manchester
            <ChevronDown size={13} />
          </div>
          <Link to="/" className="mobile-brand">
            <ShepherdMark />
            <strong>shepherd</strong>
          </Link>
          <div className="topbar-right">
            <span className="demo-pill">
              <span />
              Demo mode
            </span>
            <span className="topbar-date">Monday, 12 October</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAccount(!account)}
              aria-label="Open account"
            >
              <Avatar name="Odera" small />
            </Button>
          </div>
        </header>
        {account && (
          <div className="account-panel">
            <div className="flex items-center justify-between">
              <h3>Demo account</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAccount(false)}
                aria-label="Close account"
              >
                <X />
              </Button>
            </div>
            <label>
              Preview role
              <select
                aria-label="Mobile demo role"
                value={role}
                onChange={(e) => setRole(e.target.value as "Volunteer" | "Admin")}
              >
                <option>Volunteer</option>
                <option>Admin</option>
              </select>
            </label>
            <p>This is a fictional session. Changes last until you refresh.</p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={failSave}
                onChange={(e) => setFailSave(e.target.checked)}
              />
              Simulate save failure
            </label>
            <Button variant="outline" onClick={reset}>
              <RotateCcw />
              Reset demo data
            </Button>
            {role === "Admin" && (
              <Button asChild>
                <Link to="/admin/$section" params={{ section: "overview" }}>
                  <ShieldCheck />
                  Admin workspace
                </Link>
              </Button>
            )}
          </div>
        )}
        <main className="page-content">{children}</main>
        <footer className="page-footer">
          <span>Shepherd · Made for meaningful connections</span>
          <span>
            <FlaskConical size={12} /> Fictional data. Real care.
          </span>
        </footer>
      </div>
      <nav className="bottom-nav">
        {navigation.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={
              (
                to === "/"
                  ? pathname === "/" || pathname.startsWith("/people")
                  : pathname.startsWith(to)
              )
                ? "active"
                : ""
            }
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
        {role === "Admin" && (
          <Link
            to="/admin/$section"
            params={{ section: "overview" }}
            className={pathname.startsWith("/admin") ? "active" : ""}
          >
            <ShieldCheck size={21} />
            <span>Admin</span>
          </Link>
        )}
      </nav>
      {toast && (
        <div className="toast-message" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </div>
  );
}
