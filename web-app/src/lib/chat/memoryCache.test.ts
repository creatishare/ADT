import { afterEach, describe, expect, it } from "vitest";
import {
  clearMemoryCache,
  getMemoryCacheEntry,
  getMemoryCacheKey,
  getMemoryCacheSize,
  setMemoryCacheEntry,
} from "./memoryCache";

describe("memoryCache", () => {
  afterEach(() => {
    clearMemoryCache();
  });

  it("returns undefined on miss and stores/returns the value on hit", () => {
    const key = getMemoryCacheKey("hello", "gemini-3.1");
    expect(getMemoryCacheEntry(key)).toBeUndefined();

    setMemoryCacheEntry(key, "ctx");
    expect(getMemoryCacheEntry(key)).toBe("ctx");
  });

  it("produces different keys for different model ids on the same transcript", () => {
    const a = getMemoryCacheKey("transcript", "gemini-3.1");
    const b = getMemoryCacheKey("transcript", "deepseek-v4-pro");
    expect(a).not.toBe(b);
  });

  it("produces the same key for identical (transcript, model) pairs", () => {
    const a = getMemoryCacheKey("same", "gemini-3.1");
    const b = getMemoryCacheKey("same", "gemini-3.1");
    expect(a).toBe(b);
  });

  it("evicts the oldest entry once the cap is exceeded (LRU refresh)", () => {
    // Cache cap is 64. Fill it to the brim, then insert one more and confirm
    // the first-inserted key is gone.
    const first = getMemoryCacheKey("first", "m");
    setMemoryCacheEntry(first, "v-first");

    for (let i = 0; i < 63; i += 1) {
      const k = getMemoryCacheKey(`filler-${i}`, "m");
      setMemoryCacheEntry(k, `v-${i}`);
    }
    expect(getMemoryCacheSize()).toBe(64);
    expect(getMemoryCacheEntry(first)).toBe("v-first");

    // Touching `first` moves it to the tail, so the next oldest should evict.
    const overflow = getMemoryCacheKey("overflow", "m");
    setMemoryCacheEntry(overflow, "v-overflow");

    expect(getMemoryCacheSize()).toBe(64);
    expect(getMemoryCacheEntry(first)).toBe("v-first");
    const evicted = getMemoryCacheKey("filler-0", "m");
    expect(getMemoryCacheEntry(evicted)).toBeUndefined();
  });
});
