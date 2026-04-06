import { z } from "zod";

const sessionOutcome = z.enum([
  "would_not_repeat",
  "marginal",
  "good",
  "excellent",
]);
const sessionSuitability = z.enum(["unsuitable", "marginal", "suitable", "ideal"]);
const feltWindStrength = z.enum(["low", "medium", "high", "very_high"]);
const feltWindDirection = z.enum([
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
]);
const gustiness = z.enum(["steady", "moderate_gusts", "strong_gusts"]);
const visibility = z.enum(["poor", "ok", "good"]);
const snowSurface = z.enum(["hard_icy", "packed", "soft", "variable"]);
const waterConditions = z.enum(["flat", "chop", "waves_small", "waves_large"]);
const waveHeightBand = z.enum(["ankle", "waist", "overhead"]);
const hazard = z.enum([
  "none",
  "thin_ice",
  "open_water_nearby",
  "crowded_track",
  "strong_current",
  "reef",
]);

const base = z.object({
  sessionOutcome: sessionOutcome,
  sessionSuitability: sessionSuitability,
  feltWindStrength: feltWindStrength,
  feltWindDirection: feltWindDirection,
  gustiness: gustiness,
  visibility: visibility,
  hazardFlags: z.array(hazard).default([]),
});

export const windLogKiteskiSchema = base.extend({
  sport: z.literal("kiteski"),
  snowSurface: snowSurface,
});

export const windLogKitesurfSchema = base.extend({
  sport: z.literal("kitesurf"),
  waterConditions: waterConditions,
  waveHeightBand: waveHeightBand,
});

export const windLogSchema = z.discriminatedUnion("sport", [
  windLogKiteskiSchema,
  windLogKitesurfSchema,
]);

export const windLogRequestSchema = z
  .object({ activityId: z.string().min(1) })
  .and(windLogSchema);

export type WindLogRequest = z.infer<typeof windLogRequestSchema>;
