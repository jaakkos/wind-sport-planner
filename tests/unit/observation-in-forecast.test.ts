import { afterEach, describe, expect, it, vi } from "vitest";
import type { NormalizedWind } from "@/lib/weather/types";
import { pickHourClosestTo } from "@/lib/heuristics/multiPointForecast";

describe("Open-Meteo current observation in forecast series", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(payload: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => payload,
      })) as unknown as typeof fetch,
    );
  }

  it("inserts the current block as an observation entry in the hourly array", async () => {
    stubFetch({
      current: {
        time: "2026-01-15T14:30",
        wind_speed_10m: 18,
        wind_direction_10m: 225,
        wind_gusts_10m: 28.8,
        temperature_2m: 5.0,
        visibility: 20000,
      },
      hourly: {
        time: ["2026-01-15T14:00", "2026-01-15T15:00"],
        wind_speed_10m: [14.4, 18],
        wind_direction_10m: [220, 230],
        wind_gusts_10m: [25.2, 32.4],
        temperature_2m: [4, 6],
        visibility: [25000, 22000],
      },
    });

    const { openMeteoProvider } = await import(
      "@/lib/weather/providers/openMeteo"
    );
    const result = await openMeteoProvider.fetchForecastSeries(
      60.17,
      24.94,
      new Date("2026-01-15T00:00:00Z"),
      new Date("2026-01-16T00:00:00Z"),
    );

    expect(result).not.toBeNull();
    const obs = result!.hourly.filter((h) => h.isObservation === true);
    expect(obs).toHaveLength(1);
    expect(obs[0]!.observedAt).toEqual(new Date("2026-01-15T14:30:00Z"));
    expect(obs[0]!.windSpeedMs).toBeCloseTo(18 / 3.6, 2);
    expect(obs[0]!.windDirDeg).toBe(225);
    expect(obs[0]!.gustMs).toBeCloseTo(28.8 / 3.6, 2);
    expect(obs[0]!.visibilityM).toBe(20000);

    expect(result!.hourly.length).toBe(3);
    const forecastOnly = result!.hourly.filter((h) => !h.isObservation);
    expect(forecastOnly).toHaveLength(2);
  });

  it("handles missing current block gracefully", async () => {
    stubFetch({
      hourly: {
        time: ["2026-01-15T14:00", "2026-01-15T15:00"],
        wind_speed_10m: [14.4, 18],
        wind_direction_10m: [220, 230],
        wind_gusts_10m: [25.2, 32.4],
        temperature_2m: [4, 6],
        visibility: [25000, 22000],
      },
    });

    const { openMeteoProvider } = await import(
      "@/lib/weather/providers/openMeteo"
    );
    const result = await openMeteoProvider.fetchForecastSeries(
      60.17,
      24.94,
      new Date("2026-01-15T00:00:00Z"),
      new Date("2026-01-16T00:00:00Z"),
    );

    expect(result).not.toBeNull();
    expect(result!.hourly).toHaveLength(2);
    expect(result!.hourly.every((h) => !h.isObservation)).toBe(true);
  });

  it("inserts current at the end when its time follows all hourly entries", async () => {
    stubFetch({
      current: {
        time: "2026-01-15T15:45",
        wind_speed_10m: 10,
        wind_direction_10m: 180,
        wind_gusts_10m: 14.4,
        temperature_2m: 3,
        visibility: 30000,
      },
      hourly: {
        time: ["2026-01-15T14:00", "2026-01-15T15:00"],
        wind_speed_10m: [14.4, 18],
        wind_direction_10m: [220, 230],
        wind_gusts_10m: [25.2, 32.4],
        temperature_2m: [4, 6],
        visibility: [25000, 22000],
      },
    });

    const { openMeteoProvider } = await import(
      "@/lib/weather/providers/openMeteo"
    );
    const result = await openMeteoProvider.fetchForecastSeries(
      60.17,
      24.94,
      new Date("2026-01-15T00:00:00Z"),
      new Date("2026-01-16T00:00:00Z"),
    );

    expect(result).not.toBeNull();
    expect(result!.hourly).toHaveLength(3);
    const last = result!.hourly[2]!;
    expect(last.isObservation).toBe(true);
    expect(last.observedAt).toEqual(new Date("2026-01-15T15:45:00Z"));
  });
});

describe("Met.no observation marking", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function stubFetchMetNo(timeseries: Array<{ time: string; windSpeed: number; windDir: number; gust: number; temp: number }>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          properties: {
            timeseries: timeseries.map((s) => ({
              time: s.time,
              data: {
                instant: {
                  details: {
                    wind_speed: s.windSpeed,
                    wind_from_direction: s.windDir,
                    wind_speed_of_gust: s.gust,
                    air_temperature: s.temp,
                  },
                },
              },
            })),
          },
        }),
      })) as unknown as typeof fetch,
    );
  }

  it("marks entries within 90 min of now as observation", async () => {
    const now = new Date("2026-03-10T14:00:00Z");
    vi.useFakeTimers({ now });

    stubFetchMetNo([
      { time: "2026-03-10T13:00:00Z", windSpeed: 5, windDir: 180, gust: 8, temp: 2 },
      { time: "2026-03-10T14:00:00Z", windSpeed: 6, windDir: 190, gust: 9, temp: 3 },
      { time: "2026-03-10T15:00:00Z", windSpeed: 7, windDir: 200, gust: 10, temp: 4 },
      { time: "2026-03-10T20:00:00Z", windSpeed: 4, windDir: 170, gust: 6, temp: 1 },
    ]);

    const { metNoProvider } = await import("@/lib/weather/providers/metNo");
    const result = await metNoProvider.fetchForecastSeries(
      60.17, 24.94,
      new Date("2026-03-10T00:00:00Z"),
      new Date("2026-03-11T00:00:00Z"),
    );

    expect(result).not.toBeNull();
    const obs = result!.hourly.filter((h) => h.isObservation === true);
    expect(obs.length).toBeGreaterThanOrEqual(2);
    expect(obs.length).toBeLessThanOrEqual(3);

    const farFuture = result!.hourly.find(
      (h) => h.observedAt.getTime() === new Date("2026-03-10T20:00:00Z").getTime(),
    );
    expect(farFuture?.isObservation).toBeFalsy();
  });
});

describe("pickHourClosestTo observation preference", () => {
  function w(time: string, speed: number, isObs?: boolean): NormalizedWind {
    return {
      windSpeedMs: speed,
      windDirDeg: 180,
      gustMs: speed + 2,
      temperatureC: 5,
      visibilityM: null,
      observedAt: new Date(time),
      ...(isObs ? { isObservation: true } : {}),
    };
  }

  it("prefers the observation when equally close to target", () => {
    const target = new Date("2026-01-15T14:30:00Z").getTime();
    const forecast14 = w("2026-01-15T14:00:00Z", 5);
    const obs1430 = w("2026-01-15T14:30:00Z", 6, true);
    const forecast15 = w("2026-01-15T15:00:00Z", 7);

    const result = pickHourClosestTo([forecast14, obs1430, forecast15], target);
    expect(result).toBe(obs1430);
  });

  it("picks closer forecast over farther observation", () => {
    const target = new Date("2026-01-15T14:00:00Z").getTime();
    const forecast14 = w("2026-01-15T14:00:00Z", 5);
    const obs1430 = w("2026-01-15T14:30:00Z", 6, true);

    const result = pickHourClosestTo([forecast14, obs1430], target);
    expect(result).toBe(forecast14);
  });

  it("picks observation when it is the closest to target", () => {
    const target = new Date("2026-01-15T14:25:00Z").getTime();
    const forecast14 = w("2026-01-15T14:00:00Z", 5);
    const obs1430 = w("2026-01-15T14:30:00Z", 6, true);
    const forecast15 = w("2026-01-15T15:00:00Z", 7);

    const result = pickHourClosestTo([forecast14, obs1430, forecast15], target);
    expect(result).toBe(obs1430);
  });
});
