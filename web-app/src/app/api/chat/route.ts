import { stepCountIs, streamText, generateText, generateObject, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { FinishReason } from "ai";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "@/lib/agents/prompts";
import {
  MAX_MEMORY_ITEMS,
  MAX_RECENT_MESSAGES,
  MemorySummarySchema,
  buildLayeredMemoryContext,
  buildTranscript,
  normalizeMessages,
  getMessageText,
  type RequestMessage,
} from "../../../lib/chat/memory";
import { parseOrchestratorState } from "@/lib/chat/artifactParser";
import {
  createDesignStageFileTool,
  createWriteStageFileTool,
  createValidateStageFileTool,
  createGenerateVisualDesignTool,
} from "./tools";
import { createModel, resolveModelId, resolveMemoryModelId, MissingApiKeyError } from "@/lib/llm/server";
import { getGate } from "@/lib/llm/gate";
import { getProviderForModelId } from "@/lib/llm/providers";
import {
  getMemoryCacheKey,
  getMemoryCacheEntry,
  setMemoryCacheEntry,
} from "@/lib/chat/memoryCache";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

type ChatTestScenario = "success" | "approval" | "tool-error" | "request-error";

type ChatTestToolPart = {
  type: "dynamic-tool";
  toolCallId: string;
  state: "output-available" | "output-error" | "approval-requested";
  toolName?: string;
  output?: {
    content: string;
    artifact?: {
      title: string;
      type: "markdown" | "image" | "code";
      content: string;
    };
  };
  errorText?: string;
  input?: Record<string, unknown>;
};

type ChatTestResponse = {
  text: string;
  toolPart?: ChatTestToolPart;
};

const CHAT_TEST_MODE_HEADER = "x-chat-test-mode";
const CHAT_TEST_SCENARIO_HEADER = "x-chat-test-scenario";
const CHAT_TEST_SCENARIO_MARKER =
  /\[test-scenario:(success|approval|tool-error|request-error)\]/i;
const CHAT_DEBUG_HEADER = "x-chat-debug";
const MODEL_ID_HEADER = "x-model-id";
const EMPTY_PROVIDER_RESPONSE_MESSAGE =
  "当前模型服务返回了空响应，未生成任何文本或工具结果。请检查代理兼容性、API 返回格式，或切换模型配置后重试。";

type StreamDebugChunk = { type?: string };

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Unknown error";
}

function getProviderFailureMessage(error: unknown) {
  if (error instanceof MissingApiKeyError) {
    return `当前选择的模型 "${error.modelId}" 缺少 API Key。请在 .env.local 中配置 ${error.envVar}，或在界面上切换到已配置的模型后重试。`;
  }
  const message = getErrorMessage(error);
  if (/connect timeout/i.test(message)) {
    return "连接大模型服务超时。请检查当前网络是否可直连目标供应商，或配置对应的 *_BASE_URL 兼容代理后重试。";
  }
  if (/cannot connect to api/i.test(message)) {
    return "当前无法连接到大模型服务。请检查本机网络连通性，或配置可用的 *_BASE_URL 代理后重试。";
  }
  if (/no output generated/i.test(message)) {
    return "模型未返回可用内容。本次请求可能因网络或模型服务异常中断，请检查供应商配置后重试。";
  }
  if (/401|403|unauthorized|invalid api key/i.test(message)) {
    return "模型服务返回鉴权失败。请确认所选模型的 API Key 是否正确、是否已开通对应模型权限。";
  }
  return `模型请求失败：${message}`;
}

function normalizeFinishReason(value: unknown): FinishReason | "unknown" {
  return typeof value === "string" ? (value as FinishReason) : "unknown";
}

function getChunkType(chunk: unknown): string {
  if (!chunk || typeof chunk !== "object") return "unknown";
  const maybeChunk = chunk as StreamDebugChunk;
  return typeof maybeChunk.type === "string" ? maybeChunk.type : "unknown";
}

// ---------------------------------------------------------------------------
// Debug logging
// ---------------------------------------------------------------------------

function logChatDebug(label: string, payload?: unknown) {
  const prefix = `[chat-debug] ${label}`;
  if (payload === undefined) { console.error(prefix); return; }
  try {
    console.error(prefix, JSON.stringify(payload));
  } catch {
    console.error(prefix, payload);
  }
}

// ---------------------------------------------------------------------------
// Fallback streams
// ---------------------------------------------------------------------------

function createEmptyResponseFallbackStream(message: string) {
  return createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: "provider-empty-response" });
      writer.write({ type: "text-delta", id: "provider-empty-response", delta: message });
      writer.write({ type: "text-end", id: "provider-empty-response" });
      writer.write({ type: "finish" });
    },
  });
}

// ---------------------------------------------------------------------------
// E2E / test-mode helpers
// ---------------------------------------------------------------------------

function buildChatTestModeStream(response: ChatTestResponse) {
  return createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: "test-text" });
      writer.write({ type: "text-delta", id: "test-text", delta: response.text });
      writer.write({ type: "text-end", id: "test-text" });

      if (response.toolPart) {
        const { toolPart } = response;

        if (toolPart.state === "approval-requested") {
          writer.write({ type: "tool-input-available", toolCallId: toolPart.toolCallId, toolName: toolPart.toolName ?? "unknownTool", input: toolPart.input ?? {}, dynamic: true });
          writer.write({ type: "tool-approval-request", approvalId: `${toolPart.toolCallId}-approval`, toolCallId: toolPart.toolCallId });
        }

        if (toolPart.state === "output-error") {
          writer.write({ type: "tool-input-available", toolCallId: toolPart.toolCallId, toolName: toolPart.toolName ?? "unknownTool", input: toolPart.input ?? {}, dynamic: true });
          writer.write({ type: "tool-output-error", toolCallId: toolPart.toolCallId, errorText: toolPart.errorText ?? "测试模式：工具执行失败", dynamic: true });
        }

        if (toolPart.state === "output-available") {
          writer.write({ type: "tool-input-available", toolCallId: toolPart.toolCallId, toolName: toolPart.toolName ?? "unknownTool", input: toolPart.input ?? {}, dynamic: true });
          writer.write({ type: "tool-output-available", toolCallId: toolPart.toolCallId, output: toolPart.output, dynamic: true });
        }
      }

      writer.write({ type: "finish" });
    },
  });
}

function getChatTestScenario(req: Request, requestMessages: RequestMessage[]): ChatTestScenario {
  const fromHeader = req.headers.get(CHAT_TEST_SCENARIO_HEADER);
  if (fromHeader === "success" || fromHeader === "approval" || fromHeader === "tool-error" || fromHeader === "request-error") {
    return fromHeader;
  }
  const transcript = buildTranscript(requestMessages);
  const fromMarker = transcript.match(CHAT_TEST_SCENARIO_MARKER)?.[1];
  if (fromMarker === "success" || fromMarker === "approval" || fromMarker === "tool-error" || fromMarker === "request-error") {
    return fromMarker;
  }
  return "success";
}

function isE2ETestMode(req: Request) {
  return process.env.E2E_TEST_MODE === "1" || req.headers.get(CHAT_TEST_MODE_HEADER) === "1";
}

function isChatDebugMode(req: Request) {
  return process.env.CHAT_DEBUG === "1" || req.headers.get(CHAT_DEBUG_HEADER) === "1";
}

function createChatTestModeResponse(scenario: ChatTestScenario): ChatTestResponse {
  switch (scenario) {
    case "approval":
      return {
        text: "我已生成候选方案，等待你确认后继续。",
        toolPart: {
          type: "dynamic-tool",
          toolCallId: "test-approval-tool",
          toolName: "validateStageFile",
          state: "approval-requested",
          input: { documentContent: "测试模式下的待确认文档" },
        },
      };
    case "tool-error":
      return {
        text: "本轮工具执行失败，请使用重试按钮重新生成。",
        toolPart: {
          type: "dynamic-tool",
          toolCallId: "test-tool-error",
          toolName: "validateStageFile",
          state: "output-error",
          errorText: "测试模式：工具执行失败",
        },
      };
    case "request-error":
      return { text: "测试模式：请求级失败" };
    case "success":
    default:
      return {
        text: "我已生成一份稳定的测试工件，右侧面板会自动展示。",
        toolPart: {
          type: "dynamic-tool",
          toolCallId: "test-success-tool",
          toolName: "designStageFile",
          state: "output-available",
          output: {
            content: "# 核心包装概念\n\n## 方案 A\n- 用于浏览器 E2E 的稳定输出\n\n## 方案 B\n- 右侧工件区应自动同步显示",
            artifact: {
              title: "核心包装概念",
              type: "markdown",
              content: "# 核心包装概念\n\n## 方案 A\n- 用于浏览器 E2E 的稳定输出\n\n## 方案 B\n- 右侧工件区应自动同步显示",
            },
          },
        },
      };
  }
}

/**
 * Walk back through history to find the most recent accumulatedGuidance from
 * an assistant state block. Used as a server-side safety net in case the LLM
 * forgets to pass userGuidance to a sub-agent tool.
 */
function extractLatestGuidance(messages: RequestMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (!m || m.role !== "assistant") continue;
    const state = parseOrchestratorState(getMessageText(m));
    if (state && state.accumulatedGuidance.length > 0) {
      return state.accumulatedGuidance.map((line) => `- ${line}`).join("\n");
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

type MemoryExtractionResult = {
  context: string;
  cacheHit: boolean;
  transcriptLength: number;
};

async function buildMemoryContext(
  messages: RequestMessage[],
  model: Parameters<typeof generateText>[0]["model"],
  memoryModelId: import("@/lib/llm/providers").ModelId
): Promise<MemoryExtractionResult> {
  const transcript = buildTranscript(messages);
  if (!transcript) {
    return { context: "", cacheHit: false, transcriptLength: 0 };
  }

  const cacheKey = getMemoryCacheKey(transcript, memoryModelId);
  const cached = getMemoryCacheEntry(cacheKey);
  if (cached !== undefined) {
    return { context: cached, cacheHit: true, transcriptLength: transcript.length };
  }

  // Use `output: "no-schema"` so the underlying provider only sets
  // `response_format: { type: "json_object" }` (supported by DeepSeek, Kimi,
  // Doubao, etc.). Passing a Zod `schema` would upgrade it to
  // `json_schema`, which DeepSeek's Chat Completions API rejects with
  // "This response_format type is unavailable now" and would crash the
  // entire POST handler after history exceeds MAX_RECENT_MESSAGES.
  try {
    const memoryGate = getGate(getProviderForModelId(memoryModelId));
    const { object } = await memoryGate.run(() =>
      generateObject({
        model,
        output: "no-schema",
        maxRetries: 3,
        system:
          "你是多智能体工作流的记忆提取器。你的职责是从完整历史中提取真正需要长期保留的用户约束、当前流程状态与最近已完成工具。不要复述闲聊，不要编造。",
        prompt: `请从下面完整历史中提取结构化记忆，并以 JSON 对象输出。\n\n输出要求（严格 JSON）：\n{\n  "userConstraints": string[],  // 用户明确要求长期遵守的偏好、禁忌、风格和硬规则，最多 ${MAX_MEMORY_ITEMS} 条\n  "workflowState": string[],    // 已确认的流程状态、人工决策、当前推进阶段，最多 ${MAX_MEMORY_ITEMS} 条\n  "recentTools": string[]       // 最近已完成且对后续有依赖关系的工具，最多 ${MAX_MEMORY_ITEMS} 条\n}\n\n完整历史：\n${transcript}`,
      })
    );

    const parsed = MemorySummarySchema.safeParse(object);
    if (!parsed.success) {
      return { context: "", cacheHit: false, transcriptLength: transcript.length };
    }

    const context = buildLayeredMemoryContext(parsed.data);
    setMemoryCacheEntry(cacheKey, context);
    return { context, cacheHit: false, transcriptLength: transcript.length };
  } catch (error) {
    // Memory extraction is an enhancement, not a critical path. If the
    // provider rejects the request (auth, unsupported format, timeout, etc.)
    // degrade to an empty memory context rather than failing the whole
    // orchestrator request.
    logChatDebug("memory.extraction-failed", {
      message: getErrorMessage(error),
    });
    return { context: "", cacheHit: false, transcriptLength: transcript.length };
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const debugEnabled = isChatDebugMode(req);
  const { messages } = await req.json();
  const rawMessages = Array.isArray(messages) ? messages : [];
  const requestMessages = normalizeMessages(rawMessages);

  if (debugEnabled) {
    logChatDebug("request.received", {
      rawMessages: rawMessages.length,
      normalizedMessages: requestMessages.length,
      e2eTestMode: isE2ETestMode(req),
      modelFromEnv: process.env.GOOGLE_GENERATIVE_AI_MODEL ?? null,
      hasAuthToken: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      hasBaseUrl: Boolean(process.env.GOOGLE_GENERATIVE_AI_BASE_URL),
    });
  }

  if (isE2ETestMode(req)) {
    const scenario = getChatTestScenario(req, requestMessages);
    if (scenario === "request-error") {
      return Response.json({ error: "测试模式：请求级失败" }, { status: 500 });
    }
    return createUIMessageStreamResponse({
      stream: buildChatTestModeStream(createChatTestModeResponse(scenario)),
    });
  }

  // Filter raw messages to only those normalizeMessages would accept, so the
  // window seen by streamText matches the one used for memory extraction.
  // Preserves original UIMessage shape required by convertToModelMessages.
  const validRawMessages = rawMessages.filter(
    (m: { role?: unknown }) =>
      m?.role === "system" || m?.role === "user" || m?.role === "assistant"
  );
  const recentMessages = validRawMessages.slice(-MAX_RECENT_MESSAGES);
  const modelMessages = await convertToModelMessages(recentMessages);

  const modelId = resolveModelId(req.headers.get(MODEL_ID_HEADER));

  let orchestratorModel: ReturnType<typeof createModel>;
  let subAgentModel: ReturnType<typeof createModel>;
  try {
    orchestratorModel = createModel(modelId);
    subAgentModel = createModel(modelId);
  } catch (error) {
    if (debugEnabled) {
      logChatDebug("request.model-init-error", {
        modelId,
        message: getErrorMessage(error),
      });
    }
    return createUIMessageStreamResponse({
      stream: createEmptyResponseFallbackStream(getProviderFailureMessage(error)),
    });
  }

  // Memory extraction can be routed to a cheaper model via `MEMORY_MODEL_ID`.
  // Falls back to the main sub-agent model when the env is unset or the
  // override model fails to initialize (e.g. missing API key).
  const memoryModelId = resolveMemoryModelId(modelId);
  let memoryModel = subAgentModel;
  let memoryModelIdUsed = modelId;
  if (memoryModelId !== modelId) {
    try {
      memoryModel = createModel(memoryModelId);
      memoryModelIdUsed = memoryModelId;
    } catch (error) {
      if (debugEnabled) {
        logChatDebug("memory.model-fallback", {
          requested: memoryModelId,
          fallback: modelId,
          message: getErrorMessage(error),
        });
      }
    }
  }

  let memoryContext = "";
  if (requestMessages.length > MAX_RECENT_MESSAGES) {
    const result = await buildMemoryContext(
      requestMessages,
      memoryModel,
      memoryModelIdUsed
    );
    memoryContext = result.context;
    if (debugEnabled) {
      logChatDebug("memory.extraction", {
        cacheHit: result.cacheHit,
        transcriptLength: result.transcriptLength,
        contextLength: result.context.length,
        modelId: memoryModelIdUsed,
      });
    }
  }

  const fallbackGuidance = extractLatestGuidance(requestMessages);

  if (debugEnabled && fallbackGuidance) {
    logChatDebug("request.fallback-guidance", {
      lines: fallbackGuidance.split("\n").length,
    });
  }

  if (debugEnabled) {
    logChatDebug("request.pre-stream", {
      recentMessages: recentMessages.length,
      memoryContextLength: memoryContext.length,
      modelId,
    });
  }

  // Orchestrator concurrency gate — holds a slot for the *entire* stream
  // lifecycle (not just the initial call). Released via onFinish/onError or
  // the safety timeout below. `releaseOnce` guarantees at-most-one release.
  const orchestratorGate = getGate(getProviderForModelId(modelId));
  const gateRelease = await orchestratorGate.acquire();
  let gateReleased = false;
  const releaseOnce = () => {
    if (gateReleased) return;
    gateReleased = true;
    gateRelease();
  };
  // Safety net — if the stream never fires onFinish/onError (e.g. client
  // disconnect with no callback), force release after maxDuration + buffer
  // so the slot does not leak for the lifetime of this warm process.
  const gateSafetyTimer = setTimeout(
    releaseOnce,
    (maxDuration + 30) * 1000
  );
  const releaseGate = () => {
    clearTimeout(gateSafetyTimer);
    releaseOnce();
  };

  let result;

  try {
    result = streamText({
      model: orchestratorModel,
      system: memoryContext
        ? `${ORCHESTRATOR_SYSTEM_PROMPT}\n\n${memoryContext}`
        : ORCHESTRATOR_SYSTEM_PROMPT,
      messages: modelMessages,
      stopWhen: stepCountIs(5),
      // Retries with exponential backoff — papers over transient 429/503
      // bursts under multi-user concurrency. With the gate above already
      // rate-limiting, retries only fire for *upstream* provider blips.
      maxRetries: 4,
      onChunk: ({ chunk }) => {
        if (debugEnabled) logChatDebug("stream.chunk", { type: getChunkType(chunk) });
      },
      onError: ({ error }) => {
        releaseGate();
        if (debugEnabled) logChatDebug("stream.error", { message: getErrorMessage(error) });
      },
      onStepFinish: ({ text, toolCalls, toolResults, finishReason, rawFinishReason, response }) => {
        if (debugEnabled) {
          logChatDebug("stream.step-finish", {
            textLength: text.length,
            toolCalls: toolCalls.length,
            toolResults: toolResults.length,
            finishReason: normalizeFinishReason(finishReason),
            rawFinishReason: rawFinishReason ?? null,
            responseMessages: response.messages.length,
          });
        }
      },
      onFinish: ({ text, finishReason, totalUsage, steps }) => {
        releaseGate();
        if (debugEnabled) {
          logChatDebug("stream.finish", {
            textLength: text.length,
            finishReason: normalizeFinishReason(finishReason),
            steps: steps.length,
            totalUsage: totalUsage ?? null,
          });
        }
      },
      tools: {
        designStageFile: createDesignStageFileTool(subAgentModel, modelId, fallbackGuidance),
        writeStageFile: createWriteStageFileTool(subAgentModel, modelId, fallbackGuidance),
        validateStageFile: createValidateStageFileTool(subAgentModel, modelId, fallbackGuidance),
        generateVisualDesign: createGenerateVisualDesignTool(subAgentModel, modelId, fallbackGuidance),
      },
    });
  } catch (error) {
    releaseGate();
    if (debugEnabled) logChatDebug("stream.setup-error", { message: getErrorMessage(error) });
    return createUIMessageStreamResponse({
      stream: createEmptyResponseFallbackStream(getProviderFailureMessage(error)),
    });
  }

  try {
    const response = await result.response;
    const responseText = await result.text;
    const hasVisibleText = responseText.trim().length > 0;
    const hasResponseMessages = response.messages.length > 0;

    if (!hasVisibleText && !hasResponseMessages) {
      if (debugEnabled) logChatDebug("stream.empty-response-fallback", { modelId });
      return createUIMessageStreamResponse({
        stream: createEmptyResponseFallbackStream(EMPTY_PROVIDER_RESPONSE_MESSAGE),
      });
    }

    return result.toUIMessageStreamResponse();
  } catch (error) {
    releaseGate();
    if (debugEnabled) logChatDebug("stream.response-error", { message: getErrorMessage(error) });
    return createUIMessageStreamResponse({
      stream: createEmptyResponseFallbackStream(getProviderFailureMessage(error)),
    });
  }
}
