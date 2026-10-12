import { useState } from "react";
import { Search, CalendarDays, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useDemo,
  PageHeading,
  PersonCard,
  Empty,
  Status,
  absenceLevel,
  outcomes,
  SUNDAYS,
} from "../shared";
export function Recovery() {
  const { people } = useDemo();
  const [scope, setScope] = useState("Mine");
  const [priority, setPriority] = useState("All priorities");
  const [outcome, setOutcome] = useState("All outcomes");
  const [search, setSearch] = useState("");
  const recovery = people
    .filter((p) => absenceLevel(p) > 0)
    .sort((a, b) => absenceLevel(b) - absenceLevel(a));
  const shown = recovery.filter(
    (p) =>
      (scope === "All authorised" || (p.recoveryCaller ?? p.owner) === "Odera") &&
      (priority === "All priorities" || Math.min(absenceLevel(p), 3) === Number(priority)) &&
      (outcome === "All outcomes" || p.outcome === outcome) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="RECONNECT WITH CARE"
        title="Recovery"
        description="A friendly check-in for the people we’ve missed."
        action={
          <div className="week-label">
            <CalendarDays size={16} />
            Week of 12 October
          </div>
        }
      />
      <div className="recovery-source">
        <RotateCcw size={19} />
        <div>
          <strong>This week’s Recovery list</strong>
          <p>Based on Sunday attendance</p>
        </div>
        <div className="source-dates">
          {SUNDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>
      <div className="summary-grid recovery-summary">
        {[3, 2, 1].map((level) => (
          <Button
            key={level}
            variant="ghost"
            className={`summary-item ${priority === String(level) ? "selected" : ""}`}
            onClick={() =>
              setPriority(priority === String(level) ? "All priorities" : String(level))
            }
          >
            <Status tone={level === 3 ? "danger" : level === 2 ? "warning" : "caution"}>
              {level} consecutive {level === 1 ? "absence" : "absences"}
            </Status>
            <strong>{recovery.filter((p) => Math.min(absenceLevel(p), 3) === level).length}</strong>
            <small>
              {level === 3
                ? "Priority check-in"
                : level === 2
                  ? "Keep the connection"
                  : "A gentle hello"}
            </small>
          </Button>
        ))}
      </div>
      <div className="recovery-filters">
        <div className="segmented">
          {["Mine", "All authorised"].map((s) => (
            <Button
              key={s}
              variant="ghost"
              className={scope === s ? "active" : ""}
              onClick={() => setScope(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Search Recovery"
            placeholder="Search Recovery…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Recovery priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option>All priorities</option>
          <option value="3">3 absences</option>
          <option value="2">2 absences</option>
          <option value="1">1 absence</option>
        </select>
        <select
          aria-label="Recovery outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          <option>All outcomes</option>
          {outcomes.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="list-caption">
        <span>{shown.length} people · highest priority first</span>
        <span>LAST 4 SUNDAYS</span>
      </div>
      <div className="recovery-grid">
        {shown.map((p) => (
          <PersonCard person={p} recovery key={p.id} />
        ))}
      </div>
      {shown.length === 0 && (
        <Empty title="All clear here" text="No people match these Recovery filters." />
      )}
      <p className="demo-footnote">
        Weekly Recovery assignments do not change permanent ownership.
      </p>
    </>
  );
}
