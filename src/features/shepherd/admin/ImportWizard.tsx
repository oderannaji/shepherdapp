import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Upload, ArrowRight, CheckCircle2, ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo, PageHeading, Status } from "../shared";

type ImportRow = { name: string; phone: string };
function parseCsv(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return lines
    .slice(1)
    .map((l) => {
      const cells = l.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      return { name: cells[0] ?? "", phone: cells[1] ?? "" };
    })
    .filter((r) => r.name);
}
export function ImportWizard() {
  const { people, setPeople, record, notify } = useDemo();
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [nameCol, setNameCol] = useState("Name");
  const [phoneCol, setPhoneCol] = useState("Phone");
  const [busy, setBusy] = useState(false);
  const additions = rows.filter(
    (r) => !people.some((p) => p.name.toLowerCase() === r.name.toLowerCase()),
  );
  const updates = rows.filter((r) =>
    people.some((p) => p.name.toLowerCase() === r.name.toLowerCase()),
  );
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setError("Choose a CSV file to continue.");
      return;
    }
    setBusy(true);
    const parsed = parseCsv(await file.text());
    setBusy(false);
    if (!parsed.length) {
      setError("No names were found. Use a CSV with Name and Phone columns.");
      return;
    }
    setRows(parsed);
    setFilename(file.name);
    setError("");
    setStep(1);
  }
  function confirm() {
    setPeople((old) => [
      ...old.map((p) => {
        const match = updates.find((r) => r.name.toLowerCase() === p.name.toLowerCase());
        return match ? { ...p, phone: match.phone ? "Demo number imported" : p.phone } : p;
      }),
      ...additions.map((r, i) => ({
        id: `import-${Date.now()}-${i}`,
        name: r.name,
        phone: r.phone ? "Demo number imported" : "",
        owner: "",
        attendance: [false, false, false, false],
        outcome: "Callback" as const,
        callback: "2026-10-15",
        notes: [],
      })),
    ]);
    record(`Imported ${additions.length} people and updated ${updates.length} details`);
    setStep(3);
    notify("Demo import confirmed. People list updated.");
  }
  return (
    <>
      <PageHeading
        title="Import people"
        description="A thoughtful review before any records are changed."
      />
      <div className="wizard-steps">
        {["Upload CSV", "Map columns", "Review", "Complete"].map((s, i) => (
          <span key={s} className={i === step ? "active" : ""}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <section className="wizard-body">
        {step === 0 ? (
          <>
            <div className="upload-zone">
              <Upload size={34} />
              <h2>Bring in your demo CSV</h2>
              <p>Name and Phone columns · fictional details only</p>
              <input
                type="file"
                accept=".csv"
                aria-label="Upload demo CSV"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              {busy && <Status>Reading your CSV…</Status>}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setRows([
                  { name: "Alice Morgan", phone: "demo" },
                  { name: "Daniel Thompson", phone: "demo" },
                  { name: "Amara Okafor", phone: "" },
                  { name: "Peter Akinyemi", phone: "" },
                ]);
                setFilename("fictional-people.csv");
                setStep(1);
              }}
            >
              Use sample demo CSV
            </Button>
          </>
        ) : step === 1 ? (
          <>
            <h2>Map your columns</h2>
            <p>
              <FileText size={16} />
              {filename} · {rows.length} records
            </p>
            <label>
              Person name
              <select value={nameCol} onChange={(e) => setNameCol(e.target.value)}>
                <option>Name</option>
                <option>Phone</option>
              </select>
            </label>
            <label>
              Phone number
              <select value={phoneCol} onChange={(e) => setPhoneCol(e.target.value)}>
                <option>Phone</option>
                <option>Name</option>
                <option>Skip</option>
              </select>
            </label>
            {nameCol === phoneCol && (
              <p className="error-message">Choose different columns for name and phone.</p>
            )}
            <Button
              disabled={nameCol === phoneCol}
              onClick={() => {
                if (nameCol === "Phone")
                  setRows((r) =>
                    r.map((x) => ({ name: x.phone, phone: phoneCol === "Skip" ? "" : x.name })),
                  );
                else if (phoneCol === "Skip") setRows((r) => r.map((x) => ({ ...x, phone: "" })));
                setStep(2);
              }}
            >
              Review import
              <ArrowRight />
            </Button>
          </>
        ) : step === 2 ? (
          <>
            <h2>Review the changes</h2>
            <div className="import-totals">
              <Status tone="success">{additions.length} additions</Status>
              <Status>{updates.length} updates / possible duplicates</Status>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="review-row">
                <strong>{r.name}</strong>
                <Status tone={updates.includes(r) ? "warning" : "success"}>
                  {updates.includes(r) ? "Existing record — update" : "New person — unassigned"}
                </Status>
              </div>
            ))}
            <p>
              Matching names update existing records rather than creating a duplicate. Review
              uncertain matches in Duplicate review.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft />
                Back
              </Button>
              <Button onClick={confirm}>
                <CheckCircle2 />
                Confirm demo import
              </Button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <CheckCircle2 size={38} />
            <h2>Import complete</h2>
            <p>
              {additions.length} people added. {updates.length} details updated.
            </p>
            <Button asChild>
              <Link to="/admin/$section" params={{ section: "people" }}>
                View people
                <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
      </section>
    </>
  );
}
