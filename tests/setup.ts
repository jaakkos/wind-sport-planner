/**
 * Global test setup — extend here if you add MSW, fake timers, etc.
 */
import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
