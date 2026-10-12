import { describe, expect, it } from "vitest";
import {
  absenceLevel,
  churchTotals,
  postTotals,
  alsoExpected,
  canEditPost,
  mergePersonReferences,
  attendanceIssues,
  type Post,
} from "./model";
import { demoPeople } from "./data";
const post: Post = {
  id: "a",
  author: "Odera",
  time: "Now",
  service: "Sunday",
  note: "",
  state: "Published",
  entries: [
    { personId: "p1", name: "Amara", attendance: "came" },
    { personId: "p2", name: "Daniel", attendance: "unknown" },
    { personId: "p3", name: "Sophie", attendance: "absent" },
  ],
};
describe("Shepherd attendance rules", () => {
  it("unticked entries remain unknown and do not count as came", () => {
    expect(postTotals(post).unchecked).toBe(1);
    expect(post.entries[1]?.attendance).toBe("unknown");
    expect(postTotals(post).came).toBe(1);
  });
  it("counts a shared person once in church totals", () => {
    const other = {
      ...post,
      id: "b",
      author: "Jeff",
      entries: [{ personId: "p1", name: "Amara", attendance: "came" as const }],
    };
    expect(churchTotals([post, other])).toEqual({ expected: 3, came: 1 });
    expect(alsoExpected([post, other], post, "p1")).toEqual(["Jeff"]);
  });
  it("keeps late arrivals outside original expected and turnout", () => {
    const late = {
      ...post,
      entries: [
        ...post.entries,
        { personId: "g1", name: "Guest", attendance: "came" as const, late: true },
      ],
    };
    expect(postTotals(late)).toMatchObject({ expected: 3, came: 1, late: 1, turnout: 33 });
    expect(churchTotals([late])).toEqual({ expected: 3, came: 2 });
  });
  it("prevents volunteers from editing another caller’s list", () => {
    expect(canEditPost(post, "Volunteer", "Jeff")).toBe(false);
    expect(canEditPost(post, "Volunteer", "Odera")).toBe(true);
  });
  it("requires a reason for admin corrections", () => {
    expect(canEditPost(post, "Admin", "Edini", "  ")).toBe(false);
    expect(canEditPost(post, "Admin", "Edini", "Confirmed check-in")).toBe(true);
  });
  it("locks published results for volunteers", () => {
    expect(canEditPost({ ...post, state: "Results posted" }, "Volunteer", "Odera")).toBe(false);
  });
  it("counts three, two and one consecutive absences accurately", () => {
    const person = demoPeople[0];
    if (!person) throw new Error("Missing demo person");
    expect(absenceLevel({ ...person, attendance: [true, false, false, false] })).toBe(3);
    expect(absenceLevel({ ...person, attendance: [true, true, false, false] })).toBe(2);
    expect(absenceLevel({ ...person, attendance: [true, true, true, false] })).toBe(1);
  });
  it("merges duplicate identities across Expected posts without double counting", () => {
    const merged = mergePersonReferences([post], "p1", "p2", "Amara");
    expect(merged[0]?.entries.length).toBe(2);
    expect(churchTotals(merged)).toEqual({ expected: 2, came: 1 });
  });
  it("flags contradictory attendance observations for reconciliation", () => {
    const other = {
      ...post,
      id: "b",
      author: "Jeff",
      entries: [{ personId: "p1", name: "Amara", attendance: "absent" as const }],
    };
    expect(attendanceIssues([post, other]).map((i) => i.id)).toEqual(["p1"]);
  });
});
