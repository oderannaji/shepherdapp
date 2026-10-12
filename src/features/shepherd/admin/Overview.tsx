import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useDemo,
  PageHeading,
  Status,
  absenceLevel,
  churchTotals,
  attendanceIssues,
} from "../shared";

export function Overview() {
  const { people, posts, users, finalised, walkins } = useDemo();
  const totals = churchTotals(posts);
  return (
    <>
      <PageHeading
        title="A view of our church family"
        description="This week’s connections, care and Sunday participation."
      />
      <div className="admin-metrics">
        {[
          [
            "Weekly Recovery",
            people.filter((p) => absenceLevel(p) > 0).length,
            "People to reconnect with",
          ],
          [
            "Pending follow-ups",
            people.filter((p) => p.callback <= "2026-10-12").length,
            "Due today or overdue",
          ],
          [
            "Expected participation",
            `${new Set(posts.map((p) => p.author)).size}/${users.filter((u) => u.active).length}`,
            "Active callers posting",
          ],
          [
            "Sunday turnout",
            totals.came + walkins.length,
            `${totals.expected} unique people expected`,
          ],
        ].map(([title, value, sub]) => (
          <div className="admin-metric" key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="overview-columns">
        <section className="detail-section">
          <h2>Needs a little attention</h2>
          {[
            ["Missing contact details", people.filter((p) => !p.phone).length, "people"],
            [
              "Weekly Recovery assignments",
              people.filter((p) => absenceLevel(p) >= 3).length,
              "recovery",
            ],
            [
              "Service reconciliation",
              finalised ? 0 : attendanceIssues(posts).length,
              "reconciliation",
            ],
          ].map(([title, count, section]) => (
            <Link
              key={title}
              to="/admin/$section"
              params={{ section: String(section) }}
              className="overview-row"
            >
              <span>{title}</span>
              <Status tone={count ? "warning" : "success"}>{count}</Status>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>
        <section className="detail-section">
          <h2>Sunday, 18 October</h2>
          <p>
            {totals.came} arrivals recorded from {totals.expected} expected people.
          </p>
          <Status tone={finalised ? "success" : "neutral"}>
            {finalised ? "Service finalised" : "Reconciliation pending"}
          </Status>
          <Button variant="outline" asChild className="mt-5">
            <Link to="/admin/$section" params={{ section: "sunday" }}>
              Open Sunday view
              <ArrowRight />
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}
