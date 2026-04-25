import prisma from "@/lib/prisma";
import type { Sport } from "@/generated/prisma/client";
import { AreaLabelPreset } from "@/generated/prisma/client";
import {
  isErrorResponse,
  parseJsonBody,
  requireUserSession,
} from "@/lib/api/handler";
import { NextResponse } from "next/server";
import { z } from "zod";

const geoPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

const AREA_NAME_MAX = 120;

function normWindDeg(v: number): number {
  return ((v % 360) + 360) % 360;
}

const postSchema = z.object({
  geojson: geoPolygon,
  sports: z.array(z.enum(["kiteski", "kitesurf"])).min(1),
  name: z.string().max(AREA_NAME_MAX).optional(),
  labelPreset: z.nativeEnum(AreaLabelPreset).optional(),
  windSectors: z.array(z.tuple([z.number(), z.number()])).nullable().optional(),
  optimalWindFromDeg: z.number().finite().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET() {
  const session = await requireUserSession();
  if (isErrorResponse(session)) return session;

  const areas = await prisma.practiceArea.findMany({
    where: { userId: session.userId },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(areas);
}

export async function POST(req: Request) {
  const session = await requireUserSession();
  if (isErrorResponse(session)) return session;

  const body = await parseJsonBody(req, postSchema);
  if (isErrorResponse(body)) return body;

  const d = body.data;
  const nameTrim = (d.name ?? "").trim().slice(0, AREA_NAME_MAX);
  const area = await prisma.practiceArea.create({
    data: {
      userId: session.userId,
      name: nameTrim,
      geojson: d.geojson,
      sports: d.sports as Sport[],
      labelPreset: d.labelPreset ?? AreaLabelPreset.other,
      windSectors: d.windSectors ?? undefined,
      optimalWindFromDeg:
        d.optimalWindFromDeg != null ? normWindDeg(d.optimalWindFromDeg) : undefined,
      isPublic: d.isPublic === true,
    },
  });

  return NextResponse.json(area);
}
