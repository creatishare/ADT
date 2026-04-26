/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakRadio, lucide */
const { useState, useMemo, useEffect, useRef } = React;

// ============================================================
// THEMES
// ============================================================
const THEMES = {
  linen: {
    label: "Warm Linen",
    "--surface-ground": "#ece2d5",
    "--surface-tile": "#f7f1e8",
    "--surface-card": "#ffffff",
    "--surface-inverse": "#1a1714",
    "--surface-elev": "#fdfaf5",
    "--fg-primary": "#1a1714",
    "--fg-secondary": "#3d3833",
    "--fg-muted": "#7a7269",
    "--fg-faint": "#a89e92",
    "--fg-inverse": "#ffffff",
    "--accent": "#c97e54",
    "--accent-soft": "#f3dfcd",
    "--accent-ink": "#5a2e16",
    "--success": "#4a7d5a",
    "--success-soft": "#dde9dd",
    "--success-ink": "#2a4a33",
    "--danger": "#a13e3e",
    "--danger-soft": "#f0d9d9",
    "--danger-ink": "#5a1f1f",
    "--border": "#e3d8c8",
    "--border-strong": "#cdbfac",
  },
  cool: {
    label: "Cool Gray",
    "--surface-ground": "#dcdfe4",
    "--surface-tile": "#eef0f3",
    "--surface-card": "#ffffff",
    "--surface-inverse": "#15181c",
    "--surface-elev": "#f6f7f9",
    "--fg-primary": "#15181c",
    "--fg-secondary": "#3a3f46",
    "--fg-muted": "#6e757e",
    "--fg-faint": "#9aa1aa",
    "--fg-inverse": "#ffffff",
    "--accent": "#3a6dd9",
    "--accent-soft": "#dbe5f7",
    "--accent-ink": "#1c3973",
    "--success": "#2f7a55",
    "--success-soft": "#d8e9df",
    "--success-ink": "#1a4633",
    "--danger": "#a93636",
    "--danger-soft": "#efd7d7",
    "--danger-ink": "#591c1c",
    "--border": "#dadee4",
    "--border-strong": "#b8bdc4",
  },
  dark: {
    label: "Dark",
    "--surface-ground": "#0d0e10",
    "--surface-tile": "#17181b",
    "--surface-card": "#1f2125",
    "--surface-inverse": "#f4f3f0",
    "--surface-elev": "#26282d",
    "--fg-primary": "#f4f3f0",
    "--fg-secondary": "#c8c5be",
    "--fg-muted": "#8e8a82",
    "--fg-faint": "#5e5b56",
    "--fg-inverse": "#15161a",
    "--accent": "#e8a070",
    "--accent-soft": "#3d2a1d",
    "--accent-ink": "#f5d4ba",
    "--success": "#7fb98e",
    "--success-soft": "#1f3326",
    "--success-ink": "#bfe2c8",
    "--danger": "#d97676",
    "--danger-soft": "#3a1f1f",
    "--danger-ink": "#f0c4c4",
    "--border": "#2c2e34",
    "--border-strong": "#3d4047",
  },
};

function applyTheme(name) {
  const theme = THEMES[name] || THEMES.linen;
  const root = document.documentElement;
  Object.entries(theme).forEach(([k, v]) => {
    if (k.startsWith("--")) root.style.setProperty(k, v);
  });
}

// ============================================================
// ICONS — render lucide icons inline as SVGs (using lucide UMD)
// ============================================================
function Icon({ name, size = 16, strokeWidth = 1.75, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    node.innerHTML = "";
    const svg = lucide.createElement(lucide.icons[name] || lucide.icons.Square);
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("stroke-width", strokeWidth);
    node.appendChild(svg);
  }, [name, size, strokeWidth]);
  return <span ref={ref} className={`inline-flex items-center justify-center ${className}`} />;
}

// ============================================================
// SMALL UI PRIMITIVES
// ============================================================
function StatusDot({ tone = "muted" }) {
  const colors = {
    accent: "var(--accent)",
    success: "var(--success)",
    danger: "var(--danger)",
    muted: "var(--fg-faint)",
  };
  return (
    <span
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: colors[tone] }}
    />
  );
}

function Pill({ tone = "neutral", children, icon }) {
  const tones = {
    neutral: { bg: "var(--surface-elev)", fg: "var(--fg-secondary)", border: "var(--border)" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent-ink)", border: "transparent" },
    success: { bg: "var(--success-soft)", fg: "var(--success-ink)", border: "transparent" },
    danger: { bg: "var(--danger-soft)", fg: "var(--danger-ink)", border: "transparent" },
    inverse: { bg: "var(--surface-inverse)", fg: "var(--fg-inverse)", border: "transparent" },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none whitespace-nowrap"
      style={{ background: t.bg, color: t.fg, boxShadow: `inset 0 0 0 1px ${t.border}` }}
    >
      {icon && <Icon name={icon} size={11} strokeWidth={2} />}
      {children}
    </span>
  );
}

function ThinkingDots({ tone = "muted" }) {
  const color = tone === "accent" ? "var(--accent)" : "var(--fg-muted)";
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="thinking-dot block h-1 w-1 rounded-full"
          style={{ background: color, animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

// ============================================================
// LEFT RAIL — Setup
// ============================================================
function SetupRail({ collapsed, onToggle, state }) {
  if (collapsed) {
    return (
      <aside
        className="flex h-full w-12 shrink-0 flex-col items-center rounded-2xl py-3"
        style={{ background: "var(--surface-tile)" }}
      >
        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] transition-colors"
          title="展开策划准备"
        >
          <Icon name="PanelLeftOpen" size={16} />
        </button>
      </aside>
    );
  }

  const hasUploads = state !== "empty";

  return (
    <aside
      className="flex h-full w-[280px] shrink-0 flex-col rounded-2xl overflow-hidden"
      style={{ background: "var(--surface-tile)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--fg-faint)]">
            策划准备
          </span>
        </div>
        <button
          onClick={onToggle}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--surface-ground)] transition-colors"
          title="折叠"
        >
          <Icon name="PanelLeftClose" size={14} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-3">
        {/* Sessions */}
        <SessionsBlock state={state} />

        {/* Step 1 */}
        <UploadCard
          step="01"
          title="阶段世界观"
          desc="整阶段共用的剧情设定"
          filename={hasUploads ? "S03-世界观-V2.md" : null}
          size={hasUploads ? "8.4 KB" : null}
        />

        {/* Step 2 */}
        <UploadCard
          step="02"
          title="课节知识点"
          desc="本课节的知识点整理"
          filename={hasUploads ? "L05-02-高年级-数列.md" : null}
          size={hasUploads ? "12.1 KB" : null}
        />

        {/* CTA */}
        <button
          disabled={!hasUploads}
          className="group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold transition-all"
          style={{
            background: hasUploads ? "var(--surface-inverse)" : "var(--surface-ground)",
            color: hasUploads ? "var(--fg-inverse)" : "var(--fg-faint)",
            cursor: hasUploads ? "pointer" : "not-allowed",
          }}
        >
          开始策划
          <Icon name="ArrowRight" size={14} strokeWidth={2} />
        </button>

        {/* Outputs (only after some artifacts exist) */}
        {(state === "concept" || state === "validation" || state === "approval") && (
          <OutputsBlock />
        )}
      </div>
    </aside>
  );
}

function SessionsBlock({ state }) {
  const [open, setOpen] = useState(true);
  const sessions =
    state === "empty"
      ? []
      : [
          { id: "s1", name: "L05-02 数列规律", active: true, updated: "刚刚" },
          { id: "s2", name: "L04-03 几何变换", active: false, updated: "昨天 14:22" },
          { id: "s3", name: "L03-01 函数初步", active: false, updated: "10/24" },
        ];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface-elev)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-[var(--surface-ground)] transition-colors"
      >
        <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--fg-primary)]">
          <Icon name="MessagesSquare" size={13} className="text-[var(--fg-muted)]" />
          策划会话
          {sessions.length > 0 && (
            <span className="rounded-full bg-[var(--surface-ground)] px-1.5 text-[10px] font-mono text-[var(--fg-secondary)]">
              {sessions.length}
            </span>
          )}
        </span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={13} className="text-[var(--fg-muted)]" />
      </button>

      {open && (
        <div className="px-1.5 pb-1.5 space-y-0.5">
          {sessions.length === 0 ? (
            <div className="px-2 py-2 text-[11px] text-[var(--fg-muted)] leading-relaxed">
              还没有策划会话。上传文档后点「开始策划」。
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
                style={{
                  background: s.active ? "var(--accent-soft)" : "transparent",
                }}
              >
                <span
                  className="block h-1 w-1 shrink-0 rounded-full"
                  style={{ background: s.active ? "var(--accent)" : "var(--fg-faint)" }}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[12px] font-medium"
                    style={{ color: s.active ? "var(--accent-ink)" : "var(--fg-primary)" }}
                  >
                    {s.name}
                  </div>
                  <div className="text-[10px] text-[var(--fg-muted)]">{s.updated}</div>
                </div>
              </button>
            ))
          )}
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-ground)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <Icon name="Plus" size={12} />
            新建策划
          </button>
        </div>
      )}
    </div>
  );
}

function UploadCard({ step, title, desc, filename, size }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "var(--surface-elev)" }}
    >
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[var(--fg-faint)]">
          STEP {step}
        </span>
        <span className="text-[12px] font-semibold text-[var(--fg-primary)]">
          {title}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--fg-muted)] mb-2.5">
        {desc}
      </p>
      {filename ? (
        <div
          className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
          style={{ background: "var(--surface-card)", boxShadow: "inset 0 0 0 1px var(--border)" }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Icon name="FileCheck2" size={13} className="text-[var(--success)]" />
            <span className="truncate text-[12px] font-medium text-[var(--fg-primary)]">
              {filename}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="font-mono text-[10px] text-[var(--fg-muted)]">{size}</span>
            <button className="flex h-5 w-5 items-center justify-center rounded text-[var(--fg-muted)] hover:bg-[var(--surface-ground)] hover:text-[var(--fg-primary)] transition-colors">
              <Icon name="X" size={11} />
            </button>
          </div>
        </div>
      ) : (
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-3 text-[11px] font-medium transition-colors"
          style={{ borderColor: "var(--border-strong)", color: "var(--fg-muted)" }}
        >
          <Icon name="Upload" size={12} />
          点击上传 .md / .txt
        </button>
      )}
    </div>
  );
}

function OutputsBlock() {
  const [open, setOpen] = useState(true);
  const outputs = [
    { code: "L05-02", title: "概念方案", icon: "Lightbulb", time: "刚刚" },
    { code: "L05-02", title: "验证报告", icon: "ShieldCheck", time: "1 分钟前" },
  ];
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-elev)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-[var(--surface-ground)] transition-colors"
      >
        <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--fg-primary)]">
          <Icon name="FolderDown" size={13} className="text-[var(--fg-muted)]" />
          成果管理
          <span className="rounded-full bg-[var(--surface-ground)] px-1.5 text-[10px] font-mono text-[var(--fg-secondary)]">
            {outputs.length}
          </span>
        </span>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={13} className="text-[var(--fg-muted)]" />
      </button>
      {open && (
        <div className="px-1.5 pb-1.5 space-y-0.5">
          {outputs.map((o, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-ground)] transition-colors">
              <input type="checkbox" defaultChecked className="h-3 w-3 accent-[var(--accent)]" />
              <Icon name={o.icon} size={12} className="text-[var(--fg-muted)]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-[var(--fg-primary)]">
                  {o.code} · {o.title}
                </div>
                <div className="text-[10px] text-[var(--fg-muted)]">{o.time}</div>
              </div>
            </div>
          ))}
          <button className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] bg-[var(--surface-ground)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] transition-colors">
            <Icon name="Download" size={11} />
            下载选中
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TOP BAR
// ============================================================
function TopBar({ viewMode, onTabClick, artifactCount, model, onModelChange }) {
  return (
    <header
      className="shrink-0 flex items-center gap-4 rounded-2xl px-4 py-2.5"
      style={{ background: "var(--surface-tile)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--surface-inverse)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z" />
          </svg>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold tracking-tight text-[var(--fg-primary)]">
            Agent Designer
          </span>
          <span className="font-mono text-[10px] tracking-wider text-[var(--fg-muted)]">
            v2 · 多智能体关卡工作台
          </span>
        </div>
      </div>

      {/* Center segmented */}
      <nav className="flex-1 flex justify-center">
        <div
          className="inline-flex items-center gap-0.5 rounded-full p-0.5"
          style={{ background: "var(--surface-ground)" }}
        >
          {[
            { key: "chat", label: "对话", icon: "MessageSquare" },
            { key: "split", label: "分屏", icon: "Columns2" },
            { key: "artifacts", label: "设计文档", icon: "FileText", count: artifactCount },
          ].map((tab) => {
            const active = viewMode === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabClick(tab.key)}
                className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  background: active ? "var(--surface-inverse)" : "transparent",
                  color: active ? "var(--fg-inverse)" : "var(--fg-secondary)",
                }}
              >
                <Icon name={tab.icon} size={12} strokeWidth={2} />
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold"
                    style={{
                      background: active ? "var(--accent)" : "var(--accent-soft)",
                      color: active ? "var(--fg-inverse)" : "var(--accent-ink)",
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Right tools */}
      <div className="flex items-center gap-2 shrink-0">
        <ModelSwitcher model={model} onChange={onModelChange} />
      </div>
    </header>
  );
}

function ModelSwitcher({ model, onChange }) {
  const [open, setOpen] = useState(false);
  const models = [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google", hint: "快速 · 默认" },
    { id: "gpt-5", label: "GPT-5", provider: "OpenAI", hint: "强推理" },
    { id: "kimi-k2", label: "Kimi K2", provider: "Moonshot", hint: "中文长文" },
    { id: "deepseek-v3", label: "DeepSeek V3", provider: "DeepSeek", hint: "代码强项" },
    { id: "doubao-pro", label: "Doubao Pro", provider: "ByteDance", hint: "国内稳定" },
  ];
  const active = models.find((m) => m.id === model) || models[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
        style={{ background: "var(--surface-ground)", color: "var(--fg-primary)" }}
      >
        <StatusDot tone="success" />
        <span className="font-mono">{active.label}</span>
        <Icon name="ChevronDown" size={11} className="text-[var(--fg-muted)]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-2 w-[280px] rounded-xl p-1.5 z-30"
            style={{
              background: "var(--surface-card)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.12), inset 0 0 0 1px var(--border)",
            }}
          >
            <div className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-faint)]">
              模型 · {models.length} 个可用
            </div>
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => { onChange(m.id); setOpen(false); }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--surface-ground)]"
              >
                <div className="flex items-center gap-2">
                  <StatusDot tone={m.id === model ? "success" : "muted"} />
                  <div>
                    <div className="text-[12px] font-medium text-[var(--fg-primary)]">{m.label}</div>
                    <div className="text-[10px] text-[var(--fg-muted)]">{m.provider} · {m.hint}</div>
                  </div>
                </div>
                {m.id === model && <Icon name="Check" size={13} className="text-[var(--accent)]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// ORCHESTRATOR PROGRESS RAIL
// ============================================================
const STEPS = [
  { n: 1, label: "解析输入" },
  { n: 2, label: "概念候选" },
  { n: 3, label: "用户筛选" },
  { n: 4, label: "验证修订" },
  { n: 5, label: "文档编写" },
  { n: 6, label: "视觉提示" },
  { n: 7, label: "整合归档" },
];

function ProgressRail({ currentStep, lesson, totalGroups, processedGroups, currentGroup }) {
  return (
    <div
      className="border-b px-5 py-3"
      style={{ borderColor: "var(--border)", background: "var(--surface-elev)" }}
    >
      {/* Top row: lesson + group progress */}
      <div className="flex items-center justify-between gap-4 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-[var(--fg-faint)] uppercase">
            当前
          </span>
          <span className="text-[12px] font-semibold text-[var(--fg-primary)] truncate">
            {lesson}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-[11px] text-[var(--fg-secondary)]">
          <span>
            题组 <span className="font-mono font-semibold text-[var(--fg-primary)]">{processedGroups}</span>
            <span className="text-[var(--fg-muted)]">/{totalGroups}</span>
          </span>
          {currentGroup && (
            <span className="font-mono text-[var(--fg-muted)]">→ {currentGroup}</span>
          )}
        </div>
      </div>

      {/* 7-step pill rail */}
      <div className="flex items-center gap-1">
        {STEPS.map((s) => {
          const isDone = s.n < currentStep;
          const isActive = s.n === currentStep;
          return (
            <div key={s.n} className="flex items-center flex-1 min-w-0">
              <div
                className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 min-w-0"
                style={{
                  background: isActive
                    ? "var(--accent-soft)"
                    : isDone
                      ? "transparent"
                      : "transparent",
                }}
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold"
                  style={{
                    background: isActive
                      ? "var(--accent)"
                      : isDone
                        ? "var(--success)"
                        : "var(--surface-ground)",
                    color: isActive || isDone ? "var(--fg-inverse)" : "var(--fg-faint)",
                  }}
                >
                  {isDone ? "✓" : s.n}
                </span>
                <span
                  className="truncate text-[10px] font-medium"
                  style={{
                    color: isActive
                      ? "var(--accent-ink)"
                      : isDone
                        ? "var(--fg-secondary)"
                        : "var(--fg-faint)",
                  }}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// CHAT AREA
// ============================================================
function ChatArea({ state, onApprove, onReject }) {
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollTo({ top: messagesEndRef.current.scrollHeight, behavior: "smooth" });
  }, [state]);

  const showProgress = state !== "empty" && state !== "ready";

  return (
    <div
      className="flex h-full flex-1 flex-col rounded-2xl overflow-hidden"
      style={{ background: "var(--surface-tile)" }}
    >
      {showProgress && (
        <ProgressRail
          currentStep={state === "thinking" ? 2 : state === "concept" ? 3 : state === "approval" ? 3 : state === "validation" ? 4 : 1}
          lesson="L05-02 高年级 · 数列规律"
          totalGroups={6}
          processedGroups={state === "validation" ? 2 : state === "concept" || state === "approval" ? 1 : 0}
          currentGroup={state !== "empty" ? "题组 02 / 等差递推" : null}
        />
      )}

      {/* Message list */}
      <div ref={messagesEndRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">
        {state === "empty" && <EmptyState />}
        {state === "ready" && <ReadyState />}
        {state === "thinking" && <ThinkingState />}
        {state === "concept" && <ConceptState />}
        {state === "approval" && <ApprovalState onApprove={onApprove} onReject={onReject} />}
        {state === "validation" && <ValidationState />}
      </div>

      {/* Composer */}
      <Composer />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--surface-inverse)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z" />
          </svg>
        </div>
        <h2 className="mb-2 text-[18px] font-semibold tracking-tight text-[var(--fg-primary)]">
          Agent Designer
        </h2>
        <p className="text-[13px] leading-6 text-[var(--fg-muted)] mb-5">
          多智能体协作的 C++ 关卡设计工作台。<br/>
          上传阶段世界观与课节知识点，开始策划。
        </p>
        <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium" style={{ background: "var(--surface-ground)", color: "var(--fg-secondary)" }}>
          <Icon name="ArrowLeft" size={11} />
          先在左侧上传文档
        </div>
      </div>
    </div>
  );
}

function ReadyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md w-full">
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-card)", boxShadow: "inset 0 0 0 1px var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--success-soft)" }}>
              <Icon name="Check" size={12} className="text-[var(--success-ink)]" strokeWidth={2.5} />
            </span>
            <span className="text-[12px] font-semibold text-[var(--fg-primary)]">资料齐备</span>
          </div>
          <div className="space-y-2 mb-4">
            <ResourceRow icon="Globe2" label="阶段世界观" file="S03-世界观-V2.md" />
            <ResourceRow icon="BookOpen" label="课节知识点" file="L05-02-高年级-数列.md" />
          </div>
          <div className="rounded-lg px-3 py-2.5 text-[11px] leading-relaxed" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
            将按 7 步法处理 <span className="font-mono font-semibold">6 个题组</span>。
            <br/>第一步会为题组 01 生成 5 个候选概念供你筛选。
          </div>
          <button
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold"
            style={{ background: "var(--surface-inverse)", color: "var(--fg-inverse)" }}
          >
            <Icon name="Play" size={13} strokeWidth={2.5} />
            开始策划流程
          </button>
        </div>
      </div>
    </div>
  );
}

function ResourceRow({ icon, label, file }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: "var(--surface-elev)" }}>
      <Icon name={icon} size={13} className="text-[var(--fg-muted)]" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--fg-faint)]">{label}</div>
        <div className="truncate text-[12px] font-medium text-[var(--fg-primary)]">{file}</div>
      </div>
      <Icon name="Check" size={12} className="text-[var(--success)]" strokeWidth={2.5} />
    </div>
  );
}

// ----- Messages -----
function UserMessage({ children }) {
  return (
    <div className="ml-auto flex max-w-[80%] flex-col items-end gap-1">
      <div
        className="rounded-[18px] rounded-br-md px-4 py-2.5 text-[13px] leading-6"
        style={{ background: "var(--surface-inverse)", color: "var(--fg-inverse)" }}
      >
        {children}
      </div>
      <span className="font-mono text-[10px] text-[var(--fg-faint)]">12:42</span>
    </div>
  );
}

function AssistantMessage({ children, time = "12:42" }) {
  return (
    <div className="mr-auto flex max-w-[92%] items-start gap-2.5">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--surface-inverse)" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z" />
        </svg>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold text-[var(--fg-primary)]">Orchestrator</span>
          <span className="font-mono text-[10px] text-[var(--fg-faint)]">{time}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function TextBubble({ children }) {
  return (
    <div
      className="rounded-[18px] rounded-tl-md px-4 py-2.5 text-[13px] leading-6 text-[var(--fg-primary)]"
      style={{ background: "var(--surface-card)", boxShadow: "inset 0 0 0 1px var(--border)" }}
    >
      {children}
    </div>
  );
}

function ToolCard({ tool, label, status, summary, artifact, onView }) {
  const statusMap = {
    running: { tone: "accent", text: "运行中" },
    done: { tone: "success", text: "已完成" },
    error: { tone: "danger", text: "执行失败" },
    waiting: { tone: "accent", text: "等待确认" },
  };
  const s = statusMap[status];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface-card)", boxShadow: "inset 0 0 0 1px var(--border)" }}
    >
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--surface-elev)", boxShadow: "inset 0 0 0 1px var(--border)" }}
        >
          <Icon name={tool.icon} size={14} className="text-[var(--fg-primary)]" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[12px] font-semibold text-[var(--fg-primary)]">{label}</span>
          <span className="font-mono text-[10px] text-[var(--fg-muted)]">{tool.id}</span>
        </div>
        <Pill tone={s.tone}>
          {status === "running" && <ThinkingDots tone="accent" />}
          {status === "done" && <Icon name="Check" size={10} strokeWidth={2.5} />}
          {status === "error" && <Icon name="AlertTriangle" size={10} strokeWidth={2.5} />}
          {s.text}
        </Pill>
      </div>

      {summary && (
        <div className="px-3.5 pb-2 text-[11px] leading-relaxed text-[var(--fg-muted)]">
          {summary}
        </div>
      )}

      {artifact && (
        <button
          onClick={onView}
          className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-elev)]"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Icon name={artifact.icon} size={12} className="text-[var(--fg-muted)]" />
            <span className="font-mono text-[10px] text-[var(--fg-faint)]">{artifact.code}</span>
            <span className="truncate text-[12px] font-medium text-[var(--fg-primary)]">
              {artifact.title}
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--accent-ink)]">
            查看
            <Icon name="ArrowUpRight" size={11} strokeWidth={2} />
          </span>
        </button>
      )}
    </div>
  );
}

const TOOLS = {
  designStageFile: { id: "designStageFile", icon: "Lightbulb", agent: "关卡策划师" },
  validateStageFile: { id: "validateStageFile", icon: "ShieldCheck", agent: "关卡验证师" },
  writeStageFile: { id: "writeStageFile", icon: "PenLine", agent: "文档编写师" },
  generateVisualDesign: { id: "generateVisualDesign", icon: "Palette", agent: "视觉设计师" },
};

// ----- States -----
function ThinkingState() {
  return (
    <>
      <UserMessage>开始进行 L05-02-高年级 关卡策划</UserMessage>
      <AssistantMessage>
        <TextBubble>
          已读取阶段世界观与本课节知识点。识别到 6 个题组，将依次为每个题组生成 5 个候选概念。
          <br/>
          正在为 <span className="font-mono font-semibold">题组 02 / 等差递推</span> 生成候选概念…
        </TextBubble>
        <ToolCard
          tool={TOOLS.designStageFile}
          label={TOOLS.designStageFile.agent}
          status="running"
          summary="融合世界观「星际探险队」设定，结合等差递推知识点，生成 5 个差异化包装概念…"
        />
        <ThinkingBubble />
      </AssistantMessage>
    </>
  );
}

function ThinkingBubble() {
  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-[18px] rounded-tl-md px-4 py-2.5 self-start"
      style={{ background: "var(--surface-card)", boxShadow: "inset 0 0 0 1px var(--border)" }}
    >
      <ThinkingDots />
      <span className="thinking-shimmer text-[13px] font-medium">正在思考中</span>
    </div>
  );
}

function ConceptState() {
  return (
    <>
      <UserMessage>开始进行 L05-02-高年级 关卡策划</UserMessage>
      <AssistantMessage time="12:39">
        <TextBubble>
          已为 <span className="font-mono font-semibold">题组 01 / 数列引入</span> 生成 5 个候选概念。请在右侧查看完整方案，并告诉我你倾向哪一个。
        </TextBubble>
        <ToolCard
          tool={TOOLS.designStageFile}
          label={TOOLS.designStageFile.agent}
          status="done"
          summary="基于「星际探险队」世界观，5 个候选概念分别围绕：信号塔修复、星图绘制、能源补给、护盾校准、轨道计算。"
          artifact={{ icon: "Lightbulb", code: "L05-02", title: "数列引入 · 5 个候选概念" }}
          onView={() => {}}
        />
      </AssistantMessage>
    </>
  );
}

function ApprovalState({ onApprove, onReject }) {
  return (
    <>
      <UserMessage>开始进行 L05-02-高年级 关卡策划</UserMessage>
      <AssistantMessage time="12:39">
        <TextBubble>
          已为 <span className="font-mono font-semibold">题组 01 / 数列引入</span> 生成 5 个候选概念。
        </TextBubble>
        <ToolCard
          tool={TOOLS.designStageFile}
          label={TOOLS.designStageFile.agent}
          status="done"
          artifact={{ icon: "Lightbulb", code: "L05-02", title: "数列引入 · 5 个候选概念" }}
          onView={() => {}}
        />
        <TextBubble>
          请确认是否使用<span className="font-semibold">「方案 03 · 能源补给」</span>作为本题组的最终概念，并继续推进至验证步骤。
        </TextBubble>
        <ApprovalBar onApprove={onApprove} onReject={onReject} />
      </AssistantMessage>
    </>
  );
}

function ApprovalBar({ onApprove, onReject }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-2.5"
      style={{
        background: "var(--accent-soft)",
        boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--accent) 25%, transparent)",
      }}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--surface-card)" }}>
        <Icon name="Hand" size={14} className="text-[var(--accent-ink)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-[var(--accent-ink)] leading-tight">
          等待人工确认
        </div>
        <div className="text-[11px] text-[var(--accent-ink)] opacity-80 mt-0.5">
          确认方案 03 后将进入验证步骤
        </div>
      </div>
      <button
        onClick={onReject}
        className="rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors"
        style={{ background: "var(--surface-card)", color: "var(--fg-secondary)" }}
      >
        换一个方案
      </button>
      <button
        onClick={onApprove}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors"
        style={{ background: "var(--surface-inverse)", color: "var(--fg-inverse)" }}
      >
        确认继续
        <Icon name="ArrowRight" size={11} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function ValidationState() {
  return (
    <>
      <UserMessage>开始进行 L05-02-高年级 关卡策划</UserMessage>
      <AssistantMessage time="12:39">
        <TextBubble>方案 03 · 能源补给 已确认。</TextBubble>
        <ToolCard
          tool={TOOLS.designStageFile}
          label={TOOLS.designStageFile.agent}
          status="done"
          artifact={{ icon: "Lightbulb", code: "L05-02", title: "数列引入 · 概念方案" }}
          onView={() => {}}
        />
      </AssistantMessage>
      <UserMessage>继续</UserMessage>
      <AssistantMessage time="12:43">
        <TextBubble>
          正在调用<span className="font-semibold">关卡验证师</span>校验方案与世界观、教学法的一致性…
        </TextBubble>
        <ToolCard
          tool={TOOLS.validateStageFile}
          label={TOOLS.validateStageFile.agent}
          status="done"
          summary="发现 2 处低风险偏差，已生成 4 条修改建议。整体可推进至文档编写。"
          artifact={{ icon: "ShieldCheck", code: "L05-02", title: "数列引入 · 验证报告" }}
          onView={() => {}}
        />
      </AssistantMessage>
    </>
  );
}

function Composer() {
  const [value, setValue] = useState("");
  return (
    <div className="p-3">
      <form
        onSubmit={(e) => { e.preventDefault(); setValue(""); }}
        className="flex flex-col gap-2 rounded-2xl p-3"
        style={{
          background: "var(--surface-card)",
          boxShadow: "inset 0 0 0 1px var(--border)",
        }}
      >
        <textarea
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="描述你的关卡需求,或针对当前候选给出反馈…"
          className="w-full resize-none bg-transparent text-[13px] leading-6 text-[var(--fg-primary)] placeholder:text-[var(--fg-faint)] focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <ComposerButton icon="Paperclip" />
            <ComposerButton icon="AtSign" />
            <span className="ml-1 hidden md:inline font-mono text-[10px] text-[var(--fg-faint)]">
              ⌘ + ⏎ 发送
            </span>
          </div>
          <button
            type="submit"
            disabled={!value.trim()}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-opacity"
            style={{
              background: "var(--surface-inverse)",
              color: "var(--fg-inverse)",
              opacity: value.trim() ? 1 : 0.4,
            }}
          >
            <Icon name="ArrowUp" size={12} strokeWidth={2.5} />
            发送
          </button>
        </div>
      </form>
    </div>
  );
}

function ComposerButton({ icon }) {
  return (
    <button
      type="button"
      className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--surface-elev)] hover:text-[var(--fg-primary)] transition-colors"
    >
      <Icon name={icon} size={13} />
    </button>
  );
}

// ============================================================
// ARTIFACT AREA
// ============================================================
function ArtifactArea({ state }) {
  const tabs = useMemo(() => {
    if (state === "concept" || state === "approval") {
      return [{ id: "a1", code: "L05-02", title: "数列引入 · 候选概念", icon: "Lightbulb", category: "概念方案", active: true }];
    }
    if (state === "validation") {
      return [
        { id: "a1", code: "L05-02", title: "数列引入 · 概念方案", icon: "Lightbulb", category: "概念方案", active: false },
        { id: "a2", code: "L05-02", title: "数列引入 · 验证报告", icon: "ShieldCheck", category: "验证报告", active: true },
      ];
    }
    return [];
  }, [state]);

  if (tabs.length === 0) {
    return (
      <div
        className="flex h-full flex-1 flex-col rounded-2xl"
        style={{ background: "var(--surface-tile)" }}
      >
        <ArtifactEmpty />
      </div>
    );
  }

  const active = tabs.find((t) => t.active) || tabs[0];

  return (
    <div
      className="flex h-full flex-1 flex-col rounded-2xl overflow-hidden"
      style={{ background: "var(--surface-tile)" }}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-4 pb-3 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
            style={{
              background: t.active ? "var(--surface-inverse)" : "var(--surface-elev)",
              color: t.active ? "var(--fg-inverse)" : "var(--fg-secondary)",
            }}
          >
            <Icon name={t.icon} size={11} />
            <span className="font-mono text-[10px] opacity-70">{t.code}</span>
            {t.title.replace(/^[A-Z0-9-]+\s*/, "")}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-2">
        {active.category === "概念方案" && <ConceptArtifact />}
        {active.category === "验证报告" && <ValidationArtifact />}
      </div>
    </div>
  );
}

function ArtifactEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: "var(--surface-elev)", boxShadow: "inset 0 0 0 1px var(--border)" }}
      >
        <Icon name="FolderOpen" size={20} className="text-[var(--fg-faint)]" />
      </div>
      <div className="mb-1 text-[14px] font-semibold text-[var(--fg-primary)]">
        设计文档
      </div>
      <p className="max-w-[260px] text-[12px] leading-relaxed text-[var(--fg-muted)]">
        子智能体生成的概念方案、验证报告、设计文档与提示词会显示在此。
      </p>
    </div>
  );
}

function ArtifactHeader({ code, title, category, status, statusTone, time, type }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[10px] font-semibold tracking-wider uppercase text-[var(--fg-faint)]">
            {code}
          </span>
          <span className="h-3 w-px" style={{ background: "var(--border-strong)" }} />
          <Pill tone="neutral" icon="Tag">{category}</Pill>
          <Pill tone={statusTone} icon={statusTone === "success" ? "Check" : "AlertCircle"}>
            {status}
          </Pill>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--fg-primary)] leading-tight">
          {title}
        </h1>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
          <Icon name="Clock" size={11} />
          <span className="font-mono">{time}</span>
          <span>·</span>
          <span>{type}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton icon="Copy" tip="复制内容" />
        <IconButton icon="Download" tip="下载 .md" />
        <IconButton icon="MoreHorizontal" tip="更多" />
      </div>
    </div>
  );
}

function IconButton({ icon, tip }) {
  return (
    <button
      title={tip}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-elev)] hover:text-[var(--fg-primary)] transition-colors"
    >
      <Icon name={icon} size={14} />
    </button>
  );
}

function ConceptArtifact() {
  const concepts = [
    { n: 1, title: "信号塔修复", desc: "玩家化身工程师，在风暴边缘修复一系列损坏的信号塔，每修复一座塔的频率构成等差数列。", tags: ["故事性强", "操作单一"], score: 7.4 },
    { n: 2, title: "星图绘制", desc: "通过观测星辰位置补全星图缺失项，缺失项的坐标差恰为公差。强调推理与归纳。", tags: ["推理为主", "视觉抽象"], score: 8.1 },
    { n: 3, title: "能源补给", desc: "为殖民舰队规划补给点，每个补给点距离前一个递增固定值。引入资源调度玩法。", tags: ["综合性高", "扩展性强"], score: 9.0, featured: true },
    { n: 4, title: "护盾校准", desc: "校准多层护盾的能量频率，使其形成等差序列方可抵御外敌。", tags: ["紧迫感", "操作较多"], score: 7.8 },
    { n: 5, title: "轨道计算", desc: "根据卫星初速度与加速度推导每秒位置，形成等差数列。物理感最强。", tags: ["物理结合", "数学硬核"], score: 8.3 },
  ];

  return (
    <div>
      <ArtifactHeader
        code="L05-02"
        title="数列引入 · 5 个候选概念"
        category="概念方案"
        status="待筛选"
        statusTone="accent"
        time="12:39:18"
        type="Markdown · 1.2 KB"
      />

      {/* Single header strip — replaces the dark "summary" card + 3 metric tiles */}
      <div
        className="mb-5 rounded-2xl p-4 flex items-start gap-4"
        style={{ background: "var(--surface-card)", boxShadow: "inset 0 0 0 1px var(--border)" }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-soft)" }}
        >
          <Icon name="Lightbulb" size={18} className="text-[var(--accent-ink)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] leading-relaxed text-[var(--fg-secondary)]">
            基于「星际探险队」世界观，针对<span className="font-medium text-[var(--fg-primary)]">「等差递推」</span>知识点生成 5 个差异化包装方向。
            请挑选一个进入验证流程,或回复要求重新生成。
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Pill tone="neutral">5 个候选</Pill>
            <Pill tone="neutral">差异化覆盖：故事 · 推理 · 综合 · 操作 · 物理</Pill>
          </div>
        </div>
      </div>

      {/* Concept cards — proper grid, no left-border-accent style */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {concepts.map((c) => (
          <ConceptCard key={c.n} {...c} />
        ))}
      </div>
    </div>
  );
}

function ConceptCard({ n, title, desc, tags, score, featured }) {
  return (
    <div
      className="rounded-2xl p-4 transition-all cursor-pointer hover:translate-y-[-1px]"
      style={{
        background: featured ? "var(--surface-card)" : "var(--surface-card)",
        boxShadow: featured
          ? "inset 0 0 0 2px var(--accent), 0 4px 12px color-mix(in oklch, var(--accent) 12%, transparent)"
          : "inset 0 0 0 1px var(--border)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] font-semibold text-[var(--fg-faint)]">
            #{String(n).padStart(2, "0")}
          </span>
          <h3 className="text-[14px] font-semibold tracking-tight text-[var(--fg-primary)]">
            {title}
          </h3>
        </div>
        {featured && <Pill tone="accent" icon="Star">推荐</Pill>}
      </div>
      <p className="text-[12px] leading-relaxed text-[var(--fg-secondary)] mb-3">
        {desc}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--surface-elev)", color: "var(--fg-secondary)" }}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="font-mono text-[11px] text-[var(--fg-faint)]">契合度</span>
          <span className="font-mono text-[14px] font-semibold text-[var(--fg-primary)]">
            {score.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ValidationArtifact() {
  const checks = [
    { id: "world", label: "世界观一致性", status: "pass", note: "「星际探险队」设定与补给玩法契合,无矛盾" },
    { id: "knowledge", label: "知识点覆盖", status: "pass", note: "等差递推核心概念充分体现" },
    { id: "difficulty", label: "难度梯度", status: "warn", note: "第 3 个补给点跨度偏大,建议拆为 2 步" },
    { id: "pedagogy", label: "教学法", status: "pass", note: "符合「具象-抽象」过渡原则" },
    { id: "narrative", label: "叙事节奏", status: "warn", note: "中段缺少情绪起伏,可加入资源紧张事件" },
    { id: "engagement", label: "参与度", status: "pass", note: "决策点充足,玩家代入感强" },
  ];

  const suggestions = [
    "在第 3 个补给点处插入「燃料告急」事件,延后 1 个补给点的引入",
    "为「公差」概念增加可视化锚点(如距离刻度)",
    "中段加入 NPC 对话推进剧情,缓解纯计算的疲劳感",
    "结尾增加「补给完成 / 失败」两种分支以强化决策反馈",
  ];

  return (
    <div>
      <ArtifactHeader
        code="L05-02"
        title="数列引入 · 验证报告"
        category="验证报告"
        status="可推进"
        statusTone="success"
        time="12:43:51"
        type="Markdown · 2.4 KB"
      />

      {/* Top conclusion strip — restrained, no AI tropes */}
      <div
        className="mb-5 rounded-2xl p-4 flex items-center gap-4"
        style={{ background: "var(--surface-card)", boxShadow: "inset 0 0 0 1px var(--border)" }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--success-soft)" }}
        >
          <Icon name="ShieldCheck" size={18} className="text-[var(--success-ink)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[var(--fg-primary)]">
            可推进至文档编写
          </div>
          <div className="text-[11px] text-[var(--fg-muted)] mt-0.5">
            6 项校验通过 4 项,2 项低风险偏差(可选优化)
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 pr-1">
          <Stat label="通过" value="4" tone="success" />
          <Stat label="偏差" value="2" tone="accent" />
          <Stat label="阻塞" value="0" tone="neutral" />
        </div>
      </div>

      {/* 2-pane: checks grid + suggestions */}
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-4">
        <div>
          <SectionLabel>逐项校验</SectionLabel>
          <div className="space-y-1.5">
            {checks.map((c) => (
              <CheckRow key={c.id} {...c} />
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>修改建议</SectionLabel>
          <ol
            className="rounded-2xl p-1 space-y-px"
            style={{ background: "var(--surface-card)", boxShadow: "inset 0 0 0 1px var(--border)" }}
          >
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold mt-0.5"
                  style={{ background: "var(--surface-elev)", color: "var(--fg-secondary)" }}
                >
                  {i + 1}
                </span>
                <span className="text-[12px] leading-relaxed text-[var(--fg-secondary)]">
                  {s}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="mb-2 px-1 font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--fg-faint)]">
      {children}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const colors = {
    success: "var(--success)",
    accent: "var(--accent)",
    neutral: "var(--fg-muted)",
  };
  return (
    <div className="text-right">
      <div className="font-mono text-[18px] font-semibold leading-none" style={{ color: colors[tone] }}>
        {value}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--fg-faint)] mt-0.5">
        {label}
      </div>
    </div>
  );
}

function CheckRow({ label, status, note }) {
  const cfg = {
    pass: { icon: "Check", color: "var(--success)", bg: "var(--success-soft)", text: "通过" },
    warn: { icon: "AlertTriangle", color: "var(--accent)", bg: "var(--accent-soft)", text: "偏差" },
    fail: { icon: "X", color: "var(--danger)", bg: "var(--danger-soft)", text: "阻塞" },
  }[status];
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-3 py-2.5"
      style={{ background: "var(--surface-card)", boxShadow: "inset 0 0 0 1px var(--border)" }}
    >
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5"
        style={{ background: cfg.bg }}
      >
        <Icon name={cfg.icon} size={11} strokeWidth={2.5} className="text-[var(--fg-primary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[12px] font-semibold text-[var(--fg-primary)]">{label}</span>
          <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: cfg.color }}>
            {cfg.text}
          </span>
        </div>
        <div className="text-[11px] leading-relaxed text-[var(--fg-muted)]">{note}</div>
      </div>
    </div>
  );
}

// ============================================================
// STATE NAV (demo controls)
// ============================================================
function StateNav({ state, onChange }) {
  const states = [
    { id: "empty", label: "01 空态", desc: "未上传文档" },
    { id: "ready", label: "02 资料齐备", desc: "准备开始" },
    { id: "thinking", label: "03 思考运行中", desc: "Orchestrator + 工具" },
    { id: "concept", label: "04 概念方案", desc: "工具完成" },
    { id: "approval", label: "05 等待审批", desc: "需要人工确认" },
    { id: "validation", label: "06 验证报告", desc: "工件区呈现" },
  ];

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-0.5 rounded-full p-1 backdrop-blur-md"
      style={{
        background: "color-mix(in oklch, var(--surface-card) 90%, transparent)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), inset 0 0 0 1px var(--border)",
      }}
    >
      {states.map((s) => {
        const active = state === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            title={s.desc}
            className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
            style={{
              background: active ? "var(--surface-inverse)" : "transparent",
              color: active ? "var(--fg-inverse)" : "var(--fg-secondary)",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// APP
// ============================================================
const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/{
  "theme": "linen"
}/*EDITMODE-END*/;

function useViewportWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1440);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULS);
  const [state, setState] = useState("ready");
  const [viewMode, setViewMode] = useState("split");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [model, setModel] = useState("gemini-2.5-flash");
  const vw = useViewportWidth();
  const isCompact = vw < 1180;
  const isMobile = vw < 760;

  // Auto-collapse the setup rail on compact viewports
  useEffect(() => {
    if (isCompact) setSidebarCollapsed(true);
  }, [isCompact]);

  // Force single-pane on mobile
  const effectiveViewMode = isMobile && viewMode === "split" ? "chat" : viewMode;

  useEffect(() => {
    applyTheme(tweaks.theme);
  }, [tweaks.theme]);

  const artifactCount = state === "concept" || state === "approval" ? 1 : state === "validation" ? 2 : 0;

  const handleTabClick = (tab) => {
    if (tab === "split") setViewMode("split");
    else setViewMode((prev) => (prev === tab ? "split" : tab));
  };

  return (
    <div
      className="relative h-screen w-full flex flex-col overflow-hidden"
      style={{ background: "var(--surface-ground)", color: "var(--fg-primary)" }}
      data-screen-label={`Agent Designer / ${state}`}
    >
      <div className="px-3 pt-3 md:px-4 md:pt-4">
        <TopBar
          viewMode={effectiveViewMode}
          onTabClick={handleTabClick}
          artifactCount={artifactCount}
          model={model}
          onModelChange={setModel}
          isMobile={isMobile}
        />
      </div>

      <div className="flex-1 min-h-0 flex gap-3 p-3 md:gap-4 md:p-4 md:pt-3">
        {/* Left pane */}
        <div className={`h-full flex gap-3 md:gap-4 min-w-0 flex-1 ${effectiveViewMode === "artifacts" ? "hidden" : "flex"}`}>
          <SetupRail
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            state={state}
          />
          <ChatArea
            state={state}
            onApprove={() => setState("validation")}
            onReject={() => setState("thinking")}
          />
        </div>

        {/* Right pane */}
        <div className={`h-full min-w-0 flex-1 ${effectiveViewMode === "artifacts" ? "flex" : effectiveViewMode === "chat" ? "hidden" : "flex"}`}>
          <ArtifactArea state={state} />
        </div>
      </div>

      <StateNav state={state} onChange={setState} />

      <TweaksPanel title="Tweaks">
        <TweakSection title="主题">
          <TweakRadio
            value={tweaks.theme}
            onChange={(v) => setTweak("theme", v)}
            options={[
              { value: "linen", label: "Warm Linen" },
              { value: "cool", label: "Cool Gray" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
