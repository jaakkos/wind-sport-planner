import { describe, expect, it } from "vitest";
import { fmiProviderStub } from "@/lib/weather/providers/fmi";

describe("fmiProviderStub", () => {
  it("supports Helsinki coordinates", () => {
    expect(fmiProviderStub.supports(60.17, 24.94, new Date())).toBe(true);
  });

  it("does not support Canary Islands", () => {
    expect(fmiProviderStub.supports(28.1, -15.4, new Date())).toBe(false);
  });

  it("returns null historical until implemented", async () => {
    const r = await fmiProviderStub.fetchHistoricalSnapshot(60, 25, new Date());
    expect(r).toBeNull();
  });
});
