import prisma from "@/lib/prisma";
import type { Sport } from "@/generated/prisma/client";
import { AreaLabelPreset, Prisma } from "@/generated/prisma/client";
import {
  isErrorResponse,
  parseJsonBody,
  requireUserSession,
} from "@/lib/api/handler";
import { NextResponse } from "next/server";
import { z } from "zod";

const AREA_NAME_MAX = 120;

function normWindDeg(v: number): number {
  return ((v % 360) + 360) % 360;
}

const geoPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

const patchSchema = z
  .object({
    geojson: geoPolygon.optional(),
    name: z.string().max(AREA_NAME_MAX).optional(),
    sports: z.array(z.enum(["kiteski", "kitesurf"])).min(1).optional(),
    labelPreset: z.nativeEnum(AreaLabelPreset).optional(),
    windSectors: z
      .union([z.array(z.tuple([z.number(), z.number()])), z.null()])
      .optional(),
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
              u.optimalWindFromDeg === null ? null : normWindDeg(u.optimalWindFromDeg),
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
