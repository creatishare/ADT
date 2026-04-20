"use client";

import { useRef } from "react";
import { useSetupStore } from "@/store/useSetupStore";
import { useArtifactStore } from "@/store/useArtifactStore";
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
} from "lucide-react";

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

function downloadArtifacts(artifacts: Array<{ title: string; content: string; timestamp: number }>) {
  const sorted = [...artifacts].sort((a, b) => a.timestamp - b.timestamp);
  const parts = sorted.map(
    (a) => `# ${a.title}\n\n${a.content}\n\n---\n`
  );
  const blob = new Blob([parts.join("\n")], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date()
    .toLocaleString("zh-CN", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/[/:\s]/g, "_");
  const link = document.createElement("a");
  link.href = url;
  link.download = `关卡设计成果_${dateStr}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  const { artifacts } = useArtifactStore();
  const worldInputRef = useRef<HTMLInputElement>(null);
  const lessonInputRef = useRef<HTMLInputElement>(null);

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
    setInitialPrompt(prompt);
    toggleCollapse();
  };

  const handleDownload = () => {
    downloadArtifacts(artifacts);
  };

  if (isCollapsed) {
    return (
      <div className="w-12 flex flex-col items-center h-full bg-gray-50 border-r border-gray-200 py-3 shrink-0">
        <button
          type="button"
          onClick={toggleCollapse}
          title="展开策划准备"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 flex flex-col h-full bg-gray-50 border-r border-gray-200 shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-800">策划准备</h3>
        <button
          type="button"
          onClick={toggleCollapse}
          title="折叠策划准备"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
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

        {artifacts.length > 0 && (
          <Button variant="outline" onClick={handleDownload} className="w-full">
            <Download className="h-4 w-4 mr-1.5" />
            下载成果 ({artifacts.length} 个)
          </Button>
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
          <div className="flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <div className="flex items-center gap-2 truncate">
              <FileText className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="font-medium truncate">{doc.name}</span>
              <span className="text-xs text-blue-400">
                ({doc.content.length} 字符)
              </span>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="ml-2 shrink-0 rounded-full p-1 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700"
          >
            <Upload className="h-4 w-4" />
            点击上传文档
          </button>
        )}
      </CardContent>
    </Card>
  );
}
