"use client";

import { useMemo, useState } from "react";
import { MessagesSquare, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/store/useConversationStore";
import { useArtifactStore } from "@/store/useArtifactStore";
import { useSetupStore } from "@/store/useSetupStore";
import { formatTimestamp } from "@/lib/chat/artifactParser";

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
    <div className="rounded-2xl bg-[var(--surface-ground)] overflow-hidden" data-testid={switcherTestIds.root}>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--fg-primary)]">
          <MessagesSquare className="h-4 w-4 text-[var(--fg-muted)]" />
          策划会话
          {orderedSessions.length > 0 && (
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-ink)]">
              {orderedSessions.length}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={handleCreate}
          title="新建策划"
          data-testid={switcherTestIds.newButton}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-inverse)] px-2.5 py-1 text-[11px] font-medium text-[var(--fg-inverse)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          新建
        </button>
      </div>

      {orderedSessions.length === 0 ? (
        <div className="px-4 pb-4 text-xs text-[var(--fg-muted)]">
          还没有策划会话，点击「新建」或上传文档后点击「开始策划」。
        </div>
      ) : (
        <ul
          className="max-h-64 overflow-y-auto bg-[var(--surface-card)]"
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
                  "group flex items-center gap-2 px-3 py-2.5 transition-colors",
                  isActive
                    ? "bg-[var(--accent-soft)]"
                    : "hover:bg-[var(--surface-ground)]"
                )}
              >
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
                      className="w-full rounded-md bg-[var(--surface-card)] px-2 py-1 text-xs text-[var(--fg-primary)] outline-none ring-1 ring-[var(--accent)]"
                      maxLength={80}
                    />
                  ) : (
                    <p
                      className={cn(
                        "truncate text-xs font-medium",
                        isActive
                          ? "text-[var(--accent-ink)]"
                          : "text-[var(--fg-primary)]"
                      )}
                    >
                      {session.name}
                    </p>
                  )}
                  <p className="mt-0.5 truncate text-[10px] text-[var(--fg-muted)]">
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
                      className="shrink-0 rounded-full p-1 text-[var(--success-ink)] hover:bg-[var(--success-soft)]"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      title="取消"
                      className="shrink-0 rounded-full p-1 text-[var(--fg-muted)] hover:bg-[var(--surface-ground)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(session.id, session.name)}
                      title="重命名"
                      className="rounded-full p-1 text-[var(--fg-muted)] hover:bg-[var(--surface-ground)] hover:text-[var(--fg-primary)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(session.id)}
                      title="删除"
                      className="rounded-full p-1 text-[var(--fg-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
