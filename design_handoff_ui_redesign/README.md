# Handoff: ADT 工作台 UI 重设计

## Overview

将 `web-app/` 现有的 Agent Designer V2 工作台（Chat + Artifacts 双栏 + 策划准备侧栏）按照新版 UI 设计稿迁移落地。本次重设计**保留所有现有功能、数据流、状态管理**，只替换组件的视觉与结构。

## About the Design Files

本目录下的 HTML / JSX 文件是**设计参考稿**，使用纯 React + Tailwind CDN 在浏览器内 Babel 编译 + 假数据演示完成。它们不是要直接拷进项目的生产代码。你的任务是**在现有 Next.js + Tailwind v4 + shadcn 环境里重写这些组件**，对接 `useArtifactStore / useConversationStore / useSetupStore / useChat` 等真实数据源，保持 `data-testid` 不变以免破坏 E2E。

参考文件：
- `Agent Designer 工作台.html` — 入口与全局样式
- `app.jsx` — 全部组件实现（约 1100 行，单文件方便阅读，落地时按 `src/components/` 现有目录拆分）
- `tweaks-panel.jsx` — 仅设计稿用的主题切换面板，**不要落地到生产**
- `preview-standalone.html` — 离线可双击打开的完整预览，含 6 个状态切换条

## Fidelity

**High-fidelity（hifi）**。颜色、间距、字号、字重、圆角、动效都已最终化。请按下面"设计令牌"小节里的精确数值实现。如果与现有 `globals.css` 的 token 冲突，**以本稿为准并更新 token**。

## 改动总览（与现有代码对比）

| 区域 | 现状问题 | 新方案 |
|---|---|---|
| TopBar | 双段切换 + 模型胶囊 | 三段（对话 / 分屏 / 设计文档）+ 模型下拉菜单（带 provider/hint） |
| ProgressRail | `1/7` 数字 + 单条进度条 | 7 步标签轨道（已完成 ✓ / 当前高亮 / 未来灰）+ 题组进度独立行 |
| SetupSidebar | 标题 + 描述 + 上传卡 | "STEP 01/02" 引导式上传卡，会话列表上移到顶部，成果管理在底部 |
| ChatArea 工具卡 | 图标 + 名称 + 状态 pill | 加 summary 描述行 + artifact 跳转条（带 ↗ 图标），更明显的层级 |
| ApprovalBar | 灰白 surface-card | 暖色 `--accent-soft` 填充 + 手势图标，强调"需要操作" |
| ArtifactArea | Tabs + 暗色 summary 卡 + 3 个无意义指标卡（行数/章节数/表格行数） | 单条 Header strip（code · category · status pills + 标题 + 时间 + 操作按钮）+ 内容专属布局 |
| ArtifactArea 概念方案 | 直接渲染 Markdown | 候选方案 2 列网格卡 + 契合度评分 + 推荐 pill |
| ArtifactArea 验证报告 | 两个 prose 块 | 顶部结论条（4 通过 / 2 偏差 / 0 阻塞 计数）+ 逐项校验列表 + 编号建议清单 |

**移除项**：`getArtifactMetrics()` 调用（行数/章节数/表格行数 3 个指标卡）和对应的 UI——用户明确反馈"看着像数据看板，但其实没价值"。

## Screens / Views

设计稿覆盖 6 个状态。在 `preview-standalone.html` 底部导航条点击切换。

### 01 空态
- 还未上传任何文档；侧栏 STEP 01/02 都是上传 dropzone；CTA "开始策划" 禁用
- ChatArea 中央显示品牌 mark + 简介 + 一条小提示 "← 先在左侧上传文档"

### 02 资料齐备
- 侧栏两个 STEP 卡都已有文件名（绿色 ✓ + 文件大小）
- ChatArea 中央卡片展示资源摘要 + 流程提示 + "开始策划流程" 实色按钮
- 顶部不显示 ProgressRail（流程未启动）

### 03 思考运行中
- 显示 ProgressRail，currentStep=2（"概念候选"高亮）
- 用户消息 + Orchestrator 回复 + 工具卡（status=running，pill 含三点跳动）+ 思考气泡（shimmer 文字 + 三点）

### 04 概念方案完成
- 工具卡 status=done（绿色 ✓ pill）+ summary 行 + 跳转条 "查看 ↗"
- 右侧 ArtifactArea 展示 5 张候选概念卡（2 列网格），第 3 张高亮"推荐"

### 05 等待审批
- 同 04 + 一条 ApprovalBar：暖色 `--accent-soft` 填充，左侧手势图标，右侧"换一个方案" + "确认继续 →" 两个按钮

### 06 验证报告
- ProgressRail currentStep=4
- ArtifactArea 切到第二个 tab "验证报告"，展示结论条 + 6 项校验 + 4 条建议

## 设计令牌（精确值）

放进 `web-app/src/app/globals.css` 的 `:root`，覆盖现有同名 token：

```css
:root {
  /* Surfaces */
  --surface-ground: #ece2d5;     /* 整页底色（露出来的间隙） */
  --surface-tile:   #f7f1e8;     /* 主要 bento 板块 */
  --surface-card:   #ffffff;     /* 卡片 */
  --surface-elev:   #fdfaf5;     /* 板块内的次级容器 */
  --surface-inverse:#1a1714;     /* 反色（深色填充按钮、品牌方块） */

  /* Foreground */
  --fg-primary:  #1a1714;
  --fg-secondary:#3d3833;
  --fg-muted:    #7a7269;
  --fg-faint:    #a89e92;        /* 元数据、占位 */
  --fg-inverse:  #ffffff;

  /* Accent — 暖陶色，比现状更饱和一档 */
  --accent:     #c97e54;
  --accent-soft:#f3dfcd;
  --accent-ink: #5a2e16;

  /* Status */
  --success:     #4a7d5a;
  --success-soft:#dde9dd;
  --success-ink: #2a4a33;
  --danger:     #a13e3e;
  --danger-soft:#f0d9d9;
  --danger-ink: #5a1f1f;

  /* Borders（新增；落地用 inset 0 0 0 1px var(--border) 模拟描边） */
  --border:        #e3d8c8;
  --border-strong: #cdbfac;
}
```

**字体**：
- Sans：Inter（已有）
- Mono：JetBrains Mono（新增；用于代码块、ID、时间戳、`STEP 01` 这类小标）

**字号体系**（全部 px，对应 Tailwind 任意值如 `text-[12px]`）：
- 11 / 12 / 13 / 14（正文与 UI 文本）
- 10（mono 元数据，配 `tracking-[0.12em] uppercase`）
- 18 / 22（标题）

**圆角**：
- `rounded-md` 6 / `rounded-lg` 10 / `rounded-xl` 14 / `rounded-2xl` 18
- 主板块（TopBar / ChatArea / ArtifactArea / SetupRail）统一 `rounded-2xl`

**间距**：
- Bento 间隙 `gap-3 md:gap-4 p-3 md:p-4`
- 板块内边距 `px-4 py-3` 或 `p-4`
- 卡片内 `p-3` / `p-4`

**阴影**：基本不使用 drop-shadow，**用 `box-shadow: inset 0 0 0 1px var(--border)` 做边线**。仅悬浮模型选择菜单用 `0 12px 32px rgba(0,0,0,0.12)`。

## Components — 落地映射

按文件逐一对应现有代码。**保留所有 `data-testid`，保留所有 props 与 store 调用**。

### 1. `src/components/workspace/TopBar.tsx`
- 中段切换从 2 个变 3 个：`["chat", "split", "artifacts"]`，加 lucide 图标 `MessageSquare / Columns2 / FileText`
- 工件 count badge 在 active 态下用 `--accent` 实色，非 active 用 `--accent-soft`
- 品牌副标改为 `font-mono text-[10px]` 的 `v2 · 多智能体关卡工作台`
- 替换 `Sparkles` 图标为内联 SVG 8 角星（参考 `app.jsx` 第 ~410 行）

### 2. `src/components/chat/ModelPicker.tsx`
- 改为受控菜单（不再是 `<select>`），点击展开浮层
- 浮层内每行：状态点 + label + provider + hint，选中行右侧 ✓
- 触发器：`StatusDot success` + `font-mono` 模型 label + `ChevronDown`
- 浮层背景 `--surface-card`，边线 `inset 0 0 0 1px var(--border)`，外阴影 `0 12px 32px rgba(0,0,0,0.12)`

### 3. `src/components/chat/ChatArea.tsx`

**ProgressRail**（替换现有 `latestState` 渲染块）：
```
[当前 · {lesson}                              题组 1/6 → 题组 02 / 等差递推]
[ ① 解析输入 ✓ │ ② 概念候选（高亮）│ ③ 用户筛选 │ … │ ⑦ 整合归档 ]
```
- 每个 step 占 `flex-1`，圆角 `rounded-md`，padding `px-2 py-1.5`
- 已完成：步骤数字圆 = `--success` 实色 + ✓；标签 `--fg-secondary`
- 当前：背景 `--accent-soft`，数字圆 = `--accent` 实色，标签 `--accent-ink`
- 未来：背景透明，数字圆 = `--surface-ground`，标签 `--fg-faint`

**ToolCard**（替换 `toolParts.map` 内的卡片）：
- 顶行：图标方块（8x8）+ 标题 + ID + 状态 pill
- 中行（新增）：summary 文字（11px，`--fg-muted`），来自工具结果的简短描述
- 底行（artifact 存在时）：跳转条，从 `bg-[var(--surface-ground)]` 改为顶部 `border-t` 分隔，hover `--surface-elev`，右侧 `查看 ↗`（`ArrowUpRight` 图标）

**ApprovalBar**（`src/components/workspace/ApprovalBar.tsx`）：
- 容器背景 `--accent-soft`，加 `inset 0 0 0 1px color-mix(in oklch, var(--accent) 25%, transparent)`
- 左侧 8x8 圆角方块（`--surface-card` 底）+ `Hand` 图标
- 拒绝按钮：`--surface-card` 底；确认按钮：`--surface-inverse` 底 + `ArrowRight` 后缀图标

**Composer**：
- 容器从 `focus-within:ring` 改为常态 `inset 0 0 0 1px var(--border)`
- 工具栏左侧加 `AtSign` 图标按钮（占位，未来可用于 mention）
- 发送按钮 disabled 用 `opacity: 0.4`，不显示禁用色

### 4. `src/components/artifacts/ArtifactArea.tsx`

**Tabs**：
- 非 active 用 `--surface-elev` 而非 `--surface-ground`
- label 拆成 `font-mono text-[10px] opacity-70 {courseCode}` + 标题，分别渲染

**ArtifactHeader**（替换现有标题块 + dark summary 卡 + 3 metric 卡）：
```tsx
<div>
  <div className="flex items-center gap-2 mb-1.5">
    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-faint)]">
      {courseCode}
    </span>
    <Divider />
    <Pill tone="neutral" icon="Tag">{category}</Pill>
    <Pill tone={statusTone} icon="Check|AlertCircle">{status}</Pill>
  </div>
  <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
  <div className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
    <Clock /> {time} · {type}
  </div>
</div>
<RightActions> Copy / Download / More </RightActions>
```

**移除**：`getArtifactMetrics()` 的 3 个指标卡（行数 / 章节数 / 表格行数）。

**ConceptArtifact**（新组件，category === "概念方案" 时渲染）：
- 顶部单条 hero strip：暖色图标方块 + 描述 + 两个 neutral pill
- 2 列网格 `md:grid-cols-2`，每张卡：
  - `#01` 等编号（mono）+ 标题
  - 描述（12px，`--fg-secondary`）
  - 底栏：tags 数组（小 pill）+ 右侧"契合度 8.1"
  - 推荐项：`inset 0 0 0 2px var(--accent) + 0 4px 12px var(--accent)/12%`，加"推荐" pill
- 数据来源：需要 `parseConceptArtifact(content)` 新解析器，从 markdown 抽取 5 个候选；如果短期解析不出，**回退到现有 ReactMarkdown 渲染**，UI 改造按本规范，但内容保留 prose

**ValidationArtifact**（替换现有 `parseValidationReport` 渲染）：
- 顶部结论条：图标方块 + 标题 "可推进至文档编写" + 副标 "6 项校验通过 4 项,2 项低风险偏差(可选优化)" + 右侧 3 个 Stat（通过/偏差/阻塞）
- 双栏 `md:grid-cols-[1.1fr_1fr]`：
  - 左：`SectionLabel "逐项校验"` + CheckRow 列表（每行：状态圆 + 标题 + 状态 mono 标 + 备注）
  - 右：`SectionLabel "修改建议"` + 编号 ol（每项：编号圆 + 文本）
- 校验项分类：`pass / warn / fail`，分别用 `--success / --accent / --danger` 配色

**PromptArtifact**：保留现有解析逻辑，按规范配色调整（绿/灰双栏，无大色块），细节参考 `app.jsx` 中的 ConceptCard 视觉语言。

### 5. `src/components/setup/SetupSidebar.tsx`

整体结构倒过来：会话列表在最上面，再是上传卡，再是 CTA，再是成果管理。

**SessionsBlock**（替换 `<SessionSwitcher />`）：
- 容器 `--surface-elev`，可折叠 header
- 会话项 active 态：`--accent-soft` 底 + 蓝点改用 `--accent` 实色
- 非 active：透明 + `--fg-faint` 小点

**UploadCard**（替换 `<DocUploadCard>`）：
- 顶部 `STEP 01` mono label + 标题
- 描述（11px）
- 文件已上传：白底卡片 + `FileCheck2` 绿色 + 文件名 + 大小（mono 10px）+ X 按钮
- 未上传：dashed border dropzone + `Upload` 图标 + "点击上传 .md / .txt"

**OutputsBlock**（替换"成果管理"折叠块）：
- 容器 `--surface-elev`，可折叠 header（含 count badge）
- 列表项：checkbox + 类型图标 + courseCode/title + 时间
- 底部"下载选中"按钮

### 6. 新增小组件（建议放 `src/components/ui/` 或 `src/components/workspace/primitives/`）

- `<StatusDot tone="accent|success|danger|muted" />` — 1.5x1.5 圆点
- `<Pill tone icon>` — 11px 胶囊，5 种 tone（neutral / accent / success / danger / inverse）
- `<ThinkingDots tone />` — 三点跳动
- `<SectionLabel>` — `mono text-[10px] uppercase tracking-[0.12em] text-[var(--fg-faint)]`

## Interactions & Behavior

- **TopBar 中段切换**：点击非当前 tab 切到该 tab；点击当前 tab **不再回到 split**（与原行为不同），改为点击 split 才回 split
- **ApprovalBar 按钮**：保持现有 `onApprove / onReject` 回调签名
- **ToolCard artifact 跳转**：保持调用 `setActiveArtifact(sessionId, toolCallId)`
- **ModelSwitcher 浮层**：点 backdrop 关闭；选中后立即调用 `setModelId` 并关闭
- **SetupRail 折叠**：保持 `useSetupStore.toggleCollapse()`，宽度从 320 → 280
- **响应式**：< 1180px 自动折叠 SetupRail；< 760px 强制单栏（不显示 split）
- **动效**：所有过渡 `transition-colors` 默认 150ms；hover translate-y 仅用于"推荐"那张概念卡的 hover

## State Management

**完全不动**。继续用：
- `useArtifactStore` — artifacts、activeArtifactId
- `useConversationStore` — sessions、messages、activeSessionId
- `useSetupStore` — worldDoc、lessonDoc、isCollapsed、initialPrompt
- `useModelStore` — modelId
- `useChat` from `@ai-sdk/react`

新增的 UI 状态（如 ModelSwitcher 的 open）用 `useState` 局部管理。

## Assets

- **图标**：lucide-react（已有）。本稿用到的新图标：`PanelLeftOpen / PanelLeftClose / Columns2 / Hand / Lightbulb / FileCheck2 / Tag / ArrowUpRight / Globe2 / BookOpen / Play / Star / AtSign / FolderDown / Clock`
- **字体**：Inter（已有）+ JetBrains Mono（需在 `layout.tsx` 用 `next/font` 引入）
- **图片 / SVG**：无外部资源，品牌 mark 是内联 SVG 8 角星（见 `app.jsx`）

## 不要做的事

- ❌ 不要保留"行数 / 章节数 / 表格行数"3 个指标卡
- ❌ 不要用左色条 + 浅色填充的卡片样式（用户明确反对）
- ❌ 不要加 emoji
- ❌ 不要加大面积渐变背景（顶栏、按钮、强调块都用实色或 inset-soft）
- ❌ 不要落地 `tweaks-panel.jsx` 和主题切换 — 那只是设计稿用来对比 Warm Linen / Cool Gray / Dark 的工具，生产环境只用 Warm Linen
- ❌ 不要改 `useChat` 的请求逻辑、`/api/chat` 路由、artifact 解析器的核心字段

## 落地建议步骤

1. **令牌先行**：先把 `globals.css` 的 token 替换成本稿值，跑一遍现有 UI，确认没有崩坏
2. **引入字体**：在 `layout.tsx` 加 JetBrains Mono
3. **新增 primitives**：`StatusDot / Pill / ThinkingDots / SectionLabel` 4 个小组件
4. **TopBar + ModelPicker**：先改这两个，验证三段切换 + 模型菜单
5. **ProgressRail**：从 ChatArea 中拆出独立组件，按 7 步轨道实现
6. **ToolCard + ApprovalBar**：ChatArea 的核心视觉
7. **ArtifactHeader + 移除指标卡**：ArtifactArea 的最大改动
8. **ConceptArtifact + ValidationArtifact**：内容专属布局，前者需要新解析器（如果嫌麻烦，先回退到 ReactMarkdown）
9. **SetupSidebar 重排**：会话上移、Step 01/02 卡、成果管理在底
10. **响应式断点**：1180 / 760 两个临界值

## E2E 兼容

请保留所有 `data-testid`：`workspace-top-bar / chat-input / chat-send-button / chat-upload-button / chat-empty-state / chat-message-list / chat-loading-state / chat-request-error / chat-uploaded-file-preview / approval-bar / artifact-tabs / artifact-empty-state / artifact-active-title / artifact-content / artifact-image / artifact-code / model-picker / model-picker-select / session-switcher / session-switcher-new / session-switcher-list / session-switcher-item`。

ModelPicker 改成自定义浮层后，原 `<select data-testid="model-picker-select">` 不存在了 — 请保留一个隐藏的 `<select>` 镜像当前选中值，或在浮层每个 option 上加 `data-testid="model-picker-option-{id}"` 并更新 E2E。

## Files

```
design_handoff_ui_redesign/
├── README.md                       (本文件)
├── Agent Designer 工作台.html        (入口 + 全局样式 + 字体引入)
├── app.jsx                          (全部 React 组件，~1100 行单文件)
├── tweaks-panel.jsx                 (主题切换 — 仅设计稿用，不要落地)
└── preview-standalone.html          (离线可双击打开的完整预览)
```

落地后建议的代码结构（在你现有 `web-app/src/` 下）：

```
src/components/
├── workspace/
│   ├── TopBar.tsx                   (改造)
│   ├── ProgressRail.tsx             (新增 — 从 ChatArea 拆出)
│   ├── ApprovalBar.tsx              (改造)
│   ├── SessionSwitcher.tsx          (改造)
│   └── primitives/
│       ├── StatusDot.tsx            (新增)
│       ├── Pill.tsx                 (新增)
│       ├── ThinkingDots.tsx         (新增)
│       └── SectionLabel.tsx         (新增)
├── chat/
│   ├── ChatArea.tsx                 (改造 — 抽出 ProgressRail / ToolCard)
│   ├── ToolCard.tsx                 (新增 — 从 ChatArea 拆出)
│   └── ModelPicker.tsx              (重写为自定义浮层)
├── artifacts/
│   ├── ArtifactArea.tsx             (改造 — 改为路由到 sub-views)
│   ├── ArtifactHeader.tsx           (新增)
│   ├── ConceptArtifact.tsx          (新增)
│   ├── ValidationArtifact.tsx       (新增)
│   └── PromptArtifact.tsx           (新增)
└── setup/
    ├── SetupSidebar.tsx             (改造 — 重排 + UploadCard)
    └── UploadCard.tsx               (新增)
```

## 给 Claude Code 的开场提示

把这份 README 直接喂给 Claude Code，并告诉它：

> 我要按 `design_handoff_ui_redesign/README.md` 重设计 `web-app/` 的工作台 UI。请按 README 末尾的"落地建议步骤"逐步执行，每完成一步跑一次 `npm run lint && npm run build` 确认没有崩坏。所有 `data-testid` 必须保留以兼容 E2E。完成度按 README 的"Components — 落地映射"小节验收，**不要**改 `useChat / /api/chat / artifactParser` 的核心字段。
