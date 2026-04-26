/**
 * Per-provider API key pool with round-robin rotation.
 *
 * Why: in production, a single API key's RPM/TPM budget is shared across all
 * users. With 3+ concurrent users, one key gets 429'd almost immediately.
 * Splitting load across N keys linearly multiplies capacity.
 *
 * Env vars (for each provider):
 *   - `*_API_KEYS` (plural, comma-separated) — preferred
 *   - `*_API_KEY`  (singular) — backward compat, used when plural is unset
 *
 * Keys are read lazily on first access per provider, then cached. Use
 * `_resetKeyPools()` in tests to force a re-read after mutating env vars.
 */
import type { ProviderId } from "./providers";

interface Pool {
  keys: string[];
  cursor: number;
}

const ENV_SPECS: Record<ProviderId, { plural: string; singular: string }> = {
  google: {
    plural: "GOOGLE_GENERATIVE_AI_API_KEYS",
    singular: "GOOGLE_GENERATIVE_AI_API_KEY",
  },
  openai: { plural: "OPENAI_API_KEYS", singular: "OPENAI_API_KEY" },
  moonshot: { plural: "MOONSHOT_API_KEYS", singular: "MOONSHOT_API_KEY" },
  deepseek: { plural: "DEEPSEEK_API_KEYS", singular: "DEEPSEEK_API_KEY" },
  doubao: { plural: "DOUBAO_API_KEYS", singular: "DOUBAO_API_KEY" },
};

const pools = new Map<ProviderId, Pool>();

function readPoolKeys(provider: ProviderId): string[] {
  const { plural, singular } = ENV_SPECS[provider];
  const pluralRaw = process.env[plural];
  if (pluralRaw) {
    const keys = pluralRaw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keys.length > 0) return keys;
  }
  const single = process.env[singular]?.trim();
  return single ? [single] : [];
}

function getOrInitPool(provider: ProviderId): Pool {
  let p = pools.get(provider);
  if (!p) {
    p = { keys: readPoolKeys(provider), cursor: 0 };
    pools.set(provider, p);
  }
  return p;
}

/**
 * Return the next key for a provider, advancing the round-robin cursor.
 * Returns `null` when no key is configured — callers should translate this
 * into a user-facing MissingApiKeyError.
 */
export function pickKey(provider: ProviderId): string | null {
  const pool = getOrInitPool(provider);
  if (pool.keys.length === 0) return null;
  const key = pool.keys[pool.cursor % pool.keys.length];
  pool.cursor = (pool.cursor + 1) % pool.keys.length;
  return key ?? null;
}

export function getPoolSize(provider: ProviderId): number {
  return getOrInitPool(provider).keys.length;
}

export function getEnvNames(
  provider: ProviderId
): { plural: string; singular: string } {
  return ENV_SPECS[provider];
}

/**
 * Test-only: clear cached pools so subsequent calls re-read `process.env`.
 * Do not use in application code — pools are cached for correctness (so the
 * cursor is stable across requests within a process) and performance.
 */
export function _resetKeyPools(): void {
  pools.clear();
}
