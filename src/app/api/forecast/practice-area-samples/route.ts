import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getPracticeAreaForecastSamples } from "@/lib/heuristics/practiceAreaForecastSamples";
import { isErrorResponse } from "@/lib/api/handler";
import {
  parseAtParam,
  parseOptimalWindHalfWidthDegParam,
  parseSportParam,
} from "@/lib/api/forecastQuery";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  const uid = session?.user?.id ?? null;

  const url = new URL(req.url);
  const areaId = url.searchParams.get("areaId")?.trim() ?? "";
  if (!areaId) {
    return NextResponse.json({ error: "Missing areaId" }, { status: 400 });
  }

  const sportRes = parseSportParam(url.searchParams);
  if (isErrorResponse(sportRes)) return sportRes;
  const { sport } = sportRes;
  const atRes = parseAtParam(url.searchParams);
  if (isErrorResponse(atRes)) return atRes;
  const { at } = atRes;
  const halfWRes = parseOptimalWindHalfWidthDegParam(url.searchParams);
  if (isErrorResponse(halfWRes)) return halfWRes;
  const { optimalMatchHalfWidthDeg } = halfWRes;

  const area = await prisma.practiceArea.findFirst({
    where: {
      id: areaId,
      sports: { has: sport },
      OR:
        uid != null
          ? [{ userId: uid }, { isPublic: true }]
          : [{ isPublic: true }],
    },
  });

  if (!area) {
    return NextResponse.json({ error: "Practice area not found" }, { status: 404 });
  }

  let rankingPreferencesJson: unknown;
  if (uid) {
    const u = await prisma.user.findUnique({
      where: { id: uid },
      select: { rankingPreferences: true },
    });
    rankingPreferencesJson = u?.rankingPreferences ?? undefined;
  }

  const result = await getPracticeAreaForecastSamples({
    area,
    sport,
    at,
    rankingPreferencesJson,
    userId: uid,
  });

  if (!result) {
    return NextResponse.json({ error: "Could not sample forecast" }, { status: 400 });
  }

  return NextResponse.json({
    ...result,
    optimalWindHalfWidthDeg: optimalMatchHalfWidthDeg,
  });
}
