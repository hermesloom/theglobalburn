import { describe, expect, it } from "vitest";
import {
  EVENT_START_DATES,
  getEventStartDate,
  ageAt,
  toAgeDistribution,
} from "@/app/api/_common/age";
import { Project } from "@/utils/types";

// Only the burn_config fields these helpers read matter; the rest of Project
// is irrelevant here, so build a minimal stub and cast.
const projectWith = (burnConfig: Record<string, unknown>) =>
  ({ burn_config: burnConfig }) as unknown as Project;

describe("EVENT_START_DATES", () => {
  it("holds the known burn start dates", () => {
    expect(EVENT_START_DATES).toEqual({
      2026: "2026-07-18",
      2027: "2027-07-24",
    });
  });
});

describe("getEventStartDate", () => {
  it("derives the start date from event_end_date's year", () => {
    const result = getEventStartDate(
      projectWith({ event_end_date: "2026-07-26" }),
    );
    expect(result?.toISOString().slice(0, 10)).toBe("2026-07-18");
  });

  it("falls back to open_sale_general_starting_at when there is no end date", () => {
    const result = getEventStartDate(
      projectWith({ open_sale_general_starting_at: "2027-02-01T10:00:00Z" }),
    );
    expect(result?.toISOString().slice(0, 10)).toBe("2027-07-24");
  });

  it("returns null when neither date is configured", () => {
    expect(getEventStartDate(projectWith({}))).toBeNull();
  });

  it("returns null for a year with no known start date", () => {
    expect(
      getEventStartDate(projectWith({ event_end_date: "2031-07-26" })),
    ).toBeNull();
  });
});

describe("ageAt", () => {
  it("computes age on the reference date", () => {
    expect(ageAt("1990-01-15", new Date("2026-07-18"))).toBe(36);
  });

  it("does not count a birthday that has not happened yet by the reference date", () => {
    expect(ageAt("1990-12-15", new Date("2026-07-18"))).toBe(35);
  });

  it("counts a birthday falling exactly on the reference date", () => {
    expect(ageAt("1990-07-18", new Date("2026-07-18"))).toBe(36);
  });

  it("returns null for an empty birthdate", () => {
    expect(ageAt("", new Date("2026-07-18"))).toBeNull();
  });

  it("returns null for an unparseable birthdate", () => {
    expect(ageAt("not-a-date", new Date("2026-07-18"))).toBeNull();
  });

  it("measures against today when the reference date is null", () => {
    const now = new Date();
    const birth = new Date(
      Date.UTC(now.getUTCFullYear() - 30, now.getUTCMonth(), 1),
    );
    expect(ageAt(birth.toISOString().slice(0, 10), null)).toBe(30);
  });
});

describe("toAgeDistribution", () => {
  it("returns an empty array for an empty map", () => {
    expect(toAgeDistribution({})).toEqual([]);
  });

  it("returns a single entry unchanged", () => {
    expect(toAgeDistribution({ 30: 4 })).toEqual([{ age: 30, count: 4 }]);
  });

  it("fills gaps between the minimum and maximum age with zeros", () => {
    expect(toAgeDistribution({ 25: 2, 27: 1 })).toEqual([
      { age: 25, count: 2 },
      { age: 26, count: 0 },
      { age: 27, count: 1 },
    ]);
  });

  it("sorts numerically rather than lexicographically", () => {
    expect(toAgeDistribution({ 9: 1, 10: 2, 11: 3 })).toEqual([
      { age: 9, count: 1 },
      { age: 10, count: 2 },
      { age: 11, count: 3 },
    ]);
  });
});
