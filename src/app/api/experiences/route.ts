import prisma from "@/lib/prisma";
import { centroidLngLatFromGeojson } from "@/lib/practiceArea/centroid";
import { openMeteoProvider } from "@/lib/weather/providers/openMeteo";
import type { Sport } from "@/generated/prisma/client";
import {
  isErrorResponse,
  parseJsonBody,
  requireUserSession,
} from "@/lib/api/handler";
import { NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  practiceAreaId: z.string().min(1),
  sport: z.enum(["kiteski", "kitesurf"]),
  occurredAt: z.string().min(1),
  sessionSuitability: z.enum(["unsuitable", "marginal", "suitable", "ideal"]),
});

export async function GET(req: Request) {
  const session = await requireUserSession();
  if (isErrorResponse(session)) return session;

  const url = new URL(req.url);
  const sport = url.searchParams.get("sport") as Sport | null;
  if (sport && sport !== "kiteski" && sport !== "kitesurf") {
    return NextResponse.json({ error: "Invalid sport" }, { status: 400 });
  }

  const rows = await prisma.sessionExperience.findMany({
    where: {
      userId: session.userId,
      ...(sport ? { sport } : {}),
    },
    include: { practiceArea: { select: { name: true } } },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    experiences: rows.map((e) => ({
      id: e.id,
      practiceAreaId: e.practiceAreaId,
      practiceAreaName: e.practiceArea.name || "Untitled area",
      sport: e.sport,
      occurredAt: e.occurredAt.toISOString(),
      sessionSuitability: e.sessionSuitability,
      windDirDeg: e.windDirDeg,
      windSpeedMs: e.windSpeedMs,
      gustMs: e.gustMs,
      weatherProviderId: e.weatherProviderId,
      weatherObservedAt: e.weatherObservedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await requireUserSession();
  if (isErrorResponse(session)) return session;

  const body = await parseJsonBody(req, postSchema);
  if (isErrorResponse(body)) return body;

  const { practiceAreaId, sport, sessionSuitability } = body.data;
  const occurredAt = new Date(body.data.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "Invalid occurredAt" }, { status: 400 });
  }

  const area = await prisma.practiceArea.findFirst({
    where: {
      id: practiceAreaId,
      OR: [{ userId: session.userId }, { isPublic: true }],
    },
  });
  if (!area) {
    return NextResponse.json(
      { error: "Practice area not found or not shared publicly" },
      { status: 404 },
    );
  }
  if (!area.sports.includes(sport)) {
    return NextResponse.json(
      { error: "This area is not tagged for the selected sport" },
      { status: 400 },
    );
  }

  const c = centroidLngLatFromGeojson(area.geojson);
  let windDirDeg: number | null = null;
  let windSpeedMs: number | null = null;
  let gustMs: number | null = null;
  let weatherProviderId: string | null = null;
  let weatherObservedAt: Date | null = null;

  if (c) {
    const snap = await openMeteoProvider.fetchHistoricalSnapshot(c.lat, c.lng, occurredAt);
    if (snap?.data) {
      windDirDeg = snap.data.windDirDeg;
      windSpeedMs = snap.data.windSpeedMs;
      gustMs = snap.data.gustMs;
      weatherProviderId = openMeteoProvider.id;
      weatherObservedAt = snap.data.observedAt;
    }
  }

  const created = await prisma.sessionExperience.create({
    data: {
      userId: session.userId,
      practiceAreaId,
      sport,
      occurredAt,
      sessionSuitability,
      windDirDeg,
      windSpeedMs,
      gustMs,
      weatherProviderId,
      weatherObservedAt,
    },
    include: { practiceArea: { select: { name: true } } },
  });

  return NextResponse.json({
    experience: {
      id: created.id,
      practiceAreaId: created.practiceAreaId,
      practiceAreaName: created.practiceArea.name || "Untitled area",
      sport: created.sport,
      occurredAt: created.occurredAt.toISOString(),
      sessionSuitability: created.sessionSuitability,
      windDirDeg: created.windDirDeg,
      windSpeedMs: created.windSpeedMs,
      gustMs: created.gustMs,
      weatherProviderId: created.weatherProviderId,
      weatherObservedAt: created.weatherObservedAt?.toISOString() ?? null,
    },
  });
}
