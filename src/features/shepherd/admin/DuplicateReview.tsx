import { useState } from "react";
import { GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo, Avatar, Empty, PageHeading, Status } from "../shared";

export function DuplicateReview() {
  const { people, mergePeople, record, notify } = useDemo();
  const [a, setA] = useState("p1");
  const [b, setB] = useState("p2");
  const [nameSource, setNameSource] = useState("a");
  const [phoneSource, setPhoneSource] = useState("a");
  const [ownerSource, setOwnerSource] = useState("a");
  const [preview, setPreview] = useState(false);
  const [done, setDone] = useState(false);
  const left = people.find((p) => p.id === a);
  const right = people.find((p) => p.id === b);
  const merged =
    left && right
      ? {
          ...left,
          name: nameSource === "a" ? left.name : right.name,
          phone: phoneSource === "a" ? left.phone : right.phone,
          owner: ownerSource === "a" ? left.owner : right.owner,
          notes: [...left.notes, ...right.notes],
        }
      : null;
  return (
    <>
      <PageHeading
        title="Duplicate review"
        description="Compare carefully. Keep the details that tell the right story."
      />
      {done ? (
        <Empty
          title="Records merged in the demo"
          text="The surviving details are available in People. Expected references were retained under the surviving identity."
        />
      ) : (
        <>
          <div className="recovery-filters">
            <label>
              Record one
              <select
                value={a}
                onChange={(e) => {
                  setA(e.target.value);
                  setPreview(false);
                }}
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Record two
              <select
                value={b}
                onChange={(e) => {
                  setB(e.target.value);
                  setPreview(false);
                }}
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="merge-comparison">
            {[left, right].map(
              (p, i) =>
                p && (
                  <div className="merge-record" key={i}>
                    <Status>Record {i + 1}</Status>
                    <Avatar name={p.name} />
                    <h2>{p.name}</h2>
                    <p>Phone: {p.phone || "Missing"}</p>
                    <p>Permanent caller: {p.owner || "Unassigned"}</p>
                    <p>{p.notes.length} conversation notes</p>
                  </div>
                ),
            )}
          </div>
          <section className="detail-section">
            <h2>Select surviving details</h2>
            {[
              ["Name", nameSource, setNameSource],
              ["Phone", phoneSource, setPhoneSource],
              ["Permanent caller", ownerSource, setOwnerSource],
            ].map(([label, value, setter]) => (
              <label key={String(label)}>
                {String(label)}
                <select
                  value={String(value)}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                >
                  <option value="a">Record one</option>
                  <option value="b">Record two</option>
                </select>
              </label>
            ))}
            <p>
              Both sets of notes are retained. Attendance conflicts must be reconciled separately.
            </p>
            <Button disabled={a === b || !merged} onClick={() => setPreview(true)}>
              <GitMerge />
              Preview merge
            </Button>
            {preview && merged && (
              <div className="merge-preview">
                <h3>Surviving record: {merged.name}</h3>
                <p>
                  {merged.phone || "No phone"} · Owner: {merged.owner} · {merged.notes.length} notes
                </p>
                <p>
                  The second record will be removed. Attendance references will point to this
                  person.
                </p>
                <Button
                  onClick={() => {
                    mergePeople(merged, b);
                    record(`Merged records into ${merged.name}`);
                    notify("Demo merge complete.");
                    setDone(true);
                  }}
                >
                  Confirm merge
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
