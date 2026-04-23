import { createHash } from "node:crypto";

/**
 * Module-level LRU-ish cache for memory-extraction results.
 *
 * Keyed by SHA-256 of the transcript (+ model id, so switching the memory
 * model invalidates automatically). Bounded by `MAX_ENTRIES` with FIFO
 * eviction — simple and good enough for a single Next.js process.
 *
 * Memory extraction is deterministic for a given (transcript, model), so a
 * cache hit lets us skip a full sub-agent round-trip on repeated or minor
 * follow-up turns where the tail is unchanged.
 */

const MAX_ENTRIES = 64;

const cache = new Map<string, string>();

export function getMemoryCacheKey(transcript: string, modelId: string): string {
  return createHash("sha256")
    .update(modelId)
    .update("\u0000")
    .update(transcript)
    .digest("hex");
}

export function getMemoryCacheEntry(key: string): string | undefined {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key)!;
  // Refresh recency — Map iteration order is insertion order, so re-set moves
  // the key to the tail, giving simple LRU behavior.
  cache.delete(key);
  cache.set(key, value);
  return value;
}

export function setMemoryCacheEntry(key: string, value: string): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

export function clearMemoryCache(): void {
  cache.clear();
}

export function getMemoryCacheSize(): number {
  return cache.size;
}
