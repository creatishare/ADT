import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetKeyPools,
  getEnvNames,
  getPoolSize,
  pickKey,
} from "./keyPool";

const ENVS = [
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

describe("keyPool", () => {
  beforeEach(() => {
    clearEnvs();
    _resetKeyPools();
  });

  afterEach(() => {
    restoreEnvs();
    _resetKeyPools();
  });

  it("returns null and pool size 0 when no key is configured", () => {
    expect(pickKey("hetao")).toBeNull();
    expect(getPoolSize("hetao")).toBe(0);
  });

  it("falls back to the singular env var when plural is unset", () => {
    process.env.HETAO_GATEWAY_API_KEY = "solo-key";
    _resetKeyPools();

    expect(getPoolSize("hetao")).toBe(1);
    expect(pickKey("hetao")).toBe("solo-key");
    // Round-robin of size 1 keeps returning the same key.
    expect(pickKey("hetao")).toBe("solo-key");
  });

  it("prefers plural over singular when both are set", () => {
    process.env.HETAO_GATEWAY_API_KEY = "should-be-ignored";
    process.env.HETAO_GATEWAY_API_KEYS = "k1,k2";
    _resetKeyPools();

    expect(getPoolSize("hetao")).toBe(2);
    expect(pickKey("hetao")).toBe("k1");
    expect(pickKey("hetao")).toBe("k2");
    expect(pickKey("hetao")).toBe("k1"); // wraps
  });

  it("splits the plural env on commas and trims whitespace", () => {
    process.env.HETAO_GATEWAY_API_KEYS = "  m1 , m2,,  m3  ";
    _resetKeyPools();

    expect(getPoolSize("hetao")).toBe(3);
    expect(pickKey("hetao")).toBe("m1");
    expect(pickKey("hetao")).toBe("m2");
    expect(pickKey("hetao")).toBe("m3");
    expect(pickKey("hetao")).toBe("m1");
  });

  it("treats an empty plural value as unset and falls back to singular", () => {
    process.env.HETAO_GATEWAY_API_KEYS = "";
    process.env.HETAO_GATEWAY_API_KEY = "solo-key";
    _resetKeyPools();

    expect(getPoolSize("hetao")).toBe(1);
    expect(pickKey("hetao")).toBe("solo-key");
  });

  it("caches pool contents across calls — env mutations need _resetKeyPools", () => {
    process.env.HETAO_GATEWAY_API_KEYS = "k1,k2";
    _resetKeyPools();

    expect(pickKey("hetao")).toBe("k1");

    // Change env without resetting: pool is already cached.
    process.env.HETAO_GATEWAY_API_KEYS = "x1,x2,x3";
    expect(pickKey("hetao")).toBe("k2"); // still using the old pool
    expect(pickKey("hetao")).toBe("k1");

    // After reset the new env takes effect.
    _resetKeyPools();
    expect(pickKey("hetao")).toBe("x1");
    expect(getPoolSize("hetao")).toBe(3);
  });

  it("exposes the canonical env var names for the hetao gateway provider", () => {
    expect(getEnvNames("hetao")).toEqual({
      plural: "HETAO_GATEWAY_API_KEYS",
      singular: "HETAO_GATEWAY_API_KEY",
    });
  });
});
