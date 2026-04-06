import { NextResponse } from "next/server";

/**
 * Authenticated ping for Render cron or uptime checks.
 * Strava bulk sync was removed; reserved for future scheduled jobs.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  const authz = req.headers.get("authorization");
  if (authz !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, ran: "noop" });
}
