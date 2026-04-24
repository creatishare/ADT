/**
 * Per-provider concurrency gate.
 *
 * Purpose: bound the number of concurrent LLM calls made to each provider,
 * so multi-user bursts queue locally instead of bursting the provider and
 * eating 429s. Capacity defaults to `keyPoolSize × LLM_PER_KEY_CONCURRENCY`
 * (default 3). Override per provider via `LLM_CONCURRENCY_<PROVIDER>`.
 *
 * Contract:
 *   const release = await gate.acquire();
 *   try { await callLLM(); } finally { release(); }
 *
 * Or, for Promise-returning work:
 *   await gate.run(() => callLLM());
 *
 * `acquire()` returns an idempotent releaser — calling it twice is a no-op.
 * For `streamText` which resolves *before* the stream finishes, callers must
 * wire `release()` to the stream's `onFinish`/`onError` callbacks (plus a
 * timeout safety net) to hold the slot for the full in-flight window.
 *
 * Note on distributed deployments: this semaphore is in-process. On Vercel
 * where each request is a separate lambda instance, the gate only limits
 * concurrency *within one warm lambda*. To enforce a global cap, swap in a
 * Redis-backed rate limiter at the HTTP layer.
 */
import type { ProviderId } from "./providers";
import { getPoolSize } from "./keyPool";

export interface Semaphore {
  /** Acquire a slot. Returns an idempotent release function. */
  acquire(): Promise<() => void>;
  /** Run an async task while holding a slot; releases automatically. */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /** Current max parallelism for this semaphore. */
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

// ---------------------------------------------------------------------------
// Per-provider singleton gates
// ---------------------------------------------------------------------------

const PROVIDER_OVERRIDE_ENV: Record<ProviderId, string> = {
  google: "LLM_CONCURRENCY_GOOGLE",
  openai: "LLM_CONCURRENCY_OPENAI",
  moonshot: "LLM_CONCURRENCY_MOONSHOT",
  deepseek: "LLM_CONCURRENCY_DEEPSEEK",
  doubao: "LLM_CONCURRENCY_DOUBAO",
};

const PER_KEY_DEFAULT = 3;

function readPerKeyBase(): number {
  const raw = process.env.LLM_PER_KEY_CONCURRENCY;
  if (!raw) return PER_KEY_DEFAULT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : PER_KEY_DEFAULT;
}

function readOverride(provider: ProviderId): number | null {
  const raw = process.env[PROVIDER_OVERRIDE_ENV[provider]];
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function computeCapacity(provider: ProviderId): number {
  const override = readOverride(provider);
  if (override != null) return override;
  const poolSize = Math.max(getPoolSize(provider), 1);
  return readPerKeyBase() * poolSize;
}

const gates = new Map<ProviderId, Semaphore>();

export function getGate(provider: ProviderId): Semaphore {
  let gate = gates.get(provider);
  if (!gate) {
    gate = createSemaphore(computeCapacity(provider));
    gates.set(provider, gate);
  }
  return gate;
}

/** Test-only: drop cached gates so env changes take effect on next access. */
export function _resetGates(): void {
  gates.clear();
}
