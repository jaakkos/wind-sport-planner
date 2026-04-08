import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getPracticeAreaForecastSamples } from "@/lib/heuristics/practiceAreaForecastSamples";
import type { Sport } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  const uid = session?.user?.id ?? null;

  const url = new URL(req.url);
  const areaId = url.searchParams.get("areaId")?.trim() ?? "";
  if (!areaId) {
    return NextResponse.json({ error: "Missing areaId" }, { status: 400 });
  }

  const sport = (url.searchParams.get("sport") ?? "kiteski") as Sport;
  if (sport !== "kiteski" && sport !== "kitesurf") {
    return NextResponse.json({ error: "Invalid sport" }, { status: 400 });
  }

  const atParam = url.searchParams.get("at");
  const at = atParam ? new Date(atParam) : new Date();
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "Invalid at" }, { status: 400 });
  }

  let optimalMatchHalfWidthDeg = 30;
  const hwParam = url.searchParams.get("optimalWindHalfWidthDeg");
  if (hwParam != null && hwParam !== "") {
    const h = Number(hwParam);
    if (!Number.isFinite(h)) {
      return NextResponse.json({ error: "Invalid optimalWindHalfWidthDeg" }, { status: 400 });
    }
    optimalMatchHalfWidthDeg = Math.min(90, Math.max(5, h));
  }

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
