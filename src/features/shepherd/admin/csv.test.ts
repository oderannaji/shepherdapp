import { describe, it, expect } from "vitest";
import { parseCsv, peopleImport } from "./csv";
import { consecutiveAbsences } from "../shared";
describe("reviewed imports", () => {
  it("reads BOM, quoted commas, escaped quotes, embedded newlines and CRLF", () => {
    expect(
      parseCsv('\uFEFFname,phone\r\n"Odera, Jr.",+447700900123\r\n"A ""quoted""\nname",\r\n'),
    ).toEqual([
      { name: "Odera, Jr.", phone: "+447700900123" },
      { name: 'A "quoted"\nname', phone: "" },
    ]);
  });
  it.each(["name,name\na,b", 'name,phone\n"Unclosed,123', "name,phone\nName,123,extra"])(
    "rejects malformed CSV before any save (%s)",
    (source) => expect(() => parseCsv(source)).toThrow(),
  );
  it("rejects invalid and duplicate phones instead of inventing phone formatting", () => {
    expect(() => peopleImport([{ name: "A", phone: "07700900123" }], "owner")).toThrow(
      /international/,
    );
    expect(() =>
      peopleImport(
        [
          { name: "A", phone: "+447700900123" },
          { name: "B", phone: "+447700900123" },
        ],
        "owner",
      ),
    ).toThrow(/duplicate/);
  });
});
describe("Recovery with incomplete registers", () => {
  it("counts only consecutive confirmed absences, newest service first", () => {
    expect(consecutiveAbsences(["absent", "absent", "came", "absent"])).toBe(2);
    expect(consecutiveAbsences(["absent", "unknown", "absent"])).toBe(1);
    expect(consecutiveAbsences(["unknown", "absent"])).toBe(0);
  });
});
