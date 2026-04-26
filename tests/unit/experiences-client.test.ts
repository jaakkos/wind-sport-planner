import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExperience, deleteExperience } from "@/lib/experiences/client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createExperience", () => {
  it("POSTs JSON payload to /api/experiences", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await createExperience({
      practiceAreaId: "a",
      sport: "kiteski",
      occurredAt: "2026-01-01T00:00:00Z",
      sessionSuitability: "great",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/experiences");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      practiceAreaId: "a",
      sport: "kiteski",
      occurredAt: "2026-01-01T00:00:00Z",
      sessionSuitability: "great",
    });
  });

  it("throws using the JSON `error` field when present", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "duplicate" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(
      createExperience({
        practiceAreaId: "a",
        sport: "kiteski",
        occurredAt: "x",
        sessionSuitability: "y",
      }),
    ).rejects.toThrow("duplicate");
  });

  it("falls back to HTTP <status> when neither JSON `error` nor body text is usable", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    await expect(
      createExperience({
        practiceAreaId: "a",
        sport: "kiteski",
        occurredAt: "x",
        sessionSuitability: "y",
      }),
    ).rejects.toThrow("HTTP 503");
  });
});

describe("deleteExperience", () => {
  it("DELETEs /api/experiences/<id>", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await deleteExperience("abc");
    expect(fetchMock).toHaveBeenCalledWith("/api/experiences/abc", {
      method: "DELETE",
    });
  });

  it("surfaces the JSON error message on non-OK", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(deleteExperience("missing")).rejects.toThrow("not found");
  });
});
