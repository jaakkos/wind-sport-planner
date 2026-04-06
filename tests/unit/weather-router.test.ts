import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHistoricalWithRouter } from "@/lib/weather/router";

describe("fetchHistoricalWithRouter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({
            hourly: {
              time: ["2024-06-15T12:00"],
              wind_speed_10m: [36],
              wind_direction_10m: [270],
              wind_gusts_10m: [43.2],
              temperature_2m: [12],
            },
          }),
        };
      }) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls through FMI stub and returns Open-Meteo snapshot", async () => {
    const r = await fetchHistoricalWithRouter(60.17, 24.94, new Date("2024-06-15T12:30:00Z"));
    expect(r).not.toBeNull();
    expect(r?.providerId).toBe("open_meteo");
    expect(r?.data.windSpeedMs).toBeCloseTo(10, 1);
  });
});
