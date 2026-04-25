import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { rankPracticeAreas } from "@/lib/heuristics/rankAreas";
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
  const sportRes = parseSportParam(url.searchParams);
  if (isErrorResponse(sportRes)) return sportRes;
  const { sport } = sportRes;
  const atRes = parseAtParam(url.searchParams);
  if (isErrorResponse(atRes)) return atRes;
  const { at } = atRes;
  const halfWRes = parseOptimalWindHalfWidthDegParam(url.searchParams);
  if (isErrorResponse(halfWRes)) return halfWRes;
  const { optimalMatchHalfWidthDeg } = halfWRes;

  const areas = await prisma.practiceArea.findMany({
    where:
      uid != null
        ? {
            sports: { has: sport },
            OR: [{ userId: uid }, { isPublic: true }],
          }
        : {
            sports: { has: sport },
            isPublic: true,
          },
  });

  let rankingPreferencesJson: unknown;
  if (uid) {
    const u = await prisma.user.findUnique({
      where: { id: uid },
      select: { rankingPreferences: true },
    });
    rankingPreferencesJson = u?.rankingPreferences ?? undefined;
  }

  try {
    const ranked = await rankPracticeAreas({
      userId: uid,
      sport,
      at,
      areas,
      optimalMatchHalfWidthDeg,
      rankingPreferencesJson,
    });

    return NextResponse.json({
      at: at.toISOString(),
      sport,
      optimalWindHalfWidthDeg: optimalMatchHalfWidthDeg,
      ranked,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ranking failed";
    console.error("[forecast/rank]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
