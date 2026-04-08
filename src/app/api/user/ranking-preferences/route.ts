import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { RankingPreferencesDoc } from "@/lib/heuristics/rankingPreferences";
import {
  defaultRankingPreferencesResponse,
  multiPointForecastPrefsSchema,
  parseRankingPreferencesDoc,
  rankingPreferencesDocSchema,
  sportRankingPrefsSchema,
} from "@/lib/heuristics/rankingPreferences";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchBodySchema = z
  .object({
    kiteski: z.union([sportRankingPrefsSchema.partial(), z.null()]).optional(),
    kitesurf: z.union([sportRankingPrefsSchema.partial(), z.null()]).optional(),
    multiPointForecast: z
      .union([multiPointForecastPrefsSchema.partial(), z.null()])
      .optional(),
  })
  .strict();

function mergeRankingPreferences(
  existingRaw: unknown,
  patch: z.infer<typeof patchBodySchema>,
): { ok: true; doc: RankingPreferencesDoc | null } | { ok: false; error: z.ZodError } {
  const existing = parseRankingPreferencesDoc(existingRaw);
  const next: Record<string, unknown> = existing ? { ...existing } : {};
  for (const sport of ["kiteski", "kitesurf"] as const) {
    if (!(sport in patch)) continue;
    const p = patch[sport];
    if (p === null) {
      delete next[sport];
      continue;
    }
    const prev = (existing?.[sport] ?? {}) as Record<string, unknown>;
    next[sport] = { ...prev, ...p };
  }
  if ("multiPointForecast" in patch) {
    const mp = patch.multiPointForecast;
    if (mp === null) {
      delete next.multiPointForecast;
    } else {
      const prev = (existing?.multiPointForecast ?? {}) as Record<string, unknown>;
      next.multiPointForecast = { ...prev, ...mp };
    }
  }
  if (Object.keys(next).length === 0) return { ok: true, doc: null };
  const validated = rankingPreferencesDocSchema.safeParse(next);
  if (!validated.success) return { ok: false, error: validated.error };
  return { ok: true, doc: validated.data };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { rankingPreferences: true },
  });

  const doc = parseRankingPreferencesDoc(user?.rankingPreferences ?? null);

  return NextResponse.json({
    doc,
    ...defaultRankingPreferencesResponse(),
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { rankingPreferences: true },
  });

  const merged = mergeRankingPreferences(user?.rankingPreferences ?? null, parsed.data);
  if (!merged.ok) {
    return NextResponse.json(
      { error: "Invalid merged preferences", details: merged.error.flatten() },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      rankingPreferences:
        merged.doc === null ? Prisma.DbNull : (merged.doc as Prisma.InputJsonValue),
    },
  });

  return NextResponse.json({
    doc: merged.doc,
    ...defaultRankingPreferencesResponse(),
  });
}
