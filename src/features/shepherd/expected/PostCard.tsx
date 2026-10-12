import { Check, ArrowRight, CalendarDays, Pencil, CheckCircle2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo, Avatar, Status, alsoExpected, postTotals, type Post } from "../shared";

export function PostCard({
  post,
  onOpen,
  admin,
}: {
  post: Post;
  onOpen: () => void;
  admin: boolean;
}) {
  const { posts, role } = useDemo();
  const totals = postTotals(post);
  const mine = post.author === "Odera";
  const late = post.entries.filter((e) => e.late);
  return (
    <article className="post-card">
      <header>
        <Avatar name={post.author} />
        <div className="flex-1">
          <h2>
            {post.author}’s expected {mine && <span className="you-label">YOU</span>}
          </h2>
          <p>{post.time}</p>
        </div>
        <Status tone={post.state === "Published" ? "neutral" : "success"}>
          {post.state === "Verified" && <CheckCircle2 size={12} />} {post.state}
        </Status>
      </header>
      <div className="post-service">
        <CalendarDays size={14} />
        {post.service}
      </div>
      {post.note && <p className="post-note">{post.note}</p>}
      <ol className="expected-name-list">
        {post.entries
          .filter((e) => !e.late)
          .map((entry, i) => {
            const other = alsoExpected(
              posts.filter((p) => p.service === post.service),
              post,
              entry.personId,
            );
            return (
              <li key={entry.personId}>
                <span className="entry-number">{i + 1}.</span>
                <div>
                  <span>{entry.name}</span>
                  {other.length > 0 && (
                    <small>Also expected by {other.join(", ")} · Shared credit</small>
                  )}
                </div>
                <span
                  className={`feed-attendance ${entry.attendance === "came" ? "came" : "unknown"}`}
                  title={
                    entry.attendance === "came"
                      ? "Came"
                      : entry.attendance === "absent"
                        ? admin
                          ? "Absent"
                          : "Result recorded"
                        : "Not checked yet"
                  }
                >
                  {entry.attendance === "came" ? <Check size={14} /> : <span />}
                  <small>
                    {entry.attendance === "came"
                      ? "Came"
                      : entry.attendance === "absent"
                        ? admin
                          ? "Absent"
                          : "Result recorded"
                        : "Not checked yet"}
                  </small>
                </span>
              </li>
            );
          })}
      </ol>
      {late.length > 0 && (
        <div className="late-list">
          <Status>Late additions · {late.length}</Status>
          {late.map((e) => (
            <p key={e.personId}>
              {e.name} {e.attendance === "came" ? "· Came" : ""}
            </p>
          ))}
        </div>
      )}
      <footer>
        <span>
          {post.state === "Published" ? (
            <>
              <strong>{totals.expected}</strong> expected
            </>
          ) : (
            <>
              <strong>
                {post.author} — {totals.came} of {totals.expected} came
              </strong>
              {totals.late > 0 && ` + ${totals.late} late`}
            </>
          )}
        </span>
        <Button variant="ghost" onClick={onOpen}>
          {mine && post.state === "Published" ? (
            <>
              <Pencil size={15} />
              Edit / Post results
            </>
          ) : role === "Admin" ? (
            <>
              <Pencil size={15} />
              Correct records
            </>
          ) : (
            <>
              <Eye size={15} />
              View list
            </>
          )}
          <ArrowRight size={14} />
        </Button>
      </footer>
    </article>
  );
}
