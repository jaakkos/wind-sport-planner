import { z } from "zod";

export const AREA_NAME_MAX = 120;

export function normalizeWindFromDeg(v: number): number {
  return ((v % 360) + 360) % 360;
}

/** GeoJSON Polygon shape accepted by /api/practice-areas. */
export const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

export const sportEnum = z.enum(["kiteski", "kitesurf"]);

export const windSectorsSchema = z
  .array(z.tuple([z.number(), z.number()]))
  .nullable();
