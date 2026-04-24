import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetGates,
  computeCapacity,
  createSemaphore,
  getGate,
} from "./gate";
import { _resetKeyPools } from "./keyPool";

const ENVS = [
  "LLM_PER_KEY_CONCURRENCY",
  "LLM_CONCURRENCY_GOOGLE",
  "LLM_CONCURRENCY_OPENAI",
  "LLM_CONCURRENCY_MOONSHOT",
  "LLM_CONCURRENCY_DEEPSEEK",
  "LLM_CONCURRENCY_DOUBAO",
  "GOOGLE_GENERATIVE_AI_API_KEYS",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENAI_API_KEYS",
  "OPENAI_API_KEY",
  "MOONSHOT_API_KEYS",
  "MOONSHOT_API_KEY",
  "DEEPSEEK_API_KEYS",
  "DEEPSEEK_API_KEY",
  "DOUBAO_API_KEYS",
  "DOUBAO_API_KEY",
] as const;

const originals: Partial<Record<(typeof ENVS)[number], string | undefined>> = {};

function clearEnvs(): void {
  for (const name of ENVS) {
    originals[name] = process.env[name];
    delete process.env[name];
  }
}

function restoreEnvs(): void {
  for (const name of ENVS) {
    const val = originals[name];
    if (val === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = val;
    }
  }
}

describe("createSemaphore", () => {
  it("rejects non-positive or non-finite capacity", () => {
    expect(() => createSemaphore(0)).toThrow();
    expect(() => createSemaphore(-1)).toThrow();
    expect(() => createSemaphore(Number.NaN)).toThrow();
    expect(() => createSemaphore(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("exposes capacity and lets parallel tasks run up to it", async () => {
    const sem = createSemaphore(2);
    expect(sem.capacity).toBe(2);
    expect(sem.active()).toBe(0);
    expect(sem.queueLength()).toBe(0);

    const r1 = await sem.acquire();
    const r2 = await sem.acquire();
    expect(sem.active()).toBe(2);
    expect(sem.queueLength()).toBe(0);

    r1();
    r2();
    expect(sem.active()).toBe(0);
  });

  it("queues acquirers beyond capacity and releases them in FIFO order", async () => {
    const sem = createSemaphore(1);

    const release1 = await sem.acquire();

    // Two queued waiters — neither resolves until release1() is called.
    const order: number[] = [];
    const waiter2 = sem.acquire().then((release) => {
      order.push(2);
      return release;
    });
    const waiter3 = sem.acquire().then((release) => {
      order.push(3);
      return release;
    });

    expect(sem.active()).toBe(1);
    expect(sem.queueLength()).toBe(2);

    // Release first slot → waiter2 should take it.
    release1();
    const release2 = await waiter2;
    expect(order).toEqual([2]);
    expect(sem.active()).toBe(1);
    expect(sem.queueLength()).toBe(1);

    // Release second → waiter3 takes it.
    release2();
    const release3 = await waiter3;
    expect(order).toEqual([2, 3]);
    expect(sem.active()).toBe(1);

    release3();
    expect(sem.active()).toBe(0);
  });

  it("treats release() as idempotent (safe to call twice)", async () => {
    const sem = createSemaphore(1);
    const release = await sem.acquire();
    expect(sem.active()).toBe(1);

    release();
    release(); // second call must be a no-op
    expect(sem.active()).toBe(0);

    // The slot is genuinely free — next acquire() must not count negatively.
    const r2 = await sem.acquire();
    expect(sem.active()).toBe(1);
    r2();
  });

  it("run() releases even when the task throws", async () => {
    const sem = createSemaphore(1);
    await expect(sem.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(sem.active()).toBe(0);

    // Next run should proceed without waiting.
    const value = await sem.run(async () => 42);
    expect(value).toBe(42);
    expect(sem.active()).toBe(0);
  });

  it("run() resolves with the task's return value", async () => {
    const sem = createSemaphore(3);
    const result = await sem.run(async () => "ok");
    expect(result).toBe("ok");
  });
});

describe("computeCapacity", () => {
  beforeEach(() => {
    clearEnvs();
    _resetGates();
    _resetKeyPools();
  });

  afterEach(() => {
    restoreEnvs();
    _resetGates();
    _resetKeyPools();
  });

  it("defaults to poolSize × 3 when no overrides are set", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEYS = "g1,g2";
    _resetKeyPools();

    expect(computeCapacity("google")).toBe(6); // 2 keys × 3
  });

  it("uses at least 1× per-key base when the pool is empty", () => {
    // No keys configured — pool size is 0, but capacity should floor at
    // perKeyBase × 1 so a missing-key request still fails with a clean
    // error instead of hanging on a zero-capacity semaphore.
    expect(computeCapacity("openai")).toBe(3);
  });

  it("honors LLM_PER_KEY_CONCURRENCY for the per-key base", () => {
    process.env.LLM_PER_KEY_CONCURRENCY = "5";
    process.env.MOONSHOT_API_KEYS = "m1,m2";
    _resetKeyPools();

    expect(computeCapacity("moonshot")).toBe(10);
  });

  it("ignores non-positive LLM_PER_KEY_CONCURRENCY and falls back to default", () => {
    process.env.LLM_PER_KEY_CONCURRENCY = "-1";
    process.env.DEEPSEEK_API_KEYS = "d1";
    _resetKeyPools();

    expect(computeCapacity("deepseek")).toBe(3);
  });

  it("per-provider override wins over the pool-size formula", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEYS = "g1,g2,g3,g4";
    process.env.LLM_CONCURRENCY_GOOGLE = "2";
    _resetKeyPools();

    // Without override this would be 4 × 3 = 12; override forces 2.
    expect(computeCapacity("google")).toBe(2);
  });

  it("ignores non-positive per-provider override", () => {
    process.env.DOUBAO_API_KEYS = "x1";
    process.env.LLM_CONCURRENCY_DOUBAO = "0";
    _resetKeyPools();

    expect(computeCapacity("doubao")).toBe(3); // falls back to poolSize × default
  });
});

describe("getGate", () => {
  beforeEach(() => {
    clearEnvs();
    _resetGates();
    _resetKeyPools();
  });

  afterEach(() => {
    restoreEnvs();
    _resetGates();
    _resetKeyPools();
  });

  it("returns the same semaphore instance across calls for the same provider", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "k";
    _resetKeyPools();

    const g1 = getGate("google");
    const g2 = getGate("google");
    expect(g1).toBe(g2);
  });

  it("creates independent semaphores per provider", () => {
    process.env.OPENAI_API_KEYS = "o1,o2";
    process.env.DEEPSEEK_API_KEYS = "d1";
    _resetKeyPools();

    const openaiGate = getGate("openai");
    const deepseekGate = getGate("deepseek");

    expect(openaiGate).not.toBe(deepseekGate);
    expect(openaiGate.capacity).toBe(6); // 2 × 3
    expect(deepseekGate.capacity).toBe(3); // 1 × 3
  });

  it("_resetGates() forces fresh capacity computation from current env", () => {
    process.env.MOONSHOT_API_KEYS = "m1";
    _resetKeyPools();
    const first = getGate("moonshot");
    expect(first.capacity).toBe(3);

    process.env.LLM_CONCURRENCY_MOONSHOT = "10";
    _resetGates();
    const second = getGate("moonshot");
    expect(second).not.toBe(first);
    expect(second.capacity).toBe(10);
  });
});
