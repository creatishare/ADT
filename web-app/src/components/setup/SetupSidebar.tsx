"use client";

import { useRef, useState } from "react";
import { useSetupStore } from "@/store/useSetupStore";
import { useArtifactStore, type Artifact } from "@/store/useArtifactStore";
import { useConversationStore } from "@/store/useConversationStore";
import { SessionSwitcher } from "@/components/workspace/SessionSwitcher";

const EMPTY_ARTIFACTS: readonly Artifact[] = Object.freeze([]);
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  FileText,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatTimestamp } from "@/lib/chat/artifactParser";

interface UploadedDoc {
  name: string;
  content: string;
}

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

function buildInitialPrompt(worldDoc: UploadedDoc, lessonDoc: UploadedDoc) {
  return `请根据以下资料开始关卡设计流程。

## 阶段世界观文档
文件名：${worldDoc.name}

\`\`\`
${worldDoc.content}
\`\`\`

## 课节知识点整理文档
文件名：${lessonDoc.name}

\`\`\`
${lessonDoc.content}
\`\`\`

请按照7步法工作流，从第一个题组开始，依次生成各题组的核心包装概念。请先针对第一个题组生成5个候选概念供我筛选。`;
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
    setWorldDoc,
    setLessonDoc,
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

  const [isManaging, setIsManaging] = useState(false);
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
    readTextFile(file, setLessonDoc);
    if (lessonInputRef.current) lessonInputRef.current.value = "";
  };

  const handleStartPlanning = () => {
    if (!worldDoc || !lessonDoc) return;
    const prompt = buildInitialPrompt(worldDoc, lessonDoc);
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
        },
      });
    }
    setInitialPrompt(prompt);
    toggleCollapse();
  };

  const openManagePanel = () => {
    setSelectedIds(sortedArtifacts.map((a) => a.id));
    setIsManaging(true);
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
      <div className="w-12 mr-3 flex flex-col items-center h-full rounded-2xl bg-[var(--surface-tile)] py-3 shrink-0">
        <button
          type="button"
          onClick={toggleCollapse}
          title="展开策划准备"
          className="rounded-full p-2 text-[var(--fg-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 mr-3 flex flex-col h-full rounded-2xl bg-[var(--surface-tile)] shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 className="font-semibold text-sm tracking-tight text-[var(--fg-primary)]">
          策划准备
        </h3>
        <button
          type="button"
          onClick={toggleCollapse}
          title="折叠策划准备"
          className="rounded-full p-1.5 text-[var(--fg-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <SessionSwitcher />
        <DocUploadCard
          title="阶段世界观文档"
          description="上传整个阶段共用的剧情世界观"
          doc={worldDoc}
          onUpload={handleWorldUpload}
          onClear={() => setWorldDoc(null)}
          inputRef={worldInputRef}
        />
        <DocUploadCard
          title="课节知识点文档"
          description="上传当前课节的知识点整理"
          doc={lessonDoc}
          onUpload={handleLessonUpload}
          onClear={() => setLessonDoc(null)}
          inputRef={lessonInputRef}
        />

        <Button
          disabled={!worldDoc || !lessonDoc}
          onClick={handleStartPlanning}
          className="w-full"
        >
          开始策划
        </Button>

        {sortedArtifacts.length > 0 && (
          <div className="rounded-2xl bg-[var(--surface-ground)] overflow-hidden">
            <button
              type="button"
              onClick={() => (isManaging ? setIsManaging(false) : openManagePanel())}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[var(--fg-primary)] hover:bg-[var(--accent-soft)]/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4 text-[var(--fg-muted)]" />
                成果管理
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-ink)]">
                  {sortedArtifacts.length} 个
                </span>
              </span>
              {isManaging ? (
                <ChevronUp className="h-4 w-4 text-[var(--fg-muted)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--fg-muted)]" />
              )}
            </button>

            {isManaging && (
              <div className="bg-[var(--surface-card)]">
                {/* Select-all toolbar */}
                <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-ground)]">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-medium text-[var(--accent-ink)] hover:underline"
                  >
                    {selectedIds.length === sortedArtifacts.length
                      ? "取消全选"
                      : "全选"}
                  </button>
                  <span className="text-xs text-[var(--fg-muted)]">
                    已选 {selectedIds.length} / {sortedArtifacts.length}
                  </span>
                </div>

                {/* Artifact list */}
                <ul className="max-h-64 overflow-y-auto">
                  {sortedArtifacts.map((artifact) => {
                    const label = artifact.courseCode
                      ? `${artifact.courseCode} ${artifact.title}`
                      : artifact.title;
                    const isSelected = selectedIds.includes(artifact.id);
                    return (
                      <li
                        key={artifact.id}
                        className="flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--surface-ground)] transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(artifact.id)}
                          className="h-4 w-4 rounded border-[var(--fg-muted)] text-[var(--accent)] accent-[var(--accent)] shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[var(--fg-primary)]">
                            {label}
                          </p>
                          <p className="text-xs text-[var(--fg-muted)]">
                            {formatTimestamp(artifact.timestamp)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(artifact.id)}
                          title="删除此成果"
                          className="shrink-0 rounded-full p-1 text-[var(--fg-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* Download footer */}
                <div className="p-3 bg-[var(--surface-ground)]">
                  <Button
                    disabled={selectedIds.length === 0}
                    onClick={handleDownloadSelected}
                    className="w-full"
                    size="sm"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    下载选中 ({selectedIds.length} 个)
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DocUploadCard({
  title,
  description,
  doc,
  onUpload,
  onClear,
  inputRef,
}: {
  title: string;
  description: string;
  doc: UploadedDoc | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <input
          type="file"
          accept=".md,.txt,.json,.csv"
          className="hidden"
          ref={inputRef}
          onChange={onUpload}
        />
        {doc ? (
          <div className="flex items-center justify-between rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent-ink)]">
            <div className="flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 shrink-0 text-[var(--accent-ink)]" />
              <span className="font-medium truncate">{doc.name}</span>
              <span className="text-xs text-[var(--accent-ink)]/70">
                ({doc.content.length} 字符)
              </span>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="ml-2 shrink-0 rounded-full p-1 text-[var(--accent-ink)] hover:bg-[var(--accent)]/30"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--fg-muted)]/30 bg-[var(--surface-ground)] px-4 py-6 text-sm text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 hover:text-[var(--accent-ink)]"
          >
            <Upload className="h-4 w-4" />
            点击上传文档
          </button>
        )}
      </CardContent>
    </Card>
  );
}
