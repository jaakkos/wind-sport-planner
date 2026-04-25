import type { Sport } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

/**
 * Parses a query string `sport` value (defaults to `kiteski`). Returns either
 * the resolved sport or a `400` response describing the invalid value.
 */
export function parseSportParam(
  searchParams: URLSearchParams,
  paramName = "sport",
): { sport: Sport } | NextResponse {
  const raw = (searchParams.get(paramName) ?? "kiteski") as Sport;
  if (raw !== "kiteski" && raw !== "kitesurf") {
    return NextResponse.json(
      { error: `Invalid ${paramName}` },
      { status: 400 },
    );
  }
  return { sport: raw };
}

/**
 * Parses a query string `at` (RFC3339 / ISO) timestamp, defaulting to "now".
 */
export function parseAtParam(
  searchParams: URLSearchParams,
): { at: Date } | NextResponse {
  const raw = searchParams.get("at");
  const at = raw ? new Date(raw) : new Date();
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "Invalid at" }, { status: 400 });
  }
  return { at };
}

/**
 * Parses the optional `optimalWindHalfWidthDeg` query param, clamped to
 * 5–90°. Returns the default (30) when absent.
 */
export function parseOptimalWindHalfWidthDegParam(
  searchParams: URLSearchParams,
): { optimalMatchHalfWidthDeg: number } | NextResponse {
  const raw = searchParams.get("optimalWindHalfWidthDeg");
  if (raw == null || raw === "") return { optimalMatchHalfWidthDeg: 30 };
  const h = Number(raw);
  if (!Number.isFinite(h)) {
    return NextResponse.json(
      { error: "Invalid optimalWindHalfWidthDeg" },
      { status: 400 },
    );
  }
  return { optimalMatchHalfWidthDeg: Math.min(90, Math.max(5, h)) };
}
