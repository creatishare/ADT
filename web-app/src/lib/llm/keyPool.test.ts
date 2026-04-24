import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetKeyPools,
  getEnvNames,
  getPoolSize,
  pickKey,
} from "./keyPool";

const ENVS = [
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
    expect(pickKey("google")).toBeNull();
    expect(getPoolSize("google")).toBe(0);
  });

  it("falls back to the singular env var when plural is unset", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "solo-key";
    _resetKeyPools();

    expect(getPoolSize("google")).toBe(1);
    expect(pickKey("google")).toBe("solo-key");
    // Round-robin of size 1 keeps returning the same key.
    expect(pickKey("google")).toBe("solo-key");
  });

  it("prefers plural over singular when both are set", () => {
    process.env.OPENAI_API_KEY = "should-be-ignored";
    process.env.OPENAI_API_KEYS = "k1,k2";
    _resetKeyPools();

    expect(getPoolSize("openai")).toBe(2);
    expect(pickKey("openai")).toBe("k1");
    expect(pickKey("openai")).toBe("k2");
    expect(pickKey("openai")).toBe("k1"); // wraps
  });

  it("splits the plural env on commas and trims whitespace", () => {
    process.env.MOONSHOT_API_KEYS = "  m1 , m2,,  m3  ";
    _resetKeyPools();

    expect(getPoolSize("moonshot")).toBe(3);
    expect(pickKey("moonshot")).toBe("m1");
    expect(pickKey("moonshot")).toBe("m2");
    expect(pickKey("moonshot")).toBe("m3");
    expect(pickKey("moonshot")).toBe("m1");
  });

  it("rotates independently per provider", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEYS = "g1,g2";
    process.env.DEEPSEEK_API_KEYS = "d1,d2,d3";
    _resetKeyPools();

    expect(pickKey("google")).toBe("g1");
    expect(pickKey("deepseek")).toBe("d1");
    expect(pickKey("google")).toBe("g2");
    expect(pickKey("deepseek")).toBe("d2");
    expect(pickKey("google")).toBe("g1");
    expect(pickKey("deepseek")).toBe("d3");
  });

  it("treats an empty plural value as unset and falls back to singular", () => {
    process.env.DOUBAO_API_KEYS = "";
    process.env.DOUBAO_API_KEY = "volcano-key";
    _resetKeyPools();

    expect(getPoolSize("doubao")).toBe(1);
    expect(pickKey("doubao")).toBe("volcano-key");
  });

  it("caches pool contents across calls — env mutations need _resetKeyPools", () => {
    process.env.OPENAI_API_KEYS = "k1,k2";
    _resetKeyPools();

    expect(pickKey("openai")).toBe("k1");

    // Change env without resetting: pool is already cached.
    process.env.OPENAI_API_KEYS = "x1,x2,x3";
    expect(pickKey("openai")).toBe("k2"); // still using the old pool
    expect(pickKey("openai")).toBe("k1");

    // After reset the new env takes effect.
    _resetKeyPools();
    expect(pickKey("openai")).toBe("x1");
    expect(getPoolSize("openai")).toBe(3);
  });

  it("exposes the canonical env var names for each provider", () => {
    expect(getEnvNames("google")).toEqual({
      plural: "GOOGLE_GENERATIVE_AI_API_KEYS",
      singular: "GOOGLE_GENERATIVE_AI_API_KEY",
    });
    expect(getEnvNames("openai")).toEqual({
      plural: "OPENAI_API_KEYS",
      singular: "OPENAI_API_KEY",
    });
    expect(getEnvNames("moonshot")).toEqual({
      plural: "MOONSHOT_API_KEYS",
      singular: "MOONSHOT_API_KEY",
    });
    expect(getEnvNames("deepseek")).toEqual({
      plural: "DEEPSEEK_API_KEYS",
      singular: "DEEPSEEK_API_KEY",
    });
    expect(getEnvNames("doubao")).toEqual({
      plural: "DOUBAO_API_KEYS",
      singular: "DOUBAO_API_KEY",
    });
  });
});
