"use client";

import type { ParsedGroup } from "@/lib/setup/parseLessonGroups";

interface GroupPickerProps {
  groups: ParsedGroup[];
  value: number | null;
  onChange: (index: number | null) => void;
  /** 课节文档是否已上传（未上传时禁用并显示提示）。 */
  lessonReady: boolean;
}

export function GroupPicker({
  groups,
  value,
  onChange,
  lessonReady,
}: GroupPickerProps) {
  const isEmpty = lessonReady && groups.length === 0;
  const isDisabled = !lessonReady;

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl p-3"
      style={{
        background: "var(--surface-elev)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
      data-testid="group-picker"
    >
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--fg-faint)" }}
        >
          STEP 03
        </span>
        <span className="text-[12px] font-semibold text-[var(--fg-primary)]">
          目标题组
        </span>
      </div>

      {isDisabled ? (
        <p
          className="text-[11px] leading-5"
          style={{ color: "var(--fg-muted)" }}
        >
          请先在 STEP 02 上传课节知识点文档。
        </p>
      ) : isEmpty ? (
        <p
          className="text-[11px] leading-5"
          style={{ color: "var(--warning, #c98a00)" }}
        >
          未识别到任何题组小节。请确认课节文档使用了形如&nbsp;
          <code
            className="font-mono"
            style={{ background: "var(--surface-card)", padding: "1px 4px", borderRadius: 4 }}
          >
            ## 题组1：标题
          </code>
          &nbsp;的标题。
        </p>
      ) : (
        <select
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : Number.parseInt(v, 10));
          }}
          aria-label="选择目标题组"
          data-testid="group-picker-select"
          className="rounded-xl px-3 py-2 text-[12px]"
          style={{
            background: "var(--surface-card)",
            color: "var(--fg-primary)",
            boxShadow: "inset 0 0 0 1px var(--border)",
          }}
        >
          <option value="">— 请选择 —</option>
          {groups.map((g) => (
            <option key={g.index} value={g.index}>
              题组{g.index}
              {g.title ? ` · ${g.title}` : ""}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
