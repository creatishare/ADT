"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import { getToolArtifact } from "../../lib/chat/toolArtifact";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useArtifactStore } from "@/store/useArtifactStore";
import { useSetupStore } from "@/store/useSetupStore";
import { useModelStore } from "@/store/useModelStore";
import { ModelPicker } from "./ModelPicker";
import { Paperclip, X } from "lucide-react";
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

function getToolStatusText(state: ToolLikePart["state"]) {
  switch (state) {
    case "output-available":
      return "已完成";
    case "output-error":
      return "执行失败";
    case "approval-requested":
      return "等待确认";
    default:
      return "运行中";
  }
}

export function ChatArea({ className }: { className?: string }) {
  // Transport is created once. It reads the latest model ID at send time via
  // `useModelStore.getState()` so switching the picker does not require
  // re-creating the transport.
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
  const { messages, sendMessage, regenerate, status, error, clearError } = useChat({
    transport,
  });
  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addArtifact, setActiveArtifact } = useArtifactStore();
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
      if (m.role !== "assistant") continue;
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

      addArtifact({
        id: toolPart.toolCallId,
        title: artifact.title,
        type: artifact.type,
        content: artifact.content,
        courseCode: artifact.courseCode,
      });
    });
  }, [toolParts, addArtifact]);

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
    <div className={cn("flex h-full flex-col bg-gray-50/50", className)}>
      {/* Header bar — model picker */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Orchestrator
        </span>
        <ModelPicker />
      </div>

      {/* Orchestrator progress */}
      {latestState && (
        <div className="border-b border-gray-200 bg-blue-50/60 px-4 py-2 text-xs text-gray-700">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {latestState.currentStep !== null && (
              <span className="font-semibold text-blue-700">
                第 {latestState.currentStep}/7 步
              </span>
            )}
            {latestState.currentLesson && (
              <span>课节：{latestState.currentLesson}</span>
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
              <span className="text-gray-500">
                已记录 {latestState.accumulatedGuidance.length} 条用户偏好
              </span>
            )}
          </div>
          {latestState.totalGroups !== null && latestState.totalGroups > 0 && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full bg-blue-500 transition-all"
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
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6" data-testid={chatTestIds.messageList}>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center" data-testid={chatTestIds.emptyState}>
            <div className="max-w-sm">
              <h2 className="mb-2 text-xl font-semibold text-gray-800">Agent Designer V2</h2>
              <p className="text-gray-500">
                我是你的主控 Orchestrator。你可以在左侧展开「策划准备」面板上传阶段世界观和课节知识点文档，或直接描述关卡需求开始设计流程。
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex flex-col max-w-[85%]",
                m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 shadow-sm",
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-800"
                )}
              >
                <div className="whitespace-pre-wrap">{getDisplayText(m)}</div>

                {m.role === "assistant" &&
                  (() => {
                    const awaiting = parseAwaitingUser(getMessageText(m));
                    if (!awaiting) return null;
                    return (
                      <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <div className="flex items-start gap-2">
                          <span className="text-base leading-none">⏸️</span>
                          <div>
                            <div className="font-semibold">
                              等待人工确认
                            </div>
                            <div className="mt-0.5 text-xs">
                              {getAwaitingUserLabel(awaiting)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                {m.parts.filter(isToolLikePart).map((toolPart) => {
                  const toolCallId = toolPart.toolCallId;
                  const toolName = toolPart.type === "dynamic-tool"
                    ? toolPart.toolName
                    : toolPart.type.replace("tool-", "");
                  const toolLabel = getToolDisplayName(toolName);
                  const artifact = toolPart.state === "output-available"
                    ? getToolArtifact(toolPart.output)
                    : null;

                  return (
                    <div key={toolCallId} className="mt-2 border-t border-gray-100 pt-2 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        {toolPart.state === "output-available" ? "✅" : toolPart.state === "output-error" ? "⚠️" : "🔄"}
                        <span>{toolLabel}</span>
                        <span>{getToolStatusText(toolPart.state)}</span>
                      </div>

                      {toolPart.state === "output-error" && (
                        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          <div>工具执行失败：{"errorText" in toolPart ? toolPart.errorText : "请稍后重试"}</div>
                          <button
                            type="button"
                            onClick={handleRetry}
                            disabled={isLoading}
                            className="mt-2 rounded bg-red-100 px-2.5 py-1 text-xs text-red-800 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            重新生成本轮回复
                          </button>
                        </div>
                      )}

                      {artifact && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-600">已自动同步到右侧工件区：{artifact.title}</span>
                          <button
                            type="button"
                            onClick={() => setActiveArtifact(toolCallId)}
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-200"
                          >
                            在右侧查看
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="mr-auto flex max-w-[85%] items-start" data-testid={chatTestIds.loadingState}>
            <div className="rounded-2xl bg-white border border-gray-200 px-4 py-2.5 shadow-sm text-gray-400">
              正在思考中...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        {/* Uploaded File Preview */}
        {uploadedFileName && (
          <div className="mb-2 flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800 shadow-sm transition-all animate-in fade-in slide-in-from-bottom-1" data-testid={chatTestIds.uploadedFilePreview}>
            <div className="flex items-center gap-2 truncate">
              <Paperclip className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="font-medium truncate">{uploadedFileName}</span>
              <span className="text-xs text-blue-400">({uploadedFileContent?.length} 字符)</span>
            </div>
            <button
              type="button"
              onClick={clearUploadedFile}
              className="ml-2 shrink-0 rounded-full p-1 text-blue-500 hover:bg-blue-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid={chatTestIds.requestError}>
            <div className="flex items-start justify-between gap-3">
              <span>请求失败：{error.message}</span>
              <button type="button" onClick={clearError} className="shrink-0 rounded px-2 py-0.5 text-xs hover:bg-red-100">
                关闭
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isLoading || (!hasMessages && !input.trim())}
                className="rounded bg-red-100 px-3 py-1 text-xs text-red-800 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="relative"
        >
          <input
            type="file"
            accept=".md,.txt,.json,.csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            data-testid={chatTestIds.uploadButton}
            className="absolute left-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 transition-colors"
            title="上传题目/知识点信息文档 (.txt, .md)"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <textarea
            data-testid={chatTestIds.input}
            className="w-full resize-none overflow-y-auto rounded-xl border border-gray-300 pl-12 pr-20 py-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 max-h-32"
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
          <button
            type="submit"
            data-testid={chatTestIds.sendButton}
            disabled={isLoading || !input?.trim()}
            className="absolute bottom-3 right-3 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            发送
          </button>
        </form>
      </div>
    </div>
  );
}