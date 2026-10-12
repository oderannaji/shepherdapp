import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Upload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo, Avatar, Empty, PageHeading, Status } from "../shared";

export function AdminPeople() {
  const { people } = useDemo();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All people");
  const shown = people.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "All people" ||
        (filter === "Missing details" && !p.phone) ||
        (filter === "Unassigned" && !p.owner)),
  );
  return (
    <>
      <PageHeading
        title="People"
        description="Keep our church family’s details complete and connected."
        action={
          <Button asChild>
            <Link to="/admin/$section" params={{ section: "import" }}>
              <Upload />
              Import people
            </Link>
          </Button>
        }
      />
      <div className="recovery-filters">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search all people"
            placeholder="Search all people…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filter}
          aria-label="People filter"
          onChange={(e) => setFilter(e.target.value)}
        >
          {["All people", "Missing details", "Unassigned"].map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Permanent caller</th>
              <th>Phone</th>
              <th>Latest outcome</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} small />
                    <strong>{p.name}</strong>
                  </div>
                </td>
                <td>{p.owner || "Unassigned"}</td>
                <td>
                  {p.phone ? (
                    <Status tone="success">On file · Demo</Status>
                  ) : (
                    <Status tone="warning">Missing number</Status>
                  )}
                </td>
                <td>{p.outcome}</td>
                <td>
                  <Button variant="ghost" asChild>
                    <Link to="/people/$id" params={{ id: p.id }}>
                      Open
                      <ArrowRight />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && <Empty />}
    </>
  );
}
