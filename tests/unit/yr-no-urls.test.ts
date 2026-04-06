import { describe, expect, it } from "vitest";
import { yrNoDailyTableUrlEn, yrNoHourlyTableUrlEn } from "@/lib/yrNoUrls";

describe("yrNo URLs", () => {
  it("builds hourly-table URL with 3dp coords (Yr format)", () => {
    expect(yrNoHourlyTableUrlEn(68.35, 27.25)).toBe(
      "https://www.yr.no/en/forecast/hourly-table/68.350,%2027.250",
    );
  });

  it("builds daily-table URL", () => {
    expect(yrNoDailyTableUrlEn(60.391, 5.324)).toBe(
      "https://www.yr.no/en/forecast/daily-table/60.391,%205.324",
    );
  });
});
