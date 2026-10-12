import { Trophy } from "lucide-react";
import { Avatar, postTotals, type Post } from "../shared";

export function Leaderboard({ posts }: { posts: Post[] }) {
  return (
    <section className="leaderboard">
      <div className="section-title">
        <div>
          <h2>This week’s scoreboard</h2>
          <p className="text-muted-foreground">Celebrating every invitation and connection.</p>
        </div>
        <Trophy className="text-primary" />
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Caller</th>
              <th>Expected</th>
              <th>Came</th>
              <th>Turnout</th>
            </tr>
          </thead>
          <tbody>
            {[...posts]
              .sort((a, b) => postTotals(b).came - postTotals(a).came)
              .map((p) => {
                const t = postTotals(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={p.author} small />
                        <div>
                          <strong>{p.author}</strong>
                          {p.author === "Jeff" && (
                            <small className="personal-best">
                              <Trophy size={11} />
                              Personal best
                            </small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{t.expected}</td>
                    <td>
                      {t.came}
                      {t.late > 0 && <small> +{t.late} late</small>}
                    </td>
                    <td>
                      <strong>{t.turnout}%</strong>
                      {p.state === "Published" && <small>Results pending</small>}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p className="score-note">
        Shared entries receive shared, unresolved caller credit. Church totals count each person
        once; caller rows can overlap. Late arrivals are shown separately.
      </p>
    </section>
  );
}
