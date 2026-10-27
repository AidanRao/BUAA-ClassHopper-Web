import { describe, expect, it } from "vitest";
import {
  addDays,
  courseTime,
  safeReturnTo,
  today,
  validDate,
  weekDates,
  withinWindow,
} from "../src/lib/dates";
describe("Beijing dates and routing", () => {
  it("uses Shanghai for today and crosses week/month/year boundaries", () => {
    expect(today(new Date("2026-10-26T16:00:00Z"))).toBe("2026-10-27");
    expect(weekDates("2026-11-01")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2028-02-29")).toBe(true);
  });
  it("parses upstream zone-less times as Beijing and preserves inclusive boundaries", () => {
    expect(courseTime("2026-10-27 09:50:00")).toBe(
      Date.parse("2026-10-27T01:50:00Z"),
    );
    const course = {
      classBeginTime: "2026-10-27 09:50:00",
      classEndTime: "2026-10-27 10:35:00",
    };
    expect(withinWindow(course, Date.parse("2026-10-27T01:40:00Z"))).toBe(true);
    expect(withinWindow(course, Date.parse("2026-10-27T02:35:00Z"))).toBe(true);
    expect(withinWindow(course, Date.parse("2026-10-27T02:35:00.001Z"))).toBe(
      false,
    );
  });
  it("keeps local return paths and rejects redirects, control characters and auth loops", () => {
    expect(safeReturnTo("/schedule/2026-10-27/123?x=1")).toBe(
      "/schedule/2026-10-27/123?x=1",
    );
    for (const input of [
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "/oauth/callback",
      "/login",
      "/\nevil.example",
    ])
      expect(safeReturnTo(input)).toBe("/schedule");
  });
});
