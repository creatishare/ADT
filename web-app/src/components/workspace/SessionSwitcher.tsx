"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  MessagesSquare,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/store/useConversationStore";
import { useArtifactStore } from "@/store/useArtifactStore";
import { useSetupStore } from "@/store/useSetupStore";
import { formatTimestamp } from "@/lib/chat/artifactParser";
import { StatusDot } from "@/components/workspace/primitives/StatusDot";

const switcherTestIds = {
  root: "session-switcher",
  newButton: "session-switcher-new",
  list: "session-switcher-list",
  item: "session-switcher-item",
};

export function SessionSwitcher() {
  const sessions = useConversationStore((s) => s.sessions);
  const orderedIds = useConversationStore((s) => s.orderedIds);
  const activeSessionId = useConversationStore((s) => s.activeSessionId);
  const createSession = useConversationStore((s) => s.createSession);
  const switchSession = useConversationStore((s) => s.switchSession);
  const deleteSession = useConversationStore((s) => s.deleteSession);
  const renameSession = useConversationStore((s) => s.renameSession);
  const clearSessionArtifacts = useArtifactStore((s) => s.clearSessionArtifacts);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  const orderedSessions = useMemo(
    () => orderedIds.map((id) => sessions[id]).filter((x) => !!x),
    [orderedIds, sessions]
  );

  const handleCreate = () => {
    const { worldDoc, lessonDoc } = useSetupStore.getState();
    createSession({
      docsSnapshot: {
        worldDocName: worldDoc?.name,
        lessonDocName: lessonDoc?.name,
      },
    });
  };

  const handleDelete = (id: string) => {
    const ok = window.confirm(
      "确认删除此策划？对话和生成的工件会一并删除，已上传的文档保留。"
    );
    if (!ok) return;
    deleteSession(id);
    clearSessionArtifacts(id);
  };

  const startEdit = (id: string, current: string) => {
    setEditingId(id);
    setDraftName(current);
  };

  const commitEdit = () => {
    if (!editingId) return;
    renameSession(editingId, draftName);
    setEditingId(null);
    setDraftName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftName("");
  };

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface-elev)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
      data-testid={switcherTestIds.root}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex flex-1 items-center gap-2 text-left text-[12px] font-semibold text-[var(--fg-primary)]"
          aria-expanded={isExpanded}
        >
          <MessagesSquare
            className="h-3.5 w-3.5"
            style={{ color: "var(--fg-muted)" }}
          />
          策划会话
          {orderedSessions.length > 0 ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent-ink)",
              }}
            >
              {orderedSessions.length}
            </span>
          ) : null}
          {isExpanded ? (
            <ChevronUp
              className="ml-auto h-3.5 w-3.5"
              style={{ color: "var(--fg-faint)" }}
            />
          ) : (
            <ChevronDown
              className="ml-auto h-3.5 w-3.5"
              style={{ color: "var(--fg-faint)" }}
            />
          )}
        </button>
        <button
          type="button"
          onClick={handleCreate}
          title="新建策划"
          data-testid={switcherTestIds.newButton}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-90"
          style={{
            background: "var(--surface-inverse)",
            color: "var(--fg-inverse)",
          }}
        >
          <Plus className="h-3 w-3" />
          新建
        </button>
      </div>

      {isExpanded ? (
        orderedSessions.length === 0 ? (
          <div
            className="px-3 pb-3 text-[11px]"
            style={{ color: "var(--fg-muted)" }}
          >
            还没有策划会话，点击「新建」或上传文档后点击「开始策划」。
          </div>
        ) : (
          <ul
            className="max-h-64 overflow-y-auto"
            data-testid={switcherTestIds.list}
          >
            {orderedSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingId === session.id;
              const snapshotLabel = [
                session.docsSnapshot?.worldDocName,
                session.docsSnapshot?.lessonDocName,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={session.id}
                  data-testid={switcherTestIds.item}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 transition-colors"
                  )}
                  style={{
                    background: isActive
                      ? "var(--accent-soft)"
                      : "transparent",
                  }}
                >
                  <StatusDot tone={isActive ? "accent" : "muted"} />
                  <button
                    type="button"
                    onClick={() => switchSession(session.id)}
                    className="min-w-0 flex-1 text-left"
                    disabled={isEditing}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={draftName}
                        autoFocus
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded-md px-2 py-1 text-[11px] text-[var(--fg-primary)] outline-none"
                        style={{
                          background: "var(--surface-card)",
                          boxShadow: "inset 0 0 0 1px var(--accent)",
                        }}
                        maxLength={80}
                      />
                    ) : (
                      <p
                        className="truncate text-[12px] font-medium"
                        style={{
                          color: isActive
                            ? "var(--accent-ink)"
                            : "var(--fg-primary)",
                        }}
                      >
                        {session.name}
                      </p>
                    )}
                    <p
                      className="mt-0.5 truncate font-mono text-[10px]"
                      style={{
                        color: isActive
                          ? "var(--accent-ink)"
                          : "var(--fg-faint)",
                        opacity: isActive ? 0.7 : 1,
                      }}
                    >
                      {formatTimestamp(session.updatedAt)}
                      {snapshotLabel ? ` · ${snapshotLabel}` : ""}
                    </p>
                  </button>

                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={commitEdit}
                        title="保存"
                        className="shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--success-soft)]"
                        style={{ color: "var(--success-ink)" }}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        title="取消"
                        className="shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--surface-elev)]"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => startEdit(session.id, session.name)}
                        title="重命名"
                        className="rounded-full p-1 transition-colors hover:bg-[var(--surface-card)]"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(session.id)}
                        title="删除"
                        className="rounded-full p-1 transition-colors hover:bg-[var(--danger-soft)]"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
