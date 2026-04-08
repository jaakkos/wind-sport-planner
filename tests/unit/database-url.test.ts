import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "@/lib/database-url";

describe("resolveDatabaseUrl", () => {
  it("returns DATABASE_URL when provided", () => {
    const env = {
      DATABASE_URL: "postgresql://wind:wind@localhost:5432/wind_sport",
    } as NodeJS.ProcessEnv;

    expect(resolveDatabaseUrl(env)).toBe("postgresql://wind:wind@localhost:5432/wind_sport");
  });

  it("falls back to build-safe dummy URL when DATABASE_URL is missing", () => {
    expect(resolveDatabaseUrl({} as NodeJS.ProcessEnv)).toBe(
      "postgresql://build:build@127.0.0.1:5432/build?schema=public",
    );
  });
});
