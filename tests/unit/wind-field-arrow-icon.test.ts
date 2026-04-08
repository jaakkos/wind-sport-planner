import { describe, expect, it } from "vitest";
import { windFieldArrowSvgMarkup } from "@/lib/map/windFieldArrowIcon";

describe("windFieldArrowSvgMarkup", () => {
  it("is SVG with north-pointing path and yr-adjacent blue fill", () => {
    const s = windFieldArrowSvgMarkup();
    expect(s).toContain("<svg");
    expect(s).toContain("viewBox=\"0 0 64 64\"");
    expect(s).toContain("#1d4ed8");
    expect(s).toMatch(/M32\s+10/);
  });
});
