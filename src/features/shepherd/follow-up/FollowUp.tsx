import community from "@/assets/church-community.jpg";
import { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  CalendarDays,
  ArrowRight,
  HeartHandshake,
  Clock3,
  CheckCircle2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  useDemo,
  Avatar,
  Empty,
  PageHeading,
  PersonCard,
  Status,
  absenceLevel,
  dueGroup,
  outcomes,
} from "../shared";

export function FollowUp() {
  const { people } = useDemo();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All people");
  const [filter, setFilter] = useState("All outcomes");
  const [filters, setFilters] = useState(false);
  const mine = people.filter((p) => p.owner === "Odera");
  const shown = mine.filter(
    (p) =>
      (tab === "All people" || dueGroup(p.callback) === tab) &&
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "All outcomes" || p.outcome === filter),
  );
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE CARE GOES A LONG WAY"
        title="My people"
        description="Stay connected. Follow up. Help everyone feel at home."
        action={
          <div className="week-label">
            <CalendarDays size={16} />
            <span>Week of 12 October</span>
          </div>
        }
      />
      <div className="followup-layout">
        <div className="followup-primary">
          <div className="summary-grid">
            {[
              { name: "Due today", icon: Clock3, tone: "teal", help: "A good day to reach out" },
              {
                name: "Overdue",
                icon: CalendarDays,
                tone: "amber",
                help: "A little extra care needed",
              },
              {
                name: "Upcoming",
                icon: CheckCircle2,
                tone: "neutral",
                help: "Your next connections",
              },
            ].map(({ name, icon: Icon, tone, help }) => (
              <Button
                key={name}
                variant="ghost"
                className={`summary-item summary-${tone} ${tab === name ? "selected" : ""}`}
                onClick={() => setTab(tab === name ? "All people" : name)}
              >
                <span className="summary-top">
                  <span>{name}</span>
                  <Icon size={17} />
                </span>
                <strong>
                  {mine
                    .filter((p) => dueGroup(p.callback) === name)
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
                <small>{help}</small>
              </Button>
            ))}
          </div>
          <div className="people-toolbar">
            <div className="section-tabs">
              {["All people", "Due today", "Overdue", "Upcoming"].map((t) => (
                <Button
                  key={t}
                  variant="ghost"
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t}
                  {t === "All people" && <span>{mine.length}</span>}
                </Button>
              ))}
            </div>
            <div className="search-filter-row">
              <div className="search-field">
                <Search size={18} />
                <input
                  aria-label="Search your people"
                  placeholder="Search your people…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    ×
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                className={filters ? "filter-button active" : "filter-button"}
                onClick={() => setFilters(!filters)}
              >
                <SlidersHorizontal size={16} />
                Filters
              </Button>
            </div>
            {filters && (
              <div className="filter-bar">
                <label>
                  Contact outcome
                  <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option>All outcomes</option>
                    {outcomes.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilter("All outcomes");
                    setTab("All people");
                  }}
                >
                  Reset filters
                </Button>
              </div>
            )}
          </div>
          <div className="list-caption">
            <span>{shown.length} people · permanently assigned to you</span>
            <span>LAST 4 SUNDAYS</span>
          </div>
          <div className="people-grid">
            {shown.map((p) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
          {shown.length === 0 && <Empty />}
          <div className="list-end">
            <span /> You're making a difference, one conversation at a time. <span />
          </div>
        </div>
        <aside className="right-rail">
          <div className="community-feature">
            <img
              src={community}
              width={1024}
              height={640}
              alt="Church friends connecting after a Sunday service"
            />
            <div className="community-copy">
              <span className="eyebrow">MORE THAN A SUNDAY</span>
              <h2>People, not numbers.</h2>
              <p>A thoughtful check-in can make someone’s whole week.</p>
            </div>
          </div>
          <div className="week-focus">
            <div className="rail-heading">
              <HeartHandshake size={19} />
              <h3>This week’s focus</h3>
            </div>
            <p>
              A familiar voice. A listening ear.
              <br />
              Let’s reach out to those we’ve missed.
            </p>
            <div className="focus-people">
              <div className="stacked-avatars">
                {people.slice(0, 3).map((p) => (
                  <Avatar key={p.id} name={p.name} small />
                ))}
              </div>
              <span>
                {mine.filter((p) => absenceLevel(p) > 0).length} of your people on Recovery
              </span>
            </div>
            <Button variant="link" asChild>
              <Link to="/recovery">
                View Recovery list
                <ArrowRight size={15} />
              </Link>
            </Button>
          </div>
          <div className="expected-reminder">
            <div className="flex justify-between">
              <span className="reminder-icon">
                <CalendarDays size={21} />
              </span>
              <Status tone="success">SUNDAY, 18 OCT</Status>
            </div>
            <h3>Who’s coming with you?</h3>
            <p>Your invitation could be the start of something beautiful.</p>
            <Button variant="outline" asChild>
              <Link to="/expected">
                View Expected lists
                <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="attendance-legend">
            <span>
              <span className="legend-dot came" />
              Attended
            </span>
            <span>
              <span className="legend-dot missed" />
              Missed
            </span>
            <small>Attendance shows the last 4 Sundays.</small>
          </div>
        </aside>
      </div>
    </>
  );
}
