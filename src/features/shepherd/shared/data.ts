import { SERVICE, type Person, type Post } from "./model";
const names = [
  "Amara Okafor",
  "Daniel Thompson",
  "Chidinma Nwachukwu-Adeyemi",
  "Samuel Mensah",
  "Isabella Williams",
  "Emmanuel Adebayo",
  "Sophie Bennett",
  "Michael Osei",
  "Blessing Eze",
  "David Richardson",
  "Temitope Oluwaseun-Akinwande",
  "Rebecca Clarke",
  "Joshua Adeyemi",
  "Faith Johnson",
  "Nathan Brooks",
  "Esther Akinola",
];
export const demoPeople: Person[] = names.map((name, i) => ({
  id: `p${i + 1}`,
  name,
  phone: i === 2 || i === 6 || i === 10 ? "" : "Demo number on file",
  owner: i < 8 ? "Odera" : i < 12 ? "Jeff" : "Edini",
  recoveryCaller: i === 2 ? "Jeff" : i === 5 ? "Grace" : undefined,
  attendance: [
    [true, true, false, false],
    [true, false, false, false],
    [true, true, true, false],
    [false, true, true, true],
    [true, false, true, true],
    [true, false, false, false],
    [false, true, false, true],
    [true, true, true, true],
  ][i % 8] ?? [true, true, true, true],
  outcome:
    (
      [
        "Callback",
        "No answer",
        "Will return",
        "Reached",
        "Reached",
        "No answer",
        "Callback",
        "Reached",
      ] as const
    )[i % 8] ?? "Reached",
  callback: i < 3 ? "2026-10-12" : i < 5 ? "2026-10-10" : "2026-10-15",
  notes: [
    {
      date: "9 Oct 2026 · 4:30 pm",
      text:
        i === 0
          ? "Lovely conversation. Settling into her new job and hoping to join us this Sunday. Call again on Monday."
          : "Checked in this week. Continue to keep in touch and offer support.",
    },
  ],
}));
function entry(i: number, came = false) {
  return {
    personId: `p${i + 1}`,
    name: names[i] ?? "Guest",
    attendance: came ? ("came" as const) : ("unknown" as const),
  };
}
export const demoPosts: Post[] = [
  {
    id: "odera",
    author: "Odera",
    time: "Saturday · 5:42 pm",
    service: SERVICE,
    note: "Looking forward to seeing everyone this Sunday 🌿",
    entries: [0, 1, 2, 3, 4, 5, 6, 7, 12, 13].map((i) => entry(i)),
    state: "Published",
  },
  {
    id: "jeff",
    author: "Jeff",
    time: "Saturday · 4:18 pm",
    service: SERVICE,
    note: "A few familiar faces and two new friends joining us.",
    entries: [0, 8, 9, 10, 11, 14, 15].map((i, n) => entry(i, n < 5)),
    state: "Results posted",
  },
  {
    id: "edini",
    author: "Edini",
    time: "Saturday · 3:06 pm",
    service: SERVICE,
    note: "",
    entries: [3, 12, 13, 14, 15].map((i, n) => entry(i, n < 4)),
    state: "Verified",
  },
];
export const demoUsers = [
  { name: "Odera", email: "odera@example.test", role: "Volunteer", active: true },
  { name: "Jeff", email: "jeff@example.test", role: "Volunteer", active: true },
  { name: "Edini", email: "edini@example.test", role: "Admin", active: true },
  { name: "Grace", email: "grace@example.test", role: "Volunteer", active: false },
];
