"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import { getToolArtifact } from "../../lib/chat/toolArtifact";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useArtifactStore } from "@/store/useArtifactStore";
import { useSetupStore } from "@/store/useSetupStore";
import { useModelStore } from "@/store/useModelStore";
import { useConversationStore } from "@/store/useConversationStore";
import {
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Gamepad2,
  Paperclip,
  PenLine,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ApprovalBar } from "@/components/workspace/ApprovalBar";
import {
  parseAwaitingUser,
  parseOrchestratorState,
  stripOrchestratorMeta,
  getAwaitingUserLabel,
  type OrchestratorState,
} from "@/lib/chat/artifactParser";

type MessagePart = UIMessage["parts"][number];
type ToolLikePart = Extract<MessagePart, { toolCallId: string }>;

const chatTestIds = {
  emptyState: "chat-empty-state",
  messageList: "chat-message-list",
  input: "chat-input",
  sendButton: "chat-send-button",
  uploadButton: "chat-upload-button",
  uploadedFilePreview: "chat-uploaded-file-preview",
  requestError: "chat-request-error",
  loadingState: "chat-loading-state",
};

function isToolLikePart(part: MessagePart): part is ToolLikePart {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n");
}

const SETUP_MESSAGE_PREFIX = "请根据以下资料开始关卡设计流程";

function getDisplayText(message: UIMessage): string {
  const text = getMessageText(message);
  if (message.role === "assistant") {
    return stripOrchestratorMeta(text);
  }
  if (message.role !== "user" || !text.startsWith(SETUP_MESSAGE_PREFIX)) {
    return text;
  }
  const lessonMatch = text.match(/## 课节知识点整理文档\n文件名：(.+)/);
  const filename = lessonMatch?.[1]?.trim() ?? "";
  const courseMatch = filename.match(/L\d+-\d+-[高低]年级/);
  if (courseMatch) {
    return `开始进行 ${courseMatch[0]} 关卡策划`;
  }
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "") || "关卡";
  return `开始进行关卡策划（${nameWithoutExt}）`;
}

function getToolDisplayName(toolName: string) {
  const toolNameMap: Record<string, string> = {
    designStageFile: "关卡策划师",
    writeStageFile: "文档编写师",
    validateStageFile: "关卡验证师",
    generateVisualDesign: "视觉设计师",
  };

  return toolNameMap[toolName] ?? toolName;
}

const toolIconMap: Record<string, LucideIcon> = {
  designStageFile: Gamepad2,
  writeStageFile: PenLine,
  validateStageFile: ShieldCheck,
  generateVisualDesign: Sparkles,
};

function getToolIcon(toolName: string): LucideIcon {
  return toolIconMap[toolName] ?? Workflow;
}

function ToolStatusPill({ state }: { state: ToolLikePart["state"] }) {
  if (state === "output-available") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--success-ink)]">
        <CheckCircle2 className="h-3 w-3" />
        已完成
      </span>
    );
  }
  if (state === "output-error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--danger)]">
        <AlertTriangle className="h-3 w-3" />
        执行失败
      </span>
    );
  }
  if (state === "approval-requested") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--accent-ink)]">
        等待确认
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--accent-ink)]">
      <span className="flex items-center gap-0.5">
        <span
          className="thinking-dot h-1 w-1 rounded-full bg-[var(--accent)]"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="thinking-dot h-1 w-1 rounded-full bg-[var(--accent)]"
          style={{ animationDelay: "160ms" }}
        />
        <span
          className="thinking-dot h-1 w-1 rounded-full bg-[var(--accent)]"
          style={{ animationDelay: "320ms" }}
        />
      </span>
      运行中
    </span>
  );
}

interface ChatSessionProps {
  sessionId: string;
  className?: string;
}

function ChatSession({ sessionId, className }: ChatSessionProps) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => ({
          "x-model-id": useModelStore.getState().modelId,
        }),
      }),
    []
  );

  const initialMessages = useMemo<UIMessage[]>(
    () =>
      useConversationStore.getState().sessions[sessionId]?.messages ?? [],
    [sessionId]
  );

  const { messages, sendMessage, regenerate, status, error, clearError } = useChat({
    transport,
    messages: initialMessages,
  });
  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addArtifact = useArtifactStore((s) => s.addArtifact);
  const setActiveArtifact = useArtifactStore((s) => s.setActiveArtifact);
  const { initialPrompt, clearInitialPrompt } = useSetupStore();

  const [uploadedFileContent, setUploadedFileContent] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toolParts = useMemo(
    () => messages.flatMap((message) => message.parts.filter(isToolLikePart)),
    [messages]
  );

  const latestState: OrchestratorState | null = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (!m || m.role !== "assistant") continue;
      const parsed = parseOrchestratorState(getMessageText(m));
      if (parsed) return parsed;
    }
    return null;
  }, [messages]);

  useEffect(() => {
    toolParts.forEach((toolPart) => {
      if (toolPart.state !== "output-available") return;

      const artifact = getToolArtifact(toolPart.output);
      if (!artifact) return;

      addArtifact(sessionId, {
        id: toolPart.toolCallId,
        title: artifact.title,
        type: artifact.type,
        content: artifact.content,
        courseCode: artifact.courseCode,
      });
    });
  }, [toolParts, addArtifact, sessionId]);

  useEffect(() => {
    useConversationStore.getState().setMessages(sessionId, messages);
  }, [sessionId, messages]);

  useEffect(() => {
    if (!initialPrompt || messages.length > 0 || isLoading) return;
    const prompt = initialPrompt;
    clearInitialPrompt();
    sendMessage({ text: prompt });
  }, [initialPrompt, messages.length, isLoading, sendMessage, clearInitialPrompt]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadedFileContent(content);
      setUploadedFileName(file.name);

      // Auto-append to input if empty, or just keep it in state to send along
      if (!input || !input.trim()) {
        const newValue = `我上传了文件：${file.name}\n\n请查阅以下内容：\n\`\`\`\n${content}\n\`\`\``;
        setInput(newValue);
      } else {
        const newValue = `${input}\n\n[附带文件：${file.name}]\n\`\`\`\n${content}\n\`\`\``;
        setInput(newValue);
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearUploadedFile = () => {
    // If the input exactly matches what we auto-generated, clear the input too
    if (input?.includes(uploadedFileName || "") && input?.includes(uploadedFileContent || "")) {
      setInput("");
    }
    setUploadedFileContent(null);
    setUploadedFileName(null);
  };

  const handleRetry = async () => {
    if (isLoading) return;

    clearError();

    if (hasMessages) {
      await regenerate();
      return;
    }

    if (!input.trim()) return;

    try {
      await sendMessage({ text: input });
    } catch {
      // 错误由 useChat 的 error 状态统一承接
    }
  };

  return (
    <div className={cn("flex h-full flex-col bg-[var(--surface-tile)] rounded-2xl overflow-hidden", className)}>
      {/* Orchestrator progress */}
      {latestState && (
        <div className="border-b border-[color-mix(in_oklch,var(--surface-ground)_70%,transparent)] bg-[color-mix(in_oklch,var(--accent-soft)_45%,transparent)] px-5 py-2.5 text-xs text-[var(--fg-secondary)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {latestState.currentStep !== null && (
              <span className="inline-flex items-center rounded-full bg-[var(--surface-inverse)] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--fg-inverse)]">
                {latestState.currentStep}/7
              </span>
            )}
            {latestState.currentLesson && (
              <span className="font-medium text-[var(--fg-primary)]">
                {latestState.currentLesson}
              </span>
            )}
            {latestState.totalGroups !== null && (
              <span>
                进度：{latestState.processedGroups.length}/
                {latestState.totalGroups} 题组
                {latestState.currentGroup
                  ? `（当前 ${latestState.currentGroup}）`
                  : ""}
              </span>
            )}
            {latestState.accumulatedGuidance.length > 0 && (
              <span className="text-[var(--fg-muted)]">
                已记录 {latestState.accumulatedGuidance.length} 条用户偏好
              </span>
            )}
          </div>
          {latestState.totalGroups !== null && latestState.totalGroups > 0 && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--surface-ground)_70%,transparent)]">
              <div
                className="h-full bg-[var(--accent)] transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (latestState.processedGroups.length /
                      latestState.totalGroups) *
                      100
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Message List */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5"
        data-testid={chatTestIds.messageList}
      >
        {messages.length === 0 ? (
          <div
            className="flex h-full items-center justify-center text-center"
            data-testid={chatTestIds.emptyState}
          >
            <div className="max-w-sm">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-inverse)]">
                <Workflow className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
              </div>
              <h2 className="mb-2 text-lg font-semibold tracking-tight text-[var(--fg-primary)]">
                Agent Designer V2
              </h2>
              <p className="text-sm leading-6 text-[var(--fg-muted)]">
                我是你的主控 Orchestrator。你可以在左侧展开「策划准备」面板上传阶段世界观和课节知识点文档，或直接描述关卡需求开始设计流程。
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const awaiting =
              m.role === "assistant" ? parseAwaitingUser(getMessageText(m)) : null;
            const toolParts = m.parts.filter(isToolLikePart);
            const isUser = m.role === "user";
            const displayText = getDisplayText(m);
            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col gap-2",
                  isUser ? "ml-auto items-end max-w-[85%]" : "mr-auto items-start max-w-[92%]"
                )}
              >
                {isUser ? (
                  <div className="rounded-[18px] rounded-br-md bg-[var(--surface-inverse)] px-4 py-2.5 text-sm text-[var(--fg-inverse)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                    <div className="whitespace-pre-wrap">{displayText}</div>
                  </div>
                ) : (
                  <div className="flex w-full items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-inverse)]">
                      <Workflow className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="text-[11px] font-semibold text-[var(--fg-primary)]">
                        Orchestrator
                      </div>
                      {displayText && (
                        <div className="rounded-[18px] rounded-tl-md bg-[var(--surface-card)] px-4 py-2.5 text-sm text-[var(--fg-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                          <div className="whitespace-pre-wrap">{displayText}</div>
                        </div>
                      )}

                      {toolParts.map((toolPart) => {
                        const toolCallId = toolPart.toolCallId;
                        const toolName =
                          toolPart.type === "dynamic-tool"
                            ? toolPart.toolName
                            : toolPart.type.replace("tool-", "");
                        const toolLabel = getToolDisplayName(toolName);
                        const Icon = getToolIcon(toolName);
                        const artifact =
                          toolPart.state === "output-available"
                            ? getToolArtifact(toolPart.output)
                            : null;

                        return (
                          <div
                            key={toolCallId}
                            className="flex flex-col gap-2 rounded-2xl bg-[var(--surface-card)] p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
                                <Icon
                                  className="h-4 w-4 text-[var(--fg-primary)]"
                                  aria-hidden="true"
                                />
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="text-[12px] font-semibold text-[var(--fg-primary)]">
                                  {toolLabel}
                                </span>
                                <span className="font-mono text-[10px] text-[var(--fg-muted)]">
                                  {toolName}
                                </span>
                              </div>
                              <ToolStatusPill state={toolPart.state} />
                            </div>

                            {toolPart.state === "output-error" && (
                              <div className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                                <div>
                                  工具执行失败：
                                  {"errorText" in toolPart ? toolPart.errorText : "请稍后重试"}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleRetry}
                                  disabled={isLoading}
                                  className="mt-2 rounded-full bg-[var(--danger)] px-3 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  重新生成本轮回复
                                </button>
                              </div>
                            )}

                            {artifact && (
                              <button
                                type="button"
                                onClick={() => setActiveArtifact(sessionId, toolCallId)}
                                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-ground)] px-3 py-2 text-left text-[11px] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--accent-soft)]"
                              >
                                <span className="truncate">
                                  已同步到右侧：
                                  <span className="font-medium text-[var(--fg-primary)]">
                                    {artifact.title}
                                  </span>
                                </span>
                                <span className="inline-flex items-center gap-1 font-medium text-[var(--fg-primary)]">
                                  查看
                                  <ChevronRight className="h-3 w-3" />
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {awaiting && (
                        <ApprovalBar
                          label="等待人工确认"
                          hint={getAwaitingUserLabel(awaiting)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        {isLoading && (
          <div
            className="mr-auto flex max-w-[85%] items-start gap-2.5"
            data-testid={chatTestIds.loadingState}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-inverse)]">
              <Workflow
                className="h-3.5 w-3.5 text-[var(--accent)]"
                aria-hidden="true"
              />
            </div>
            <div
              className="flex items-center gap-2.5 rounded-[18px] rounded-tl-md bg-[var(--surface-card)] px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              aria-live="polite"
              aria-label="正在思考中"
            >
              <span className="flex items-center gap-1" aria-hidden="true">
                <span
                  className="thinking-dot block h-1.5 w-1.5 rounded-full bg-[var(--fg-muted)]"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="thinking-dot block h-1.5 w-1.5 rounded-full bg-[var(--fg-muted)]"
                  style={{ animationDelay: "160ms" }}
                />
                <span
                  className="thinking-dot block h-1.5 w-1.5 rounded-full bg-[var(--fg-muted)]"
                  style={{ animationDelay: "320ms" }}
                />
              </span>
              <span className="thinking-shimmer text-sm font-medium">正在思考中</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="p-3 md:p-4">
        {uploadedFileName && (
          <div
            className="mb-2 flex items-center justify-between rounded-xl bg-[var(--surface-card)] px-3 py-2 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] animate-in fade-in slide-in-from-bottom-1"
            data-testid={chatTestIds.uploadedFilePreview}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Paperclip className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              <span className="truncate font-medium text-[var(--fg-primary)]">{uploadedFileName}</span>
              <span className="font-mono text-[10px] text-[var(--fg-muted)]">
                ({uploadedFileContent?.length} 字符)
              </span>
            </div>
            <button
              type="button"
              onClick={clearUploadedFile}
              className="ml-2 shrink-0 rounded-full p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-ground)] hover:text-[var(--fg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <div
            className="mb-3 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]"
            data-testid={chatTestIds.requestError}
          >
            <div className="flex items-start justify-between gap-3">
              <span>请求失败：{error.message}</span>
              <button
                type="button"
                onClick={clearError}
                className="shrink-0 rounded px-2 py-0.5 text-xs transition-colors hover:bg-white/60"
              >
                关闭
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isLoading || (!hasMessages && !input.trim())}
                className="rounded-full bg-[var(--danger)] px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {hasMessages ? "重新生成上一轮回复" : "重试发送"}
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!input.trim() || isLoading) return;

            try {
              const nextInput = input;
              await sendMessage({ text: nextInput });
              setInput("");
              setUploadedFileContent(null);
              setUploadedFileName(null);
            } catch {
              // 错误由 useChat 的 error 状态统一承接
            }
          }}
          className="flex flex-col gap-2 rounded-2xl bg-[var(--surface-card)] p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:ring-1 focus-within:ring-[var(--accent)]/40"
        >
          <input
            type="file"
            accept=".md,.txt,.json,.csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />

          <textarea
            data-testid={chatTestIds.input}
            className="w-full resize-none bg-transparent text-sm leading-6 text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:outline-none"
            placeholder="描述你的关卡需求，或上传题组/知识点文档…"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const form = e.currentTarget.form;
                if (form && !isLoading && input.trim()) form.requestSubmit();
              }
            }}
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                data-testid={chatTestIds.uploadButton}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-ground)] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-50"
                title="上传题目/知识点信息文档 (.txt, .md)"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <span className="hidden md:inline font-mono text-[10px] text-[var(--fg-muted)]">
                ⌘ + ⏎ 发送
              </span>
            </div>

            <button
              type="submit"
              data-testid={chatTestIds.sendButton}
              disabled={isLoading || !input?.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-inverse)] px-4 py-1.5 text-xs font-semibold text-[var(--fg-inverse)] transition-colors hover:bg-[var(--fg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              发送
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function subscribeHydration(callback: () => void): () => void {
  return useConversationStore.persist.onFinishHydration(callback);
}

function getHydrationSnapshot(): boolean {
  return useConversationStore.persist.hasHydrated();
}

function getServerHydrationSnapshot(): boolean {
  return false;
}

function useConversationHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    getHydrationSnapshot,
    getServerHydrationSnapshot
  );
}

function ChatAreaSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full items-center justify-center rounded-2xl bg-[var(--surface-tile)]",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
        <span className="flex items-center gap-0.5" aria-hidden="true">
          <span
            className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--fg-muted)]"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--fg-muted)]"
            style={{ animationDelay: "160ms" }}
          />
          <span
            className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--fg-muted)]"
            style={{ animationDelay: "320ms" }}
          />
        </span>
        正在加载会话…
      </div>
    </div>
  );
}

export function ChatArea({ className }: { className?: string }) {
  const hydrated = useConversationHydrated();
  const activeSessionId = useConversationStore((s) => s.activeSessionId);
  const createSession = useConversationStore((s) => s.createSession);

  useEffect(() => {
    if (!hydrated) return;
    if (activeSessionId) return;
    const { worldDoc, lessonDoc } = useSetupStore.getState();
    createSession({
      docsSnapshot: {
        worldDocName: worldDoc?.name,
        lessonDocName: lessonDoc?.name,
      },
    });
  }, [hydrated, activeSessionId, createSession]);

  if (!hydrated || !activeSessionId) {
    return <ChatAreaSkeleton className={className} />;
  }

  return (
    <ChatSession
      key={activeSessionId}
      sessionId={activeSessionId}
      className={className}
    />
  );
}