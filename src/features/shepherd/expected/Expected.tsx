import { useState } from "react";
import { Plus, ArrowRight, CalendarDays, Trophy, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo, PageHeading, SERVICE, churchTotals, type Post } from "../shared";
import { PostCard } from "./PostCard";
import { Leaderboard } from "./Leaderboard";
import { ExpectedEditor } from "./ExpectedEditor";

export function Expected({ adminView = false }: { adminView?: boolean }) {
  const { posts, role, walkins } = useDemo();
  const [tab, setTab] = useState("Team feed");
  const [editor, setEditor] = useState<Post | null>(null);
  const [creating, setCreating] = useState(false);
  const [service, setService] = useState(SERVICE);
  const servicePosts = posts.filter((p) => p.service === service);
  const totals = churchTotals(servicePosts);
  const my = servicePosts.find((p) => p.author === "Odera");
  return (
    <>
      <PageHeading
        eyebrow={adminView ? "SUNDAY WORKSPACE" : "LET’S MAKE ROOM FOR EVERYONE"}
        title={adminView ? "Sunday view" : "Expected"}
        description="Personal invitations. Shared anticipation. One church family."
        action={
          <Button onClick={() => (my ? setEditor(my) : setCreating(true))}>
            <Plus />
            {my ? "Open my list" : "Create my list"}
          </Button>
        }
      />
      <div className="service-banner">
        <div>
          <CalendarDays size={22} />
          <div>
            <strong>{service}</strong>
            <p>Dominion City Manchester · Sunday service</p>
          </div>
        </div>
        <select
          aria-label="Expected service"
          value={service}
          onChange={(e) => setService(e.target.value)}
        >
          <option>{SERVICE}</option>
          <option>Sunday, 25 October · 10:00 am</option>
        </select>
      </div>
      <div className="expected-layout">
        <div>
          <div className="section-tabs expected-tabs">
            {["Team feed", "My list", "Leaderboard"].map((t) => (
              <Button
                variant="ghost"
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t === "Leaderboard" && <Trophy size={15} />} {t}
              </Button>
            ))}
          </div>
          {tab === "Leaderboard" ? (
            <Leaderboard posts={servicePosts} />
          ) : (
            <div className="feed">
              {(tab === "My list"
                ? servicePosts.filter((p) => p.author === "Odera")
                : servicePosts
              ).map((p) => (
                <PostCard key={p.id} post={p} onOpen={() => setEditor(p)} admin={adminView} />
              ))}
              {(tab === "My list" && !my) || servicePosts.length === 0 ? (
                <div className="empty-state">
                  <CalendarDays size={34} />
                  <h3>Your invitation starts here</h3>
                  <p>Gather a few names for this Sunday’s service.</p>
                  <Button onClick={() => setCreating(true)}>
                    <Plus />
                    Create my list
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
        <aside className="right-rail">
          <div className="church-target">
            <span className="target-icon">
              <Users size={24} />
            </span>
            <div className="eyebrow">TOGETHER THIS SUNDAY</div>
            <h2>
              {totals.expected}
              <span> / 30</span>
            </h2>
            <p>unique people expected</p>
            <div className="target-progress">
              <progress max="30" value={totals.expected} />
            </div>
            <div className="target-label">
              <strong>{Math.round((totals.expected / 30) * 100)}% of our shared target</strong>
              <span>30 people</span>
            </div>
            <div className="target-bottom">
              <CheckCircle2 size={17} />
              <strong>{totals.came + walkins.length}</strong> arrivals recorded so far
            </div>
            <small>
              People on multiple lists are counted once.
              {walkins.length > 0 && ` ${walkins.length} walk-ins are included separately.`}
            </small>
          </div>
          <div className="week-focus">
            <div className="rail-heading">
              <Trophy size={19} />
              <h3>A little encouragement</h3>
            </div>
            <p>Every invitation matters. Celebrate the connections, not just the numbers.</p>
            <Button variant="link" onClick={() => setTab("Leaderboard")}>
              View this week’s scoreboard
              <ArrowRight size={15} />
            </Button>
          </div>
          <div className="feed-legend">
            <h3>Attendance at a glance</h3>
            <p>
              <CheckCircle2 size={15} className="text-primary" />
              Came
            </p>
            <p>
              <span className="unknown-dot" />
              Not checked yet
            </p>
            <small>
              Only explicit results count. Unchecked people are never marked absent automatically.
            </small>
          </div>
        </aside>
      </div>
      {(editor || creating) && (
        <ExpectedEditor
          initial={editor}
          service={service}
          onClose={() => {
            setEditor(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}
