import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import type { Sport } from "@/generated/prisma";
import { rankPracticeAreas } from "@/lib/heuristics/rankAreas";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  const uid = session?.user?.id ?? null;

  const url = new URL(req.url);
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
}
