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
import { ArrowUp, AtSign, Paperclip, X } from "lucide-react";
import { ApprovalBar } from "@/components/workspace/ApprovalBar";
import { ProgressRail } from "@/components/workspace/ProgressRail";
import { ThinkingDots } from "@/components/workspace/primitives/ThinkingDots";
import { ToolCard } from "@/components/chat/ToolCard";
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

function BrandStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2 L12 22" />
      <path d="M2 12 L22 12" />
      <path d="M5 5 L19 19" />
      <path d="M19 5 L5 19" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
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

      if (!input || !input.trim()) {
        const newValue = `我上传了文件：${file.name}\n\n请查阅以下内容：\n\`\`\`\n${content}\n\`\`\``;
        setInput(newValue);
      } else {
        const newValue = `${input}\n\n[附带文件：${file.name}]\n\`\`\`\n${content}\n\`\`\``;
        setInput(newValue);
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearUploadedFile = () => {
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
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl",
        className
      )}
      style={{
        background: "var(--surface-tile)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
    >
      {/* Orchestrator progress */}
      {latestState ? <ProgressRail state={latestState} /> : null}

      {/* Message List */}
      <div
        className="flex-1 min-h-0 space-y-5 overflow-y-auto px-5 py-5"
        data-testid={chatTestIds.messageList}
      >
        {messages.length === 0 ? (
          <div
            className="flex h-full items-center justify-center text-center"
            data-testid={chatTestIds.emptyState}
          >
            <div className="max-w-sm">
              <div
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "var(--surface-inverse)" }}
              >
                <BrandStar className="h-6 w-6 text-[var(--accent)]" />
              </div>
              <h2 className="mb-2 text-[18px] font-semibold tracking-tight text-[var(--fg-primary)]">
                Agent Designer
              </h2>
              <p className="text-[13px] leading-6" style={{ color: "var(--fg-muted)" }}>
                我是你的主控 Orchestrator。你可以在左侧展开「策划准备」面板上传阶段世界观和课节知识点文档，或直接描述关卡需求开始设计流程。
              </p>
              <div
                className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px]"
                style={{
                  background: "var(--surface-elev)",
                  color: "var(--fg-secondary)",
                  boxShadow: "inset 0 0 0 1px var(--border)",
                }}
              >
                <span style={{ color: "var(--fg-faint)" }}>←</span>
                先在左侧上传文档
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const awaiting =
              m.role === "assistant" ? parseAwaitingUser(getMessageText(m)) : null;
            const messageToolParts = m.parts.filter(isToolLikePart);
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
                  <div
                    className="rounded-[18px] rounded-br-md px-4 py-2.5 text-sm"
                    style={{
                      background: "var(--surface-inverse)",
                      color: "var(--fg-inverse)",
                    }}
                  >
                    <div className="whitespace-pre-wrap">{displayText}</div>
                  </div>
                ) : (
                  <div className="flex w-full items-start gap-2.5">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "var(--surface-inverse)" }}
                    >
                      <BrandStar className="h-3.5 w-3.5 text-[var(--accent)]" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="text-[11px] font-semibold text-[var(--fg-primary)]">
                        Orchestrator
                      </div>
                      {displayText ? (
                        <div
                          className="rounded-[18px] rounded-tl-md px-4 py-2.5 text-sm"
                          style={{
                            background: "var(--surface-card)",
                            color: "var(--fg-primary)",
                            boxShadow: "inset 0 0 0 1px var(--border)",
                          }}
                        >
                          <div className="whitespace-pre-wrap">{displayText}</div>
                        </div>
                      ) : null}

                      {messageToolParts.map((toolPart) => {
                        const toolCallId = toolPart.toolCallId;
                        const toolName =
                          toolPart.type === "dynamic-tool"
                            ? toolPart.toolName
                            : toolPart.type.replace("tool-", "");
                        const artifact =
                          toolPart.state === "output-available"
                            ? getToolArtifact(toolPart.output)
                            : null;
                        const summary =
                          toolPart.state === "output-available" && artifact
                            ? `已生成「${artifact.title}」`
                            : toolPart.state === "output-error"
                              ? undefined
                              : "正在调用子智能体生成内容…";
                        const errorText =
                          toolPart.state === "output-error" && "errorText" in toolPart
                            ? (toolPart as { errorText?: string }).errorText
                            : undefined;

                        return (
                          <ToolCard
                            key={toolCallId}
                            toolName={toolName}
                            toolCallId={toolCallId}
                            status={toolPart.state}
                            summary={summary}
                            errorText={errorText}
                            artifact={
                              artifact
                                ? {
                                    title: artifact.title,
                                    courseCode: artifact.courseCode,
                                  }
                                : null
                            }
                            onArtifactJump={
                              artifact
                                ? () => setActiveArtifact(sessionId, toolCallId)
                                : undefined
                            }
                            onRetry={handleRetry}
                            retryDisabled={isLoading}
                          />
                        );
                      })}

                      {awaiting ? (
                        <ApprovalBar
                          label="等待人工确认"
                          hint={getAwaitingUserLabel(awaiting)}
                        />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        {isLoading ? (
          <div
            className="mr-auto flex max-w-[85%] items-start gap-2.5"
            data-testid={chatTestIds.loadingState}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--surface-inverse)" }}
            >
              <BrandStar className="h-3.5 w-3.5 text-[var(--accent)]" />
            </div>
            <div
              className="flex items-center gap-2.5 rounded-[18px] rounded-tl-md px-4 py-2.5"
              style={{
                background: "var(--surface-card)",
                boxShadow: "inset 0 0 0 1px var(--border)",
              }}
              aria-live="polite"
              aria-label="正在思考中"
            >
              <ThinkingDots tone="muted" />
              <span className="thinking-shimmer text-sm font-medium">正在思考中</span>
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="p-3 md:p-4">
        {uploadedFileName ? (
          <div
            className="mb-2 flex items-center justify-between rounded-xl px-3 py-2 text-sm animate-in fade-in slide-in-from-bottom-1"
            style={{
              background: "var(--surface-card)",
              boxShadow: "inset 0 0 0 1px var(--border)",
            }}
            data-testid={chatTestIds.uploadedFilePreview}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Paperclip
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--accent)" }}
              />
              <span className="truncate font-medium text-[var(--fg-primary)]">
                {uploadedFileName}
              </span>
              <span
                className="font-mono text-[10px]"
                style={{ color: "var(--fg-faint)" }}
              >
                ({uploadedFileContent?.length} 字符)
              </span>
            </div>
            <button
              type="button"
              onClick={clearUploadedFile}
              className="ml-2 shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--surface-elev)]"
              style={{ color: "var(--fg-muted)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {error ? (
          <div
            className="mb-3 rounded-xl px-3 py-2 text-sm"
            style={{
              background: "var(--danger-soft)",
              color: "var(--danger-ink)",
            }}
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
                className="rounded-full px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "var(--danger)" }}
              >
                {hasMessages ? "重新生成上一轮回复" : "重试发送"}
              </button>
            </div>
          </div>
        ) : null}

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
          className="flex flex-col gap-2 rounded-2xl p-3"
          style={{
            background: "var(--surface-card)",
            boxShadow: "inset 0 0 0 1px var(--border)",
          }}
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
            className="w-full resize-none bg-transparent text-[13px] leading-6 text-[var(--fg-primary)] placeholder:text-[var(--fg-faint)] focus:outline-none"
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-elev)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ color: "var(--fg-secondary)" }}
                title="上传题目/知识点信息文档 (.txt, .md)"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled
                aria-label="提及（即将推出）"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-elev)] disabled:cursor-not-allowed"
                style={{ color: "var(--fg-faint)" }}
                title="提及（即将推出）"
              >
                <AtSign className="h-3.5 w-3.5" />
              </button>
              <span
                className="hidden font-mono text-[10px] md:inline"
                style={{ color: "var(--fg-faint)" }}
              >
                ⌘ + ⏎ 发送
              </span>
            </div>

            <button
              type="submit"
              data-testid={chatTestIds.sendButton}
              disabled={isLoading || !input?.trim()}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors hover:opacity-90 disabled:cursor-not-allowed"
              style={{
                background: "var(--surface-inverse)",
                color: "var(--fg-inverse)",
                opacity: isLoading || !input?.trim() ? 0.4 : 1,
              }}
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
        "flex h-full items-center justify-center rounded-2xl",
        className
      )}
      style={{
        background: "var(--surface-tile)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
    >
      <div
        className="flex items-center gap-2 text-sm"
        style={{ color: "var(--fg-muted)" }}
      >
        <ThinkingDots tone="muted" />
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
