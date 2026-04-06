import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { windLogRequestSchema } from "@/lib/windlog/schema";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const body = windLogRequestSchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { activityId, ...data } = body.data;

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, userId: session.user.id },
  });
  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  await prisma.windLog.upsert({
    where: { activityId },
    create: {
      activityId,
      sport: data.sport,
      sessionOutcome: data.sessionOutcome,
      sessionSuitability: data.sessionSuitability,
      feltWindStrength: data.feltWindStrength,
      feltWindDirection: data.feltWindDirection,
      gustiness: data.gustiness,
      visibility: data.visibility,
      hazardFlags: data.hazardFlags ?? [],
      snowSurface: data.sport === "kiteski" ? data.snowSurface : null,
      waterConditions: data.sport === "kitesurf" ? data.waterConditions : null,
      waveHeightBand: data.sport === "kitesurf" ? data.waveHeightBand : null,
    },
    update: {
      sport: data.sport,
      sessionOutcome: data.sessionOutcome,
      sessionSuitability: data.sessionSuitability,
      feltWindStrength: data.feltWindStrength,
      feltWindDirection: data.feltWindDirection,
      gustiness: data.gustiness,
      visibility: data.visibility,
      hazardFlags: data.hazardFlags ?? [],
      snowSurface: data.sport === "kiteski" ? data.snowSurface : null,
      waterConditions: data.sport === "kitesurf" ? data.waterConditions : null,
      waveHeightBand: data.sport === "kitesurf" ? data.waveHeightBand : null,
    },
  });

  const wl = await prisma.windLog.findUnique({ where: { activityId } });
  return NextResponse.json(wl);
}
