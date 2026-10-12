import { CheckCircle2 } from "lucide-react";
import { useDemo, PageHeading, Status } from "../shared";

export function Audit() {
  const { audit } = useDemo();
  return (
    <>
      <PageHeading
        title="Audit activity"
        description="An understandable history of the important changes."
      />
      <div className="audit-list">
        {audit.map((event, i) => (
          <div key={i}>
            <span className="audit-icon">
              <CheckCircle2 size={19} />
            </span>
            <p>{event}</p>
            <Status>Demo</Status>
          </div>
        ))}
      </div>
    </>
  );
}
