import { useState } from "react";
import {
  Plus,
  Search,
  Check,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Users,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  LockKeyhole,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useDemo,
  Avatar,
  Status,
  CloseButton,
  postTotals,
  canEditPost,
  type Attendance,
  type Entry,
  type Post,
} from "../shared";

export function ExpectedEditor({
  initial,
  service,
  onClose,
}: {
  initial: Post | null;
  service: string;
  onClose: () => void;
}) {
  const { people, posts, savePost, notify, role, failSave } = useDemo();
  const [entries, setEntries] = useState<Entry[]>(
    initial ? initial.entries.map((e) => ({ ...e })) : [],
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [stage, setStage] = useState(initial ? "manage" : "select");
  const [search, setSearch] = useState("");
  const [guest, setGuest] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(
    JSON.stringify({ entries: initial?.entries ?? [], note: initial?.note ?? "" }),
  );
  const readonly = initial
    ? role !== "Admin" && (initial.author !== "Odera" || initial.state !== "Published")
    : false;
  const dirty = JSON.stringify({ entries, note }) !== savedSnapshot;
  const draft: Post = {
    id: initial?.id ?? `post-${Date.now()}`,
    author: initial?.author ?? "Odera",
    service,
    time: initial?.time ?? "Just now",
    note,
    entries,
    state: initial?.state ?? "Published",
  };
  const totals = postTotals(draft);
  function togglePerson(id: string, name: string) {
    setEntries((old) =>
      old.some((e) => e.personId === id)
        ? old.filter((e) => e.personId !== id)
        : [
            ...old,
            {
              personId: id,
              name,
              attendance: "unknown",
              late: initial?.state !== "Published" && !!initial,
            },
          ],
    );
  }
  function addGuest() {
    if (!guest.trim()) return;
    setEntries((e) => [
      ...e,
      {
        personId: `guest-${Date.now()}`,
        name: guest.trim(),
        attendance: "unknown",
        late: !!initial && initial.state !== "Published",
      },
    ]);
    setGuest("");
  }
  function changeAttendance(id: string, value: Attendance) {
    setEntries((e) => e.map((x) => (x.personId === id ? { ...x, attendance: value } : x)));
  }
  async function save(state: Post["state"]) {
    if (initial && !canEditPost(initial, role, "Odera", reason)) {
      setError(role === "Admin" ? "Add a reason for this correction." : "This list is read-only.");
      return;
    }
    if (!entries.length) {
      setError("Add at least one person before publishing.");
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 350));
    setSaving(false);
    if (failSave) {
      setError("We couldn’t save your list. Your changes are safe in this window. Try again.");
      return;
    }
    savePost({ ...draft, state }, reason);
    setSavedSnapshot(JSON.stringify({ entries, note }));
    notify(
      state === "Results posted"
        ? "Results posted. Every connection counts."
        : "Expected list published to the team.",
    );
    onClose();
  }
  function close() {
    if (dirty && !readonly) {
      setStage("discard");
      return;
    }
    onClose();
  }
  return (
    <div className="sheet-backdrop">
      <section
        className="expected-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={initial ? `${initial.author}’s expected` : "Create my expected list"}
      >
        <header className="sheet-header">
          <div>
            <span className="eyebrow">
              {readonly
                ? "TEAM LIST · READ ONLY"
                : initial
                  ? "YOUR SUNDAY CONNECTIONS"
                  : "CREATE MY LIST"}
            </span>
            <h2>{initial ? `${initial.author}’s expected` : "Who are you expecting?"}</h2>
          </div>
          <CloseButton onClick={close} />
        </header>
        <div className="sheet-service">
          <CalendarDays size={16} />
          {service}
        </div>
        <div className="sheet-body">
          {stage === "discard" ? (
            <div className="discard-state">
              <AlertCircle size={32} />
              <h3>You have unsaved changes</h3>
              <p>Keep editing or discard your changes before leaving.</p>
              <Button onClick={() => setStage(initial ? "manage" : "select")}>Keep editing</Button>
              <Button variant="outline" onClick={onClose}>
                Discard changes
              </Button>
            </div>
          ) : (
            <>
              {(stage === "select" || stage === "add") && (
                <>
                  <div className="editor-steps">
                    <span className="active">1. Add people</span>
                    <span>2. Preview</span>
                    <span>3. Publish</span>
                  </div>
                  <div className="search-field">
                    <Search size={17} />
                    <input
                      autoFocus
                      aria-label="Find people for Expected"
                      placeholder="Find a person…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="guest-input">
                    <input
                      aria-label="Guest name"
                      placeholder="Or add a guest’s full name"
                      value={guest}
                      onChange={(e) => setGuest(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addGuest();
                      }}
                    />
                    <Button variant="outline" onClick={addGuest} disabled={!guest.trim()}>
                      <Plus />
                      Add guest
                    </Button>
                  </div>
                  <div className="selected-count">{entries.length} selected</div>
                  <div className="person-picker">
                    {people
                      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
                      .map((p) => (
                        <label key={p.id}>
                          <input
                            type="checkbox"
                            checked={entries.some((e) => e.personId === p.id)}
                            onChange={() => togglePerson(p.id, p.name)}
                          />
                          <Avatar name={p.name} small />
                          <span>
                            {p.name}
                            <small>Assigned to {p.owner}</small>
                          </span>
                        </label>
                      ))}
                  </div>
                  {entries
                    .filter((e) => e.personId.startsWith("guest"))
                    .map((e) => (
                      <div className="guest-row" key={e.personId}>
                        <Status>Guest</Status>
                        {e.name}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${e.name}`}
                          onClick={() => togglePerson(e.personId, e.name)}
                        >
                          <X />
                        </Button>
                      </div>
                    ))}
                  <label>
                    Public note (optional)
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="A short note for the team…"
                    />
                  </label>
                </>
              )}
              {(stage === "manage" || stage === "preview" || stage === "results") && (
                <>
                  {stage === "preview" && (
                    <div className="editor-steps">
                      <span>1. Add people</span>
                      <span className="active">2. Preview</span>
                      <span>3. Publish</span>
                    </div>
                  )}
                  {stage === "results" && (
                    <div className="results-preview">
                      <CheckCircle2 size={25} />
                      <h3>
                        {draft.author} — {totals.came} of {totals.expected} came
                      </h3>
                      <p>
                        {totals.unchecked} not checked yet
                        {totals.late ? ` · ${totals.late} late arrivals` : ""}
                      </p>
                    </div>
                  )}
                  {readonly && (
                    <div className="read-only-note">
                      <LockKeyhole size={16} />
                      Only the author can edit this list. You can still cheer them on.
                    </div>
                  )}
                  {initial && role === "Admin" && (
                    <label>
                      Reason for correction (required)
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain why this record is changing…"
                      />
                    </label>
                  )}
                  {note && <p className="post-note">{note}</p>}
                  <ol className="arrival-list">
                    {entries.map((entry, i) => (
                      <li key={entry.personId}>
                        <div className="arrival-name">
                          <span>{i + 1}.</span>
                          <strong>{entry.name}</strong>
                          {entry.late && <Status>Late addition</Status>}
                        </div>
                        {initial && !readonly && stage === "manage" ? (
                          <div className="arrival-controls">
                            <label>
                              <input
                                aria-label={`${entry.name} came`}
                                type="checkbox"
                                checked={entry.attendance === "came"}
                                onChange={(e) =>
                                  changeAttendance(
                                    entry.personId,
                                    e.target.checked ? "came" : "unknown",
                                  )
                                }
                              />
                              Came
                            </label>
                            <select
                              aria-label={`${entry.name} attendance`}
                              value={entry.attendance}
                              onChange={(e) =>
                                changeAttendance(entry.personId, e.target.value as Attendance)
                              }
                            >
                              <option value="unknown">Not checked yet</option>
                              <option value="came">Came</option>
                              <option value="absent">Absent</option>
                            </select>
                          </div>
                        ) : (
                          <Status tone={entry.attendance === "came" ? "success" : "neutral"}>
                            {entry.attendance === "came"
                              ? "Came"
                              : entry.attendance === "absent"
                                ? "Absent"
                                : "Not checked yet"}
                          </Status>
                        )}
                      </li>
                    ))}
                  </ol>
                  {stage === "manage" && !readonly && (
                    <>
                      <Button variant="outline" onClick={() => setStage("add")}>
                        <Plus />
                        {initial?.state === "Published"
                          ? "Edit names / add guests"
                          : "Add a late arrival"}
                      </Button>
                      <label>
                        Public note
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                      </label>
                    </>
                  )}
                  {stage === "preview" && (
                    <div className="preview-total">
                      <Users size={19} />
                      <strong>{totals.expected} people expected</strong>
                      <span>Your list will be visible to everyone.</span>
                    </div>
                  )}
                </>
              )}
              {dirty && !readonly && <p className="unsaved">● Unsaved changes</p>}
              {error && (
                <div className="error-message" role="alert">
                  <AlertCircle size={17} />
                  {error}
                </div>
              )}
            </>
          )}
        </div>
        {stage !== "discard" && (
          <footer className="sheet-footer">
            {readonly ? (
              <Button variant="outline" onClick={onClose}>
                Close list
              </Button>
            ) : stage === "select" || stage === "add" ? (
              <>
                <span>{entries.length} people selected</span>
                <Button
                  disabled={!entries.length}
                  onClick={() => setStage(initial ? "manage" : "preview")}
                >
                  {initial ? "Done" : "Preview list"}
                  <ArrowRight />
                </Button>
              </>
            ) : stage === "preview" ? (
              <>
                <Button variant="outline" onClick={() => setStage("select")}>
                  <ArrowLeft />
                  Edit list
                </Button>
                <Button disabled={saving} onClick={() => save("Published")}>
                  <Send />
                  {saving ? "Publishing…" : "Publish list"}
                </Button>
              </>
            ) : stage === "results" ? (
              <>
                <Button variant="outline" onClick={() => setStage("manage")}>
                  <ArrowLeft />
                  Back
                </Button>
                <Button disabled={saving} onClick={() => save("Results posted")}>
                  <CheckCircle2 />
                  {saving ? "Posting…" : "Post results"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => save(initial?.state ?? "Published")}
                >
                  <Check />
                  Save changes
                </Button>
                <Button onClick={() => setStage("results")}>
                  Preview totals
                  <ArrowRight />
                </Button>
              </>
            )}
          </footer>
        )}
      </section>
    </div>
  );
}
