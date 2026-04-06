import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  upsert: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    activity: { findFirst: prismaMocks.findFirst },
    windLog: {
      upsert: prismaMocks.upsert,
      findUnique: prismaMocks.findUnique,
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

describe("POST /api/windlog", () => {
  beforeEach(() => {
    prismaMocks.findFirst.mockReset();
    prismaMocks.upsert.mockReset();
    prismaMocks.findUnique.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValue(null);

    const { POST } = await import("@/app/api/windlog/route");
    const res = await POST(
      new Request("http://localhost/api/windlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);

    const { POST } = await import("@/app/api/windlog/route");
    const res = await POST(
      new Request("http://localhost/api/windlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: "x", sport: "kiteski" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts wind log when activity exists", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);

    prismaMocks.findFirst.mockResolvedValue({
      id: "act1",
      userId: "u1",
    });
    prismaMocks.findUnique.mockResolvedValue({
      id: "wl1",
      activityId: "act1",
      sport: "kiteski",
    });

    const { POST } = await import("@/app/api/windlog/route");
    const body = {
      activityId: "act1",
      sport: "kiteski",
      sessionOutcome: "good",
      sessionSuitability: "suitable",
      feltWindStrength: "medium",
      feltWindDirection: "N",
      gustiness: "steady",
      visibility: "ok",
      hazardFlags: ["none"],
      snowSurface: "packed",
    };

    const res = await POST(
      new Request("http://localhost/api/windlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

    expect(res.status).toBe(200);
    expect(prismaMocks.upsert).toHaveBeenCalledOnce();
    const json = await res.json();
    expect(json.activityId).toBe("act1");
  });
});
