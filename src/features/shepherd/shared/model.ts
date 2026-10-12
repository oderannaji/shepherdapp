export type Outcome =
  "Reached" | "No answer" | "Callback" | "Will return" | "Wrong number" | "Do not contact";
export type Attendance = "unknown" | "came" | "absent";
export type Person = {
  id: string;
  name: string;
  phone: string;
  owner: string;
  recoveryCaller?: string | undefined;
  attendance: boolean[];
  outcome: Outcome;
  callback: string;
  notes: { date: string; text: string }[];
};
export type Entry = { personId: string; name: string; attendance: Attendance; late?: boolean };
export type Post = {
  id: string;
  author: string;
  time: string;
  service: string;
  note: string;
  entries: Entry[];
  state: "Published" | "Results posted" | "Verified";
};
export const TODAY = "2026-10-12";
export const SERVICE = "Sunday, 18 October · 10:00 am";
export const SUNDAYS = ["20 Sep", "27 Sep", "4 Oct", "11 Oct"];
export const CALLERS = ["Odera", "Jeff", "Edini", "Grace"];
export const outcomes: Outcome[] = [
  "Reached",
  "No answer",
  "Callback",
  "Will return",
  "Wrong number",
  "Do not contact",
];
export function absenceLevel(person: Person) {
  let n = 0;
  for (const attended of [...person.attendance].reverse()) {
    if (attended) break;
    n++;
  }
  return n;
}
export function streak(person: Person) {
  const last = person.attendance.at(-1);
  let n = 0;
  for (const day of [...person.attendance].reverse()) {
    if (day !== last) break;
    n++;
  }
  return `${n} ${last ? "attended" : "missed"} in a row`;
}
export function postTotals(post: Post) {
  const original = post.entries.filter((e) => !e.late);
  return {
    expected: original.length,
    came: original.filter((e) => e.attendance === "came").length,
    late: post.entries.filter((e) => e.late && e.attendance === "came").length,
    unchecked: post.entries.filter((e) => e.attendance === "unknown").length,
    turnout: original.length
      ? Math.round((original.filter((e) => e.attendance === "came").length / original.length) * 100)
      : 0,
  };
}
export function churchTotals(posts: Post[]) {
  const expected = new Set<string>();
  const came = new Set<string>();
  posts.forEach((p) =>
    p.entries.forEach((e) => {
      if (!e.late) expected.add(e.personId);
      if (e.attendance === "came") came.add(e.personId);
    }),
  );
  return { expected: expected.size, came: came.size };
}
export function alsoExpected(posts: Post[], post: Post, personId: string) {
  return posts
    .filter((p) => p.id !== post.id && p.entries.some((e) => e.personId === personId))
    .map((p) => p.author);
}
export function canEditPost(post: Post, role: string, user: string, reason = "") {
  return role === "Admin"
    ? reason.trim().length > 0
    : post.author === user && post.state === "Published";
}
export function dueGroup(callback: string) {
  return callback < TODAY ? "Overdue" : callback === TODAY ? "Due today" : "Upcoming";
}
export function mergePersonReferences(
  posts: Post[],
  survivingId: string,
  removedId: string,
  name: string,
): Post[] {
  return posts.map((post) => {
    const entries: Entry[] = [];
    post.entries.forEach((entry) => {
      const next =
        entry.personId === removedId || entry.personId === survivingId
          ? { ...entry, personId: survivingId, name }
          : entry;
      const existing = entries.find((e) => e.personId === next.personId);
      if (!existing) entries.push(next);
      else if (next.attendance === "came") existing.attendance = "came";
    });
    return { ...post, entries };
  });
}
export function attendanceIssues(posts: Post[]) {
  const identities = new Map<
    string,
    { name: string; observations: { author: string; attendance: Attendance }[] }
  >();
  posts.forEach((post) =>
    post.entries.forEach((e) => {
      const current = identities.get(e.personId) ?? { name: e.name, observations: [] };
      current.observations.push({ author: post.author, attendance: e.attendance });
      identities.set(e.personId, current);
    }),
  );
  return [...identities]
    .filter(
      ([, v]) =>
        new Set(v.observations.map((o) => o.attendance)).size > 1 &&
        v.observations.some((o) => o.attendance !== "unknown"),
    )
    .map(([id, v]) => ({ id, ...v }));
}
