import { describe, expect, it } from "vitest";
import { classifySale } from "@/utils/stripe/attribution";

const EVENT_END = new Date("2026-07-26T12:00:00Z"); // The Borderland 2026

describe("classifySale", () => {
  it("puts the fall sale opening in fall", () => {
    expect(classifySale(new Date("2025-11-17T16:00:00Z"), EVENT_END)).toBe(
      "fall",
    );
  });

  it("puts the fall sale tail in fall, past the non-transferable window", () => {
    // 237 real payments ran from 2025-11-24 to 2025-12-07, after the
    // open_sale_non_transferable window closed on 2025-11-23.
    expect(classifySale(new Date("2025-12-07T10:00:00Z"), EVENT_END)).toBe(
      "fall",
    );
  });

  it("puts the spring sale opening in spring", () => {
    expect(classifySale(new Date("2026-03-01T09:00:00Z"), EVENT_END)).toBe(
      "spring",
    );
  });

  it("puts transfer-replacement purchases just before the burn in spring", () => {
    expect(classifySale(new Date("2026-07-13T20:00:00Z"), EVENT_END)).toBe(
      "spring",
    );
  });

  it("splits at Stockholm new year, not UTC", () => {
    // 2025-12-31T23:30Z is already 2026-01-01 00:30 in Stockholm (UTC+1)
    expect(classifySale(new Date("2025-12-31T23:30:00Z"), EVENT_END)).toBe(
      "spring",
    );
    expect(classifySale(new Date("2025-12-31T22:30:00Z"), EVENT_END)).toBe(
      "fall",
    );
  });
});
