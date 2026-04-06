import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import type { Sport } from "@/generated/prisma";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  const uid = session?.user?.id ?? null;

  const url = new URL(req.url);
  const activeSport = (url.searchParams.get("activeSport") ?? "kiteski") as Sport;
  if (activeSport !== "kiteski" && activeSport !== "kitesurf") {
    return NextResponse.json({ error: "Invalid activeSport" }, { status: 400 });
  }

  const areas = await prisma.practiceArea.findMany({
    where:
      uid != null
        ? {
            sports: { has: activeSport },
            OR: [{ userId: uid }, { isPublic: true }],
          }
        : {
            sports: { has: activeSport },
            isPublic: true,
          },
  });

  const areaFeatures: Feature<Polygon>[] = areas.map((ar) => {
    const isOwn = uid != null && ar.userId === uid;
    return {
      type: "Feature",
      id: ar.id,
      geometry: ar.geojson as unknown as Polygon,
      properties: {
        id: ar.id,
        name: ar.name,
        sports: ar.sports,
        labelPreset: ar.labelPreset,
        windSectors: ar.windSectors ?? null,
        optimalWindFromDeg: ar.optimalWindFromDeg ?? null,
        isPublic: ar.isPublic,
        isOwn,
        /** 1 = someone else’s area (read-only in UI); MapLibre-friendly */
        isCommunity: isOwn ? 0 : 1,
      },
    };
  });

  const areasFc: FeatureCollection<Polygon> = {
    type: "FeatureCollection",
    features: areaFeatures,
  };

  return NextResponse.json({
    activeSport,
    practiceAreas: areasFc,
  });
}
