import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  parseAtParam,
  parseOptimalWindHalfWidthDegParam,
  parseSportParam,
} from "@/lib/api/forecastQuery";

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

async function readJson(r: NextResponse): Promise<unknown> {
  return JSON.parse(await r.text());
}

describe("parseSportParam", () => {
  it("defaults to kiteski when the param is missing", () => {
    const result = parseSportParam(params(""));
    expect(result).toEqual({ sport: "kiteski" });
  });

  it("accepts kitesurf", () => {
    const result = parseSportParam(params("sport=kitesurf"));
    expect(result).toEqual({ sport: "kitesurf" });
  });

  it("returns a 400 NextResponse for unknown values", async () => {
    const result = parseSportParam(params("sport=skate"));
    expect(result).toBeInstanceOf(NextResponse);
    const r = result as NextResponse;
    expect(r.status).toBe(400);
    expect(await readJson(r)).toEqual({ error: "Invalid sport" });
  });

  it("uses the override param name when provided", async () => {
    const result = parseSportParam(params("activity=skate"), "activity");
    expect(result).toBeInstanceOf(NextResponse);
    expect(await readJson(result as NextResponse)).toEqual({
      error: "Invalid activity",
    });
  });
});

describe("parseAtParam", () => {
  it("returns a Date from a valid ISO string", () => {
    const result = parseAtParam(params("at=2026-01-02T03:04:05Z"));
    expect(result).toHaveProperty("at");
    const at = (result as { at: Date }).at;
    expect(at.toISOString()).toBe("2026-01-02T03:04:05.000Z");
  });

  it("defaults to 'now' when omitted", () => {
    const before = Date.now();
    const result = parseAtParam(params(""));
    const after = Date.now();
    expect(result).toHaveProperty("at");
    const t = (result as { at: Date }).at.getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });

  it("returns a 400 NextResponse for an unparseable date", async () => {
    const result = parseAtParam(params("at=not-a-date"));
    expect(result).toBeInstanceOf(NextResponse);
    const r = result as NextResponse;
    expect(r.status).toBe(400);
    expect(await readJson(r)).toEqual({ error: "Invalid at" });
  });
});

describe("parseOptimalWindHalfWidthDegParam", () => {
  it("returns the default (30) when absent", () => {
    expect(parseOptimalWindHalfWidthDegParam(params(""))).toEqual({
      optimalMatchHalfWidthDeg: 30,
    });
  });

  it("returns the default when blank", () => {
    expect(
      parseOptimalWindHalfWidthDegParam(params("optimalWindHalfWidthDeg=")),
    ).toEqual({ optimalMatchHalfWidthDeg: 30 });
  });

  it("clamps to [5, 90]", () => {
    expect(
      parseOptimalWindHalfWidthDegParam(
        params("optimalWindHalfWidthDeg=1"),
      ),
    ).toEqual({ optimalMatchHalfWidthDeg: 5 });
    expect(
      parseOptimalWindHalfWidthDegParam(
        params("optimalWindHalfWidthDeg=180"),
      ),
    ).toEqual({ optimalMatchHalfWidthDeg: 90 });
  });

  it("preserves valid values inside the range", () => {
    expect(
      parseOptimalWindHalfWidthDegParam(
        params("optimalWindHalfWidthDeg=42"),
      ),
    ).toEqual({ optimalMatchHalfWidthDeg: 42 });
  });

  it("rejects non-finite values with a 400", async () => {
    const result = parseOptimalWindHalfWidthDegParam(
      params("optimalWindHalfWidthDeg=not-a-number"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect(await readJson(result as NextResponse)).toEqual({
      error: "Invalid optimalWindHalfWidthDeg",
    });
  });
});
