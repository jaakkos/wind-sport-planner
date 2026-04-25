import prisma from "@/lib/prisma";
import type { Sport } from "@/generated/prisma/client";
import { AreaLabelPreset, Prisma } from "@/generated/prisma/client";
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

const patchSchema = z
  .object({
    geojson: polygonSchema.optional(),
    name: z.string().max(AREA_NAME_MAX).optional(),
    sports: z.array(sportEnum).min(1).optional(),
    labelPreset: z.nativeEnum(AreaLabelPreset).optional(),
    windSectors: windSectorsSchema.optional(),
    optimalWindFromDeg: z.union([z.number().finite(), z.null()]).optional(),
    isPublic: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.geojson != null ||
      d.name !== undefined ||
      d.sports != null ||
      d.labelPreset != null ||
      d.windSectors !== undefined ||
      d.optimalWindFromDeg !== undefined ||
      d.isPublic !== undefined,
    { message: "Provide at least one field to update" },
  );

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireUserSession();
  if (isErrorResponse(session)) return session;
  const { id } = await ctx.params;

  const existing = await prisma.practiceArea.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await parseJsonBody(req, patchSchema);
  if (isErrorResponse(body)) return body;

  const u = body.data;
  const updated = await prisma.practiceArea.update({
    where: { id },
    data: {
      ...(u.geojson != null ? { geojson: u.geojson } : {}),
      ...(u.name !== undefined ? { name: u.name.trim().slice(0, AREA_NAME_MAX) } : {}),
      ...(u.sports != null ? { sports: u.sports as Sport[] } : {}),
      ...(u.labelPreset != null ? { labelPreset: u.labelPreset } : {}),
      ...(u.windSectors !== undefined
        ? {
            windSectors:
              u.windSectors === null
                ? Prisma.DbNull
                : (u.windSectors as Prisma.InputJsonValue),
          }
        : {}),
      ...(u.optimalWindFromDeg !== undefined
        ? {
            optimalWindFromDeg:
              u.optimalWindFromDeg === null
                ? null
                : normalizeWindFromDeg(u.optimalWindFromDeg),
          }
        : {}),
      ...(u.isPublic !== undefined ? { isPublic: u.isPublic } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireUserSession();
  if (isErrorResponse(session)) return session;
  const { id } = await ctx.params;
  const a = await prisma.practiceArea.findFirst({
    where: { id, userId: session.userId },
  });
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.practiceArea.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
