import prisma from "@/lib/prisma";
import type { Sport } from "@/generated/prisma/client";
import { AreaLabelPreset } from "@/generated/prisma/client";
import {
  isErrorResponse,
  parseJsonBody,
  requireUserSession,
} from "@/lib/api/handler";
import {
  AREA_NAME_MAX,
  normalizeWindFromDeg,
  polygonSchema,
  sportEnum,
  windSectorsSchema,
} from "@/lib/practiceArea/schema";
import { NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  geojson: polygonSchema,
  sports: z.array(sportEnum).min(1),
  name: z.string().max(AREA_NAME_MAX).optional(),
  labelPreset: z.nativeEnum(AreaLabelPreset).optional(),
  windSectors: windSectorsSchema.optional(),
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
        d.optimalWindFromDeg != null
          ? normalizeWindFromDeg(d.optimalWindFromDeg)
          : undefined,
      isPublic: d.isPublic === true,
    },
  });

  return NextResponse.json(area);
}
