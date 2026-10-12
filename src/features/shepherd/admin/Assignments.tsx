import { useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo, Avatar, PageHeading, CALLERS } from "../shared";

export function Assignments() {
  const { people, setPeople, record, notify } = useDemo();
  const [selected, setSelected] = useState<string[]>([]);
  const [caller, setCaller] = useState("Odera");
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const existing = people.filter((p) => p.owner === caller).length;
  const added = selected.filter((id) => people.find((p) => p.id === id)?.owner !== caller).length;
  return (
    <>
      <PageHeading
        title="Assignments"
        description="Balance the workload. Give every person a clear permanent caller."
      />
      <div className="assignment-layout">
        <section>
          <div className="search-field">
            <Search size={17} />
            <input
              placeholder="Search people…"
              aria-label="Search assignments"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="assignment-picker">
            {people
              .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
              .map((p) => (
                <label className="assignment-person" key={p.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={(e) => {
                      setSelected((s) =>
                        e.target.checked ? [...s, p.id] : s.filter((id) => id !== p.id),
                      );
                      setPreview(false);
                    }}
                  />
                  <Avatar name={p.name} small />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.owner || "Unassigned"}</small>
                  </span>
                </label>
              ))}
          </div>
        </section>
        <section className="followup-form">
          <h2>{selected.length} people selected</h2>
          <label>
            Assign permanent caller
            <select
              value={caller}
              onChange={(e) => {
                setCaller(e.target.value);
                setPreview(false);
              }}
            >
              {CALLERS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <Button disabled={!selected.length} onClick={() => setPreview(true)}>
            Preview workload
            <ArrowRight />
          </Button>
          {preview && (
            <div className="merge-preview">
              <h3>{caller}’s workload</h3>
              <p>
                {existing} current + {added} new = <strong>{existing + added} people</strong>
              </p>
              <p>This changes permanent ownership, not weekly Recovery assignments.</p>
              <Button
                onClick={() => {
                  setPeople((p) =>
                    p.map((x) => (selected.includes(x.id) ? { ...x, owner: caller } : x)),
                  );
                  record(`Assigned ${selected.length} people permanently to ${caller}`);
                  notify("Assignments confirmed. Workloads updated.");
                  setSelected([]);
                  setPreview(false);
                }}
              >
                Confirm assignment
              </Button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
