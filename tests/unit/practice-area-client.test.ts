import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPracticeArea,
  deletePracticeArea,
  patchPracticeArea,
} from "@/lib/practiceArea/client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function okResponse(body = "{}"): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("createPracticeArea", () => {
  it("POSTs JSON to /api/practice-areas and returns the response", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    const payload = {
      geojson: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      } satisfies GeoJSON.Polygon,
      sports: ["kiteski"],
      labelPreset: "lake",
      name: "Test",
    };
    const res = await createPracticeArea(payload);
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/practice-areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("throws with the response body on non-OK", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 400 }));
    await expect(
      createPracticeArea({
        geojson: { type: "Polygon", coordinates: [] },
        sports: [],
        labelPreset: "",
        name: "",
      }),
    ).rejects.toThrow("nope");
  });

  it("throws an HTTP <status> message when the body is empty", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(
      createPracticeArea({
        geojson: { type: "Polygon", coordinates: [] },
        sports: [],
        labelPreset: "",
        name: "",
      }),
    ).rejects.toThrow("HTTP 500");
  });
});

describe("patchPracticeArea", () => {
  it("PATCHes /api/practice-areas/<id>", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    await patchPracticeArea("abc", { name: "Renamed" });
    expect(fetchMock).toHaveBeenCalledWith("/api/practice-areas/abc", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });
  });
});

describe("deletePracticeArea", () => {
  it("DELETEs /api/practice-areas/<id>", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    await deletePracticeArea("xyz");
    expect(fetchMock).toHaveBeenCalledWith("/api/practice-areas/xyz", {
      method: "DELETE",
    });
  });
});
