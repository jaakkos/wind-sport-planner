import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Returns the authed user id or a `401` response. Callers should early-return
 * the response when `isErrorResponse(...)` matches, otherwise use `.userId`.
 */
export async function requireUserSession(): Promise<
  { userId: string } | NextResponse
> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId: session.user.id };
}

/**
 * Reads the JSON body and validates it with the supplied Zod schema. Returns
 * either the parsed payload or an appropriate `400` response.
 */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  return { data: parsed.data };
}

export function isErrorResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}
