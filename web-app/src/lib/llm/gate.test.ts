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
  "LLM_CONCURRENCY_HETAO",
  "HETAO_GATEWAY_API_KEYS",
  "HETAO_GATEWAY_API_KEY",
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

  it("returns null (unlimited) when no concurrency env var is set", () => {
    // Default since the company-gateway switch: client-side throttling is
    // opt-in. Pool size is irrelevant when no env var is configured.
    process.env.HETAO_GATEWAY_API_KEYS = "g1,g2";
    _resetKeyPools();

    expect(computeCapacity("hetao")).toBeNull();
  });

  it("returns null (unlimited) even when the pool is empty", () => {
    // Missing keys still result in unlimited — getGate creates a pass-through
    // semaphore. A missing-key request fails later at createModel time.
    expect(computeCapacity("hetao")).toBeNull();
  });

  it("honors LLM_PER_KEY_CONCURRENCY → poolSize × N formula", () => {
    process.env.LLM_PER_KEY_CONCURRENCY = "5";
    process.env.HETAO_GATEWAY_API_KEYS = "m1,m2";
    _resetKeyPools();

    expect(computeCapacity("hetao")).toBe(10);
  });

  it("ignores non-positive LLM_PER_KEY_CONCURRENCY (treated as unset)", () => {
    process.env.LLM_PER_KEY_CONCURRENCY = "-1";
    process.env.HETAO_GATEWAY_API_KEYS = "d1";
    _resetKeyPools();

    // Non-positive value is ignored; with no other env var, capacity is null.
    expect(computeCapacity("hetao")).toBeNull();
  });

  it("per-provider override wins over the pool-size formula", () => {
    process.env.HETAO_GATEWAY_API_KEYS = "g1,g2,g3,g4";
    process.env.LLM_PER_KEY_CONCURRENCY = "3";
    process.env.LLM_CONCURRENCY_HETAO = "2";
    _resetKeyPools();

    // Without override this would be 4 × 3 = 12; override forces 2.
    expect(computeCapacity("hetao")).toBe(2);
  });

  it("ignores non-positive per-provider override and falls back", () => {
    process.env.HETAO_GATEWAY_API_KEYS = "x1";
    process.env.LLM_CONCURRENCY_HETAO = "0";
    _resetKeyPools();

    // Override invalid + no LLM_PER_KEY_CONCURRENCY → unlimited.
    expect(computeCapacity("hetao")).toBeNull();
  });

  it("per-provider override applies even without a configured key pool", () => {
    process.env.LLM_CONCURRENCY_HETAO = "5";
    _resetKeyPools();

    expect(computeCapacity("hetao")).toBe(5);
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
    process.env.HETAO_GATEWAY_API_KEY = "k";
    _resetKeyPools();

    const g1 = getGate("hetao");
    const g2 = getGate("hetao");
    expect(g1).toBe(g2);
  });

  it("returns a pass-through semaphore (Infinity capacity) by default", () => {
    process.env.HETAO_GATEWAY_API_KEY = "k";
    _resetKeyPools();

    const gate = getGate("hetao");
    expect(gate.capacity).toBe(Number.POSITIVE_INFINITY);
    expect(gate.active()).toBe(0);
    expect(gate.queueLength()).toBe(0);
  });

  it("pass-through semaphore allows arbitrary parallelism without blocking", async () => {
    process.env.HETAO_GATEWAY_API_KEY = "k";
    _resetKeyPools();

    const gate = getGate("hetao");

    // Acquire 100 slots simultaneously — all must resolve without queueing.
    const releases = await Promise.all(
      Array.from({ length: 100 }, () => gate.acquire())
    );
    expect(gate.active()).toBe(0); // pass-through never tracks active
    expect(gate.queueLength()).toBe(0);

    // run() should resolve with task value and not block on prior acquires.
    await expect(gate.run(async () => "ok")).resolves.toBe("ok");

    for (const release of releases) release();
  });

  it("_resetGates() forces fresh capacity computation from current env", () => {
    process.env.HETAO_GATEWAY_API_KEYS = "m1";
    _resetKeyPools();
    const first = getGate("hetao");
    expect(first.capacity).toBe(Number.POSITIVE_INFINITY);

    process.env.LLM_CONCURRENCY_HETAO = "10";
    _resetGates();
    const second = getGate("hetao");
    expect(second).not.toBe(first);
    expect(second.capacity).toBe(10);
  });
});
