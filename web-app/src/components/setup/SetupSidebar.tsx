"use client";

import { useRef, useState } from "react";
import { useSetupStore } from "@/store/useSetupStore";
import { useArtifactStore, type Artifact } from "@/store/useArtifactStore";
import { useConversationStore } from "@/store/useConversationStore";
import { SessionSwitcher } from "@/components/workspace/SessionSwitcher";
import { UploadCard } from "@/components/setup/UploadCard";
import { ModeSelector } from "@/components/setup/ModeSelector";
import { GroupPicker } from "@/components/setup/GroupPicker";
import { parseLessonGroups } from "@/lib/setup/parseLessonGroups";
import {
  buildInitialPrompt,
  type PlanningMode,
  type UploadedDoc,
} from "@/lib/setup/buildInitialPrompt";

const EMPTY_ARTIFACTS: readonly Artifact[] = Object.freeze([]);
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Code2,
  Download,
  FileText,
  FolderDown,
  Image as ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from "lucide-react";
import { formatTimestamp } from "@/lib/chat/artifactParser";

function readTextFile(
  file: File,
  onResult: (doc: UploadedDoc) => void
) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target?.result as string;
    onResult({ name: file.name, content });
  };
  reader.readAsText(file);
}

interface StartDisabledInput {
  planningMode: PlanningMode;
  worldDoc: UploadedDoc | null;
  lessonDoc: UploadedDoc | null;
  shellDoc: UploadedDoc | null;
  selectedGroupIndex: number | null;
}

function computeStartDisabled({
  planningMode,
  worldDoc,
  lessonDoc,
  shellDoc,
  selectedGroupIndex,
}: StartDisabledInput): boolean {
  if (!worldDoc || !lessonDoc) return true;
  if (planningMode === "single-group" && selectedGroupIndex == null) return true;
  if (planningMode === "integration" && !shellDoc) return true;
  return false;
}

function buildDownloadBlob(
  artifacts: Array<{ title: string; content: string; timestamp: number; courseCode?: string }>
) {
  const parts = artifacts.map((a) => {
    const heading = a.courseCode ? `${a.courseCode} ${a.title}` : a.title;
    return `# ${heading}\n\n${a.content}\n\n---\n`;
  });
  return new Blob([parts.join("\n")], { type: "text/markdown;charset=utf-8" });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function makeDownloadFilename() {
  const dateStr = new Date()
    .toLocaleString("zh-CN", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/[/:\s]/g, "_");
  return `关卡设计成果_${dateStr}.md`;
}

export function SetupSidebar() {
  const {
    isCollapsed,
    toggleCollapse,
    worldDoc,
    lessonDoc,
    shellDoc,
    planningMode,
    parsedGroups,
    selectedGroupIndex,
    initialPrompt,
    setWorldDoc,
    setLessonDoc,
    setShellDoc,
    setPlanningMode,
    setParsedGroups,
    setSelectedGroupIndex,
    setInitialPrompt,
  } = useSetupStore();
  const activeSessionId = useConversationStore((s) => s.activeSessionId);
  const artifacts = useArtifactStore((s) =>
    activeSessionId
      ? s.bySession[activeSessionId] ?? (EMPTY_ARTIFACTS as Artifact[])
      : (EMPTY_ARTIFACTS as Artifact[])
  );
  const deleteArtifact = useArtifactStore((s) => s.deleteArtifact);
  const worldInputRef = useRef<HTMLInputElement>(null);
  const lessonInputRef = useRef<HTMLInputElement>(null);
  const shellInputRef = useRef<HTMLInputElement>(null);

  const [outputsExpanded, setOutputsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const sortedArtifacts = [...artifacts].sort((a, b) => a.timestamp - b.timestamp);

  const handleWorldUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readTextFile(file, setWorldDoc);
    if (worldInputRef.current) worldInputRef.current.value = "";
  };

  const handleLessonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readTextFile(file, (doc) => {
      setLessonDoc(doc);
      const groups = parseLessonGroups(doc.content);
      setParsedGroups(groups);
      // 重置选中题组：避免上传新文档时残留旧选项
      setSelectedGroupIndex(null);
    });
    if (lessonInputRef.current) lessonInputRef.current.value = "";
  };

  const handleShellUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readTextFile(file, setShellDoc);
    if (shellInputRef.current) shellInputRef.current.value = "";
  };

  const handleModeChange = (next: PlanningMode) => {
    if (next === planningMode) return;
    const convo = useConversationStore.getState();
    const active = convo.activeSessionId;
    const hasOngoing =
      active && (convo.sessions[active]?.messages.length ?? 0) > 0;
    if (hasOngoing) {
      const ok = window.confirm(
        "切换策划模式将开启一个新会话（当前会话保留在历史中）。是否继续？"
      );
      if (!ok) return;
      convo.createSession({
        docsSnapshot: {
          worldDocName: worldDoc?.name,
          lessonDocName: lessonDoc?.name,
          shellDocName: shellDoc?.name,
          planningMode: next,
        },
      });
    }
    setPlanningMode(next);
    // 切换模式时清掉与目标模式无关的状态，避免误用
    if (next !== "single-group") setSelectedGroupIndex(null);
    if (next !== "integration") setShellDoc(null);
  };

  // initialPrompt 不为空说明上一次点击触发的 prompt 还没被 ChatSession 消费，
  // 此时按钮立即灰掉，防止用户连点导致重复 createSession + 重复 sendMessage。
  const hasPendingPrompt = initialPrompt !== null;

  const startDisabled =
    hasPendingPrompt ||
    computeStartDisabled({
      planningMode,
      worldDoc,
      lessonDoc,
      shellDoc,
      selectedGroupIndex,
    });

  const handleStartPlanning = () => {
    if (startDisabled) return;
    if (!worldDoc || !lessonDoc) return;
    // 二次防御：直接读最新 store，避免 React 状态批处理窗口内的 race。
    if (useSetupStore.getState().initialPrompt !== null) return;
    const prompt = buildInitialPrompt({
      mode: planningMode,
      worldDoc,
      lessonDoc,
      parsedGroups,
      selectedGroupIndex,
      shellDoc,
    });
    const convo = useConversationStore.getState();
    const active = convo.activeSessionId;
    const shouldCreateNew =
      !active ||
      (convo.sessions[active]?.messages.length ?? 0) > 0;
    if (shouldCreateNew) {
      convo.createSession({
        docsSnapshot: {
          worldDocName: worldDoc.name,
          lessonDocName: lessonDoc.name,
          shellDocName: shellDoc?.name,
          planningMode,
          selectedGroupIndex,
        },
      });
    }
    setInitialPrompt(prompt);
  };

  const toggleOutputs = () => {
    setOutputsExpanded((prev) => {
      const next = !prev;
      if (next && selectedIds.length === 0) {
        setSelectedIds(sortedArtifacts.map((a) => a.id));
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedArtifacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedArtifacts.map((a) => a.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDelete = (id: string) => {
    if (!activeSessionId) return;
    deleteArtifact(activeSessionId, id);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const handleDownloadSelected = () => {
    const selected = sortedArtifacts.filter((a) => selectedIds.includes(a.id));
    if (selected.length === 0) return;
    const blob = buildDownloadBlob(selected);
    triggerDownload(blob, makeDownloadFilename());
  };

  if (isCollapsed) {
    return (
      <div
        className="mr-3 flex h-full w-12 shrink-0 flex-col items-center rounded-2xl py-3"
        style={{
          background: "var(--surface-tile)",
          boxShadow: "inset 0 0 0 1px var(--border)",
        }}
      >
        <button
          type="button"
          onClick={toggleCollapse}
          title="展开策划准备"
          className="rounded-full p-2 transition-colors hover:bg-[var(--surface-elev)]"
          style={{ color: "var(--fg-muted)" }}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }


  return (
    <div
      className="mr-3 flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface-tile)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--fg-faint)" }}
        >
          策划准备
        </span>
        <button
          type="button"
          onClick={toggleCollapse}
          title="折叠策划准备"
          className="rounded-full p-1.5 transition-colors hover:bg-[var(--surface-elev)]"
          style={{ color: "var(--fg-muted)" }}
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
        <SessionSwitcher />

        <ModeSelector value={planningMode} onChange={handleModeChange} />

        <UploadCard
          step="STEP 01"
          title="阶段世界观"
          description="整个阶段共用的剧情世界观"
          doc={worldDoc}
          onUpload={handleWorldUpload}
          onClear={() => setWorldDoc(null)}
          inputRef={worldInputRef}
        />

        <UploadCard
          step="STEP 02"
          title="课节知识点"
          description="当前课节的知识点整理文档"
          doc={lessonDoc}
          onUpload={handleLessonUpload}
          onClear={() => {
            setLessonDoc(null);
            setParsedGroups([]);
            setSelectedGroupIndex(null);
          }}
          inputRef={lessonInputRef}
        />

        {planningMode === "single-group" ? (
          <GroupPicker
            groups={parsedGroups}
            value={selectedGroupIndex}
            onChange={setSelectedGroupIndex}
            lessonReady={Boolean(lessonDoc)}
          />
        ) : null}

        {planningMode === "integration" ? (
          <div data-testid="shell-upload-slot">
            <UploadCard
              step="STEP 03"
              title="壳子方案文档"
              description="用户已为各题组想好的壳子方案 .md / .txt"
              doc={shellDoc}
              onUpload={handleShellUpload}
              onClear={() => setShellDoc(null)}
              inputRef={shellInputRef}
            />
          </div>
        ) : null}

        <button
          type="button"
          data-testid="start-planning-button"
          disabled={startDisabled}
          onClick={handleStartPlanning}
          className="inline-flex items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed"
          style={{
            background: startDisabled
              ? "var(--surface-elev)"
              : "var(--surface-inverse)",
            color: startDisabled ? "var(--fg-faint)" : "var(--fg-inverse)",
            boxShadow: startDisabled
              ? "inset 0 0 0 1px var(--border)"
              : "none",
          }}
        >
          <span>开始策划</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        {sortedArtifacts.length > 0 ? (
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              background: "var(--surface-elev)",
              boxShadow: "inset 0 0 0 1px var(--border)",
            }}
          >
            <button
              type="button"
              onClick={toggleOutputs}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors"
              aria-expanded={outputsExpanded}
            >
              <span className="flex items-center gap-2 text-[12px] font-semibold text-[var(--fg-primary)]">
                <FolderDown
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--fg-muted)" }}
                />
                成果管理
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent-ink)",
                  }}
                >
                  {sortedArtifacts.length}
                </span>
              </span>
              {outputsExpanded ? (
                <ChevronUp
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--fg-faint)" }}
                />
              ) : (
                <ChevronDown
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--fg-faint)" }}
                />
              )}
            </button>

            {outputsExpanded ? (
              <div
                className="border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <div
                  className="flex items-center justify-between gap-2 px-3 py-2"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-[11px] font-medium transition-colors hover:underline"
                    style={{ color: "var(--accent-ink)" }}
                  >
                    {selectedIds.length === sortedArtifacts.length
                      ? "取消全选"
                      : "全选"}
                  </button>
                  <div className="ml-auto flex items-center gap-2">
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: "var(--fg-faint)" }}
                    >
                      已选 {selectedIds.length} / {sortedArtifacts.length}
                    </span>
                    <button
                      type="button"
                      disabled={selectedIds.length === 0}
                      onClick={handleDownloadSelected}
                      title={
                        selectedIds.length === 0
                          ? "请先勾选要下载的成果"
                          : `下载选中的 ${selectedIds.length} 份成果`
                      }
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed"
                      style={{
                        background:
                          selectedIds.length === 0
                            ? "var(--surface-elev)"
                            : "var(--surface-inverse)",
                        color:
                          selectedIds.length === 0
                            ? "var(--fg-faint)"
                            : "var(--fg-inverse)",
                        boxShadow:
                          selectedIds.length === 0
                            ? "inset 0 0 0 1px var(--border)"
                            : "none",
                      }}
                    >
                      <Download className="h-3 w-3" />
                      下载
                    </button>
                  </div>
                </div>

                <ul className="max-h-64 overflow-y-auto">
                  {sortedArtifacts.map((artifact) => {
                    const isSelected = selectedIds.includes(artifact.id);
                    const Icon =
                      artifact.type === "image"
                        ? ImageIcon
                        : artifact.type === "code"
                          ? Code2
                          : FileText;
                    return (
                      <li
                        key={artifact.id}
                        className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--surface-card)]"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(artifact.id)}
                          className="h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                        />
                        <Icon
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: "var(--fg-muted)" }}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-[11px] font-medium"
                            style={{ color: "var(--fg-primary)" }}
                          >
                            {artifact.courseCode ? (
                              <span
                                className="font-mono"
                                style={{ color: "var(--fg-faint)" }}
                              >
                                {artifact.courseCode}{" "}
                              </span>
                            ) : null}
                            {artifact.title}
                          </p>
                          <p
                            className="font-mono text-[10px]"
                            style={{ color: "var(--fg-faint)" }}
                          >
                            {formatTimestamp(artifact.timestamp)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(artifact.id)}
                          title="删除此成果"
                          className="shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--danger-soft)]"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
