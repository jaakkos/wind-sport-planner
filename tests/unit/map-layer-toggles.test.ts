import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  defaultMapLayerToggles,
  readMapLayerTogglesFromStorage,
  writeMapLayerTogglesToStorage,
} from "@/lib/map/mapLayerToggles";

const STORAGE_KEY = "mapHub.layerOverlays";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(): string | null {
    return null;
  }

  get length(): number {
    return this.store.size;
  }
}

let originalWindow: typeof globalThis.window | undefined;
let originalLocalStorage: Storage | undefined;
let storage: MemoryStorage;

beforeEach(() => {
  originalWindow = globalThis.window;
  originalLocalStorage = globalThis.localStorage;
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage } as unknown as Window & typeof globalThis,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage as unknown as Storage,
  });
});

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
  if (originalLocalStorage === undefined) {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  } else {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});

describe("defaultMapLayerToggles", () => {
  it("starts with every overlay enabled", () => {
    expect(defaultMapLayerToggles()).toEqual({
      windArrows: true,
      forecastSampleDots: true,
      areaLabels: true,
    });
  });
});

describe("readMapLayerTogglesFromStorage", () => {
  it("returns defaults when nothing is stored", () => {
    expect(readMapLayerTogglesFromStorage()).toEqual(defaultMapLayerToggles());
  });

  it("returns defaults when stored JSON is malformed", () => {
    storage.setItem(STORAGE_KEY, "{not json");
    expect(readMapLayerTogglesFromStorage()).toEqual(defaultMapLayerToggles());
  });

  it("merges stored overrides on top of defaults", () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ windArrows: false, areaLabels: false }),
    );
    expect(readMapLayerTogglesFromStorage()).toEqual({
      windArrows: false,
      forecastSampleDots: true,
      areaLabels: false,
    });
  });

  it("ignores non-boolean fields and falls back to defaults for them", () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ windArrows: "yes", forecastSampleDots: 1 }),
    );
    expect(readMapLayerTogglesFromStorage()).toEqual(defaultMapLayerToggles());
  });
});

describe("writeMapLayerTogglesToStorage", () => {
  it("writes the JSON-encoded state to localStorage", () => {
    writeMapLayerTogglesToStorage({
      windArrows: false,
      forecastSampleDots: true,
      areaLabels: false,
    });
    expect(storage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({
        windArrows: false,
        forecastSampleDots: true,
        areaLabels: false,
      }),
    );
  });

  it("round-trips through readMapLayerTogglesFromStorage", () => {
    const next = {
      windArrows: false,
      forecastSampleDots: false,
      areaLabels: true,
    };
    writeMapLayerTogglesToStorage(next);
    expect(readMapLayerTogglesFromStorage()).toEqual(next);
  });
});
