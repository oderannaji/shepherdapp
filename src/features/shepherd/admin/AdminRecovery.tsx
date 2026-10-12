import { useState } from "react";
import { CheckCircle2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo, PageHeading, Status, absenceLevel } from "../shared";

export function AdminRecovery() {
  const { people, recoveryPublished, setRecoveryPublished, record, notify } = useDemo();
  const [preview, setPreview] = useState(false);
  const rows = people
    .filter((p) => absenceLevel(p) > 0)
    .sort((a, b) => absenceLevel(b) - absenceLevel(a));
  return (
    <>
      <PageHeading
        title="Weekly Recovery"
        description="Review priorities and assignment reasons before sharing the weekly list."
        action={
          <Status tone={recoveryPublished ? "success" : "neutral"}>
            {recoveryPublished ? "Published" : "Draft preview"}
          </Status>
        }
      />
      <div className="service-banner">
        <CalendarDays />
        <div>
          <strong>Source Sundays</strong>
          <p>20 Sep · 27 Sep · 4 Oct · 11 Oct</p>
        </div>
        <Button onClick={() => setPreview(true)}>Preview weekly list</Button>
      </div>
      {preview && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Priority</th>
                  <th>Recovery caller</th>
                  <th>Assignment reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>Permanent: {p.owner}</small>
                    </td>
                    <td>
                      <Status
                        tone={
                          absenceLevel(p) >= 3
                            ? "danger"
                            : absenceLevel(p) === 2
                              ? "warning"
                              : "caution"
                        }
                      >
                        {absenceLevel(p)} absences
                      </Status>
                    </td>
                    <td>{p.recoveryCaller ?? p.owner}</td>
                    <td>
                      {p.recoveryCaller
                        ? "Weekly workload balancing; permanent owner unchanged"
                        : "Continuity of care with permanent caller"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            disabled={recoveryPublished}
            className="mt-5"
            onClick={() => {
              setRecoveryPublished(true);
              record(`Published weekly Recovery list with ${rows.length} people`);
              notify("Recovery list published to the demo team.");
            }}
          >
            <CheckCircle2 />
            {recoveryPublished ? "Weekly list published" : "Publish weekly list"}
          </Button>
        </>
      )}
    </>
  );
}
