import { afterEach, describe, expect, it } from "vitest";

describe("POST /api/cron/sync", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("returns 503 when CRON_SECRET unset", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("@/app/api/cron/sync/route");
    const res = await POST(new Request("http://localhost/api/cron/sync", { method: "POST" }));
    expect(res.status).toBe(503);
  });

  it("returns 403 without bearer token", async () => {
    process.env.CRON_SECRET = "secret-for-tests";
    const { POST } = await import("@/app/api/cron/sync/route");
    const res = await POST(new Request("http://localhost/api/cron/sync", { method: "POST" }));
    expect(res.status).toBe(403);
  });

  it("returns 200 noop with valid bearer", async () => {
    process.env.CRON_SECRET = "secret-for-tests";
    const { POST } = await import("@/app/api/cron/sync/route");
    const res = await POST(
      new Request("http://localhost/api/cron/sync", {
        method: "POST",
        headers: { Authorization: "Bearer secret-for-tests" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.ran).toBe("noop");
  });
});
