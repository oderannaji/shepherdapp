import { Check, Minus, Users, X, ChevronRight, CalendarDays } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SUNDAYS, absenceLevel, dueGroup, type Person } from "./model";
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`person-avatar ${small ? "small" : ""} avatar-${name.length % 4}`}>
      {name
        .split(" ")
        .slice(0, 2)
        .map((x) => x[0])
        .join("")}
    </span>
  );
}
export function Status({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`status status-${tone}`}>{children}</span>;
}
export function AttendanceStrip({
  attendance,
  dates = false,
}: {
  attendance: boolean[];
  dates?: boolean;
}) {
  return (
    <div className="attendance-strip" aria-label="Recent Sunday attendance">
      {attendance.map((came, i) => (
        <div key={i} className="attendance-day">
          <span
            title={`${SUNDAYS[i]}: ${came ? "Attended" : "Missed"}`}
            className={`attendance-mark ${came ? "came" : "missed"}`}
            aria-label={`${SUNDAYS[i]}: ${came ? "Attended" : "Missed"}`}
          >
            {came ? <Check size={12} /> : <Minus size={12} />}
          </span>
          {dates && <small>{SUNDAYS[i]}</small>}
        </div>
      ))}
    </div>
  );
}
export function Empty({
  title = "No people found",
  text = "Try another name or change your filters.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty-state">
      <Users size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function PersonCard({ person, recovery = false }: { person: Person; recovery?: boolean }) {
  const level = absenceLevel(person);
  const group = dueGroup(person.callback);
  return (
    <Link to="/people/$id" params={{ id: person.id }} className="person-card">
      <div className="person-card-top">
        <Avatar name={person.name} />
        <div className="min-w-0 flex-1">
          <h3>{person.name}</h3>
          <div className="person-meta">
            {recovery
              ? `Recovery caller: ${person.recoveryCaller ?? person.owner}`
              : `Assigned to ${person.owner} · Permanent`}
          </div>
        </div>
        <ChevronRight size={18} className="text-muted-foreground" />
      </div>
      <div className="person-card-middle">
        <Status
          tone={
            person.outcome === "Reached" || person.outcome === "Will return" ? "success" : "neutral"
          }
        >
          {person.outcome}
        </Status>
        {!person.phone && <span className="missing-detail">No phone number</span>}
      </div>
      <div className="person-card-bottom">
        <span className={group === "Overdue" ? "text-danger" : ""}>
          <CalendarDays size={13} />{" "}
          {recovery ? (
            <span>
              <Status tone={level >= 3 ? "danger" : level === 2 ? "warning" : "caution"}>
                {level} consecutive {level === 1 ? "absence" : "absences"}
              </Status>
            </span>
          ) : group === "Due today" ? (
            "Today, 5:00 pm"
          ) : group === "Overdue" ? (
            "Overdue · 10 Oct"
          ) : (
            "Thu, 15 Oct"
          )}
        </span>
        <AttendanceStrip attendance={person.attendance} />
      </div>
      {recovery && person.recoveryCaller && person.recoveryCaller !== person.owner && (
        <div className="ownership-note">Permanent owner: {person.owner}</div>
      )}
    </Link>
  );
}
export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label="Close">
      <X />
    </Button>
  );
}
