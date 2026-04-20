/**
 * Server-only model factory.
 *
 * Resolves a UI-facing ModelId (e.g. "gemini-3.1") into a concrete AI SDK
 * model instance using the matching provider and environment variables.
 *
 * Kimi, DeepSeek, and Doubao all expose OpenAI-compatible endpoints, so they
 * reuse `@ai-sdk/openai` with a custom baseURL and API key.
 *
 * Model IDs sent to provider APIs can be overridden via env vars (e.g.
 * `GOOGLE_GENERATIVE_AI_MODEL`, `OPENAI_MODEL`, etc.) without touching code.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, type ModelId } from "./providers";

export class MissingApiKeyError extends Error {
  constructor(public readonly envVar: string, public readonly modelId: ModelId) {
    super(`Missing API key for model "${modelId}". Set ${envVar} in .env.local`);
    this.name = "MissingApiKeyError";
  }
}

function requireEnv(envVar: string, modelId: ModelId) {
  const value = process.env[envVar];
  if (!value) throw new MissingApiKeyError(envVar, modelId);
  return value;
}

export function resolveModelId(raw: string | null | undefined): ModelId {
  if (!raw) return DEFAULT_MODEL_ID;
  const match = AVAILABLE_MODELS.find((m) => m.id === raw);
  return match ? (match.id as ModelId) : DEFAULT_MODEL_ID;
}

/** Create an AI SDK model instance ready to be passed to streamText/generateText. */
export function createModel(modelId: ModelId) {
  switch (modelId) {
    case "gemini-3.1": {
      const provider = createGoogleGenerativeAI({
        apiKey: requireEnv("GOOGLE_GENERATIVE_AI_API_KEY", modelId),
        baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL,
      });
      return provider(process.env.GOOGLE_GENERATIVE_AI_MODEL || "gemini-3.1");
    }

    case "gpt-5.2": {
      const provider = createOpenAI({
        apiKey: requireEnv("OPENAI_API_KEY", modelId),
        baseURL: process.env.OPENAI_BASE_URL,
      });
      // Use Chat Completions API explicitly — Responses API requires
      // previous_response_id chaining which this app does not maintain.
      return provider.chat(process.env.OPENAI_MODEL || "gpt-5.2");
    }

    case "kimi-k2.5": {
      const provider = createOpenAI({
        apiKey: requireEnv("MOONSHOT_API_KEY", modelId),
        baseURL: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1",
        compatibility: "compatible",
      });
      return provider.chat(process.env.MOONSHOT_MODEL || "kimi-k2.5");
    }

    case "deepseek-v3.2": {
      const provider = createOpenAI({
        apiKey: requireEnv("DEEPSEEK_API_KEY", modelId),
        baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
        compatibility: "compatible",
      });
      return provider.chat(process.env.DEEPSEEK_MODEL || "deepseek-chat");
    }

    case "doubao-seed-2.0-pro": {
      const provider = createOpenAI({
        apiKey: requireEnv("DOUBAO_API_KEY", modelId),
        baseURL:
          process.env.DOUBAO_BASE_URL ||
          "https://ark.cn-beijing.volces.com/api/v3",
        compatibility: "compatible",
      });
      return provider.chat(process.env.DOUBAO_MODEL || "doubao-seed-2.0-pro");
    }

    default: {
      // Exhaustiveness check — unreachable for known ModelId values.
      const _never: never = modelId;
      throw new Error(`Unsupported model id: ${_never}`);
    }
  }
}
