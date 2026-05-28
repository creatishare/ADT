/**
 * Per-provider concurrency gate.
 *
 * Purpose: optionally bound the number of concurrent LLM calls made to each
 * provider, so multi-user bursts queue locally instead of bursting the
 * provider and eating 429s.
 *
 * # Default: UNLIMITED (pass-through)
 *
 * Since switching to the company AI gateway (which already enforces its own
 * rate limits on the server side), client-side throttling is **off by
 * default** to avoid double-limiting and prevent self-deadlock — the
 * Orchestrator stream holds one slot for its entire lifecycle while its sub-
 * agent tools also need slots from the same gate, so any small capacity
 * (e.g. poolSize × 3 = 3 with a single API key) caused stalls under
 * 2–3-user concurrency.
 *
 * # Opt-in throttling
 *
 *   - Set `LLM_CONCURRENCY_<PROVIDER>` (e.g. `LLM_CONCURRENCY_HETAO=8`) to
 *     cap that provider's concurrency directly. Wins over the formula below.
 *   - Or set `LLM_PER_KEY_CONCURRENCY=N` to enable `keyPoolSize × N` cap.
 *
 * When neither is set, `getGate()` returns a pass-through Semaphore whose
 * `acquire()` resolves immediately and `run()` just awaits the task.
 *
 * # Contract
 *
 *   const release = await gate.acquire();
 *   try { await callLLM(); } finally { release(); }
 *
 * Or, for Promise-returning work:
 *
 *   await gate.run(() => callLLM());
 *
 * `acquire()` returns an idempotent releaser — calling it twice is a no-op.
 * For `streamText` which resolves *before* the stream finishes, callers must
 * wire `release()` to the stream's `onFinish`/`onError` callbacks (plus a
 * timeout safety net) to hold the slot for the full in-flight window.
 *
 * # Distributed deployments
 *
 * This semaphore is in-process. On Vercel where each request is a separate
 * lambda instance, the gate only limits concurrency *within one warm
 * lambda*. To enforce a global cap, rely on the gateway's own rate limiter
 * or layer a Redis-backed limiter at the HTTP layer.
 */
import type { ProviderId } from "./providers";
import { getPoolSize } from "./keyPool";

export interface Semaphore {
  /** Acquire a slot. Returns an idempotent release function. */
  acquire(): Promise<() => void>;
  /** Run an async task while holding a slot; releases automatically. */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /**
   * Current max parallelism for this semaphore. `Number.POSITIVE_INFINITY`
   * indicates a pass-through (no limit).
   */
  readonly capacity: number;
  /** Currently held slots (for diagnostics / tests). */
  active(): number;
  /** Currently queued waiters (for diagnostics / tests). */
  queueLength(): number;
}

/** Low-level factory; exported for direct use in tests. */
export function createSemaphore(max: number): Semaphore {
  if (!Number.isFinite(max) || max < 1) {
    throw new Error(`Semaphore capacity must be >= 1, got ${max}`);
  }
  let activeCount = 0;
  const queue: Array<() => void> = [];

  function wrapRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      activeCount -= 1;
      const next = queue.shift();
      if (next) next();
    };
  }

  async function acquire(): Promise<() => void> {
    if (activeCount < max) {
      activeCount += 1;
      return wrapRelease();
    }
    return new Promise<() => void>((resolve) => {
      queue.push(() => {
        activeCount += 1;
        resolve(wrapRelease());
      });
    });
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return {
    acquire,
    run,
    capacity: max,
    active: () => activeCount,
    queueLength: () => queue.length,
  };
}

/**
 * Pass-through semaphore: `acquire()` resolves immediately, `run()` awaits
 * the task with no throttling. Returned by `getGate()` when no concurrency
 * env vars are configured, so the gate becomes a no-op.
 */
function createPassThroughSemaphore(): Semaphore {
  return {
    acquire: () => Promise.resolve(() => {}),
    run: <T>(fn: () => Promise<T>) => fn(),
    capacity: Number.POSITIVE_INFINITY,
    active: () => 0,
    queueLength: () => 0,
  };
}

// ---------------------------------------------------------------------------
// Per-provider singleton gates
// ---------------------------------------------------------------------------

const PROVIDER_OVERRIDE_ENV: Record<ProviderId, string> = {
  hetao: "LLM_CONCURRENCY_HETAO",
};

function readPerKeyBase(): number | null {
  const raw = process.env.LLM_PER_KEY_CONCURRENCY;
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readOverride(provider: ProviderId): number | null {
  const raw = process.env[PROVIDER_OVERRIDE_ENV[provider]];
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Resolve the effective capacity for a provider.
 *
 * Returns `null` when no concurrency env var is configured — the caller
 * should treat that as "unlimited / pass-through".
 *
 * Resolution order:
 *   1. `LLM_CONCURRENCY_<PROVIDER>` — explicit per-provider cap.
 *   2. `getPoolSize(provider) × LLM_PER_KEY_CONCURRENCY` — formula mode.
 *   3. `null` — unlimited.
 */
export function computeCapacity(provider: ProviderId): number | null {
  const override = readOverride(provider);
  if (override != null) return override;
  const perKey = readPerKeyBase();
  if (perKey == null) return null;
  const poolSize = Math.max(getPoolSize(provider), 1);
  return perKey * poolSize;
}

const gates = new Map<ProviderId, Semaphore>();

export function getGate(provider: ProviderId): Semaphore {
  let gate = gates.get(provider);
  if (!gate) {
    const cap = computeCapacity(provider);
    gate = cap == null ? createPassThroughSemaphore() : createSemaphore(cap);
    gates.set(provider, gate);
  }
  return gate;
}

/** Test-only: drop cached gates so env changes take effect on next access. */
export function _resetGates(): void {
  gates.clear();
}
