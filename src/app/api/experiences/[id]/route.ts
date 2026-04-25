import prisma from "@/lib/prisma";
import { isErrorResponse, requireUserSession } from "@/lib/api/handler";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireUserSession();
  if (isErrorResponse(session)) return session;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const row = await prisma.sessionExperience.findFirst({
    where: { id, userId: session.userId },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.sessionExperience.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
