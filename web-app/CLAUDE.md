@AGENTS.md

# Agent Designer V2 — 开发手册

> 面向 Claude Code 及其他 AI Agent 的快速上手文档。
> 阅读本文件后，应能立刻开始开发，无需额外询问。

---

## 项目一句话描述

基于 **Next.js + Vercel AI SDK + 公司 hetao AI 网关**（OpenAI 兼容协议）的多智能体 C++ 关卡策划系统。
Orchestrator 主控 Agent 驱动 4 个子 Agent 完成"7 步法"设计流程，结果实时同步到右侧工件区。

---

## 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（复制示例文件后填入 key）
cp .env.example .env.local

# 3. 启动开发服务器
npm run dev          # http://localhost:3000

# 4. 单元测试（推荐 npx vitest run；npm test 可能被注入过期 e2e filter）
npx vitest run

# 5. E2E 测试（会自动启动 dev server，无需手动）
npm run test:e2e
```

`.env.local` **唯一必填**是 `HETAO_GATEWAY_API_KEY`——所有模型共用这一把网关 Key。

UI 提供 6 个模型（deepseek-v4-flash / deepseek-v4-flash-free / deepseek-v4-pro /
qwen3.6-flash / gpt-5.4-mini / gpt-5.5），全部经公司网关路由，上游别名可用
`HETAO_MODEL_<UI_ID>` 环境变量热覆盖。详见 **[docs/MODELS.md](docs/MODELS.md)**。
**合规约束：禁止绕过网关直连任何外部 LLM 供应商。**

---

## 目录结构

```
src/
├── app/
│   ├── api/chat/
│   │   ├── route.ts              # POST 入口，~700 行，负责流编排 + guidance 兜底 + memory
│   │   └── tools/                # ★ 子 Agent 工具定义（每个工具独立文件）
│   │       ├── types.ts          #   ArtifactPayload / ToolOutput 类型
│   │       ├── inputSchema.ts    #   tolerantText 容错输入（防长文档截断把工具打挂）
│   │       ├── shared.ts         #   runSubAgentText/Object + 超时 + 错误分类
│   │       ├── designStageFile.ts#   含 lint+retry 闭环 + 机制差异化校验
│   │       ├── writeStageFile.ts
│   │       ├── validateStageFile.ts
│   │       ├── generateVisualDesign.ts
│   │       └── index.ts          #   统一 re-export
│   ├── layout.tsx
│   └── page.tsx                  # 双栏布局 + 移动端 Tab 切换
├── components/
│   ├── chat/                     # ChatArea / ModelPicker / ToolCard
│   ├── artifacts/                # ArtifactArea / ValidationArtifact（5维评分卡）/ ConceptArtifact / PromptArtifact
│   └── setup/SetupSidebar.tsx    # 左侧文档上传面板 + 下载按钮
├── lib/
│   ├── agents/
│   │   ├── prompts.ts            # 5 个 Agent 的 System Prompt 常量
│   │   ├── guidance.ts           # ★ GuidanceModel：结构化偏好（4 桶 + perGroupTheme 作用域隔离）
│   │   ├── rules/                # ★ 黑/白名单单一数据源 + lintText/formatLintFeedback
│   │   └── schemas/              # ★ ConceptSchema（含 dramaticConflict / stageMechanism）+ 序列化器
│   ├── llm/                      # ★ 模型接入层（全部走 hetao 网关）
│   │   ├── providers.ts          #   客户端共享：6 模型元数据 + ModelId 类型
│   │   ├── server.ts             #   服务端：createModel + UPSTREAM_MODEL_NAME 映射
│   │   ├── keyPool.ts            #   网关 Key 池（ENV_SPECS 只认 hetao）
│   │   └── gate.ts               #   并发闸（默认 pass-through，env opt-in 启用限流）
│   ├── setup/                    # buildInitialPrompt / parseLessonGroups
│   └── chat/
│       ├── memory.ts             # 消息规范化 + applyHeadAnchorWindow（头锚）
│       ├── memoryCache.ts        # 记忆压缩缓存
│       ├── toolArtifact.ts       # 从工具输出中提取 artifact
│       └── artifactParser.ts     # ★ 工件解析（类别、状态、State Block、验证报告）
└── store/
    ├── useArtifactStore.ts       # 工件 Zustand store（per-session + localStorage 持久化）
    ├── useConversationStore.ts   # 会话隔离 store
    ├── useModelStore.ts          # ★ 当前选中模型（已持久化）
    └── useSetupStore.ts          # 设置 Zustand store（文档上传状态）

tests/
└── e2e/
    └── chat-workspace.spec.ts    # Playwright E2E 测试（含移动端、持久化用例）
```

---

## 核心数据流

```
用户输入
  → ChatArea.sendMessage()                          # 携带 x-model-id 头
  → POST /api/chat
      → resolveModelId(header) → createModel()      # 统一 createOpenAI({ baseURL: 网关, apiKey })，
                                                    #   差异只在 resolveUpstreamModelName(modelId)
      → normalizeMessages + buildMemoryContext（消息 > 8 条时）
      → applyHeadAnchorWindow(messages, 8)          # ★ 长会话保护：第 1 条 user 消息永远在窗口首位
      → streamText（Orchestrator 模型）
          → 工具调用 → tools/ 子文件 → runSubAgentObject() / runSubAgentText()
          → 返回 { content, artifact }
  → UIMessageStream 流式返回
  → ChatArea（工具状态徽章）
  → getToolArtifact() 提取 artifact
  → useArtifactStore.addArtifact()  ← localStorage 自动持久化（per-session）
  → ArtifactArea 自动渲染
```

**长会话鲁棒性（2026-05-09 修复）**：`applyHeadAnchorWindow` 把"第一条 user 消息"（含 4 题组完整知识点）永久钉在历史首位，避免反复修改导致 kickoff 被 `slice(-N)` 切走。详见 `workspace/DEV_LOG.md` 顶部"接手指南"。

**Prompt 与规则解耦（2026-05-08 重构）**：黑/白名单存于 `src/lib/agents/rules/`，`generate_concepts` 模式用 schema-first / text-fallback 双路径 + lint+retry 闭环。详见 DEV_LOG。

**知识点"长在"剧情里（2026-05-13/14，2026-06-11 合入 main）**：ConceptSchema 强制 `dramaticConflict` 三段（blocker / whyThisCode / failureCost，"替换测试"判定）；整合文档用"主任务 + 冲突链"骨架；VALIDATOR 5 维 / 25 分，"知识点必要性 ≥4"是硬门槛。

**反同质化双轴（2026-06-11）**：概念差异化 = 题材（8 候选，覆盖 ≥3）× 舞台机制（`StageMechanism` 8 枚举，5 概念**两两不同**）。机制重复由 `findDuplicateMechanisms` 在 designStageFile 的 lint+retry 闭环里硬校验（**不要**改写成 Zod refine——会被误判 `schema_parse_failed` 触发降级）。结构化偏好走 `GuidanceModel` 4 桶，`perGroupTheme` 按 courseCode 严格作用域隔离，防"题材跨题组趋同"。

---

## 子 Agent 工具速查

| 工具函数 | 文件 | 调用时机 | 产出工件 |
|---------|------|---------|---------|
| `createDesignStageFileTool` | `tools/designStageFile.ts` | 步骤 1/6 | 核心包装概念 / 初步策划文档 |
| `createValidateStageFileTool` | `tools/validateStageFile.ts` | 步骤 4 | 验证报告 |
| `createWriteStageFileTool` | `tools/writeStageFile.ts` | 步骤 7 | 关卡设计介绍文档 |
| `createGenerateVisualDesignTool` | `tools/generateVisualDesign.ts` | 步骤 7 后 | 即梦提示词 |

**添加新工具的步骤**：
1. 在 `tools/` 新建 `yourTool.ts`，导出 `createYourTool(subAgentModel)` 函数
2. 在 `tools/index.ts` 中 re-export
3. 在 `route.ts` 的 `tools: { ... }` 对象中注册
4. 在 `lib/agents/prompts.ts` 中添加对应的 System Prompt 常量
5. 在 `components/chat/ChatArea.tsx` 的 `getToolDisplayName` map 中添加中文名

---

## 工件系统

### 工件的产生

工具执行完毕后，输出必须包含 `artifact` 字段：

```typescript
return {
  content: "…",          // 对话中显示的摘要文本
  artifact: {
    title: "验证报告",    // 工件标题（影响自动分类和解析）
    type: "markdown",    // "markdown" | "image" | "code"
    content: "…",        // 工件完整内容
  },
};
```

### 工件分类规则（在 `lib/chat/artifactParser.ts` 中维护）

| 标题关键词 | 分类 | 特殊解析 |
|----------|------|---------|
| 含"验证" | 验证报告 | `parseValidationReport()` 提取结论和建议 |
| 含"即梦"或"提示词" | 视觉提示词 | `parsePromptArtifact()` 提取英文 Prompt |
| 含"设计介绍"或"设计文档" | 落地文档 | — |
| 含"概念" | 概念方案 | — |
| 其他 | 通用工件 | — |

**修改分类逻辑只需编辑 `artifactParser.ts`，不需要动 UI 组件。**

### 工件持久化

`useArtifactStore` 使用 `zustand/middleware` 的 `persist` 中间件，存储 key 为 `agent-designer-artifacts`。
刷新页面后工件自动恢复。如需清空，调用 `clearArtifacts()` 或直接清除 `localStorage`。

---

## 测试

### 单元测试（Vitest）

```bash
npx vitest run    # 推荐；npm test 可能被注入过期的 tests/e2e filter 导致退码 1
```

当前基线：**18 个文件 / 304 个测试 / 全绿**（2026-06-11）。测试文件放在对应源文件旁（`*.test.ts`），重点：
- `lib/agents/prompts.test.ts` — prompt 内容契约（执行阶段 / 双轴差异化 / 模式感知）
- `lib/agents/schemas/conceptSchema.test.ts` — ConceptSchema + 机制重复检测
- `app/api/chat/tools/designStageFile.test.ts` — lint+retry 闭环 + schema/text 双路径降级
- `lib/agents/guidance.test.ts` — GuidanceModel 序列化与作用域隔离
- `lib/chat/memory.test.ts` / `artifactParser.test.ts` — 头锚窗口、State Block / 验证报告解析
- `store/*.test.ts` — 工件 / 会话 / 设置 store

### E2E 测试（Playwright）

```bash
npm run test:e2e
```

测试文件：`tests/e2e/chat-workspace.spec.ts`

已覆盖场景（通过 `x-chat-test-mode` 头走 mock 分支，不调真实 LLM）：

| 场景 | 触发标记 | 说明 |
|------|---------|------|
| success | `[test-scenario:success]` | 正常生成工件 |
| tool-error | `[test-scenario:tool-error]` | 工具执行失败 |
| request-error | `[test-scenario:request-error]` | HTTP 请求级失败 |
| approval | `[test-scenario:approval]` | 等待人工确认状态 |

**移动端测试**：使用 `test.use({ viewport: { width: 375, height: 812 } })` 切换视口。

**持久化测试**：生成工件后 `page.reload()`，验证工件仍然存在。

---

## 关键设计决策（ADR 摘要）

| 决策 | 选择 | 原因 |
|------|------|------|
| LLM Provider | 单一公司 `hetao` 网关（OpenAI 兼容），6 个 UI 模型共用 1 把 Key | 公司合规策略；网关侧承担鉴权/路由/限流/审计 |
| 模型路由 | HTTP Header `x-model-id` + `UPSTREAM_MODEL_NAME` 映射表 | 客户端不接触 Key；TS 穷举检查防遗漏；上游别名 env 可热覆盖 |
| 并发限流 | 客户端默认关闭（pass-through Semaphore），env opt-in | 旧默认 "Key池×3" 在单 Key 场景自死锁（2026-05-28 修复） |
| 流式协议 | Vercel AI SDK `streamText` + UIMessageStream | 内置工具调用状态同步 |
| 状态管理 | Zustand + persist | 轻量，无需 Redux；persist 解决刷新丢失 |
| 工件解析 | 独立 `artifactParser.ts` | 解耦 UI 与业务规则，便于独立测试 |
| 工具定义 | 每个工具独立文件 | `route.ts` 保持精简，单工具可独立修改 |
| 移动端 | Tab 切换（非隐藏） | 移动端用户也能查看生成的设计文档 |
| E2E 测试模式 | Header `x-chat-test-mode: 1` | 不依赖真实 API，CI 可稳定运行 |

---

## 常见开发任务

### 修改子 Agent 的生成行为
编辑 `src/lib/agents/prompts.ts` 中对应的 Prompt 常量。

### 修改工具的输入参数
编辑对应 `src/app/api/chat/tools/*.ts` 文件的 `inputSchema`，同步更新 Orchestrator Prompt 中的工具说明。

### 新增工件解析类型
在 `src/lib/chat/artifactParser.ts` 中：
1. 在 `getArtifactCategory()` 添加新标题匹配规则
2. 添加对应的 `parseXxx()` 函数
3. 在 `ArtifactArea.tsx` 中按需渲染新的解析结果卡片

### 新增支持的大模型
详细步骤见 [docs/MODELS.md 最底部"开发者：如何新增一个模型"](docs/MODELS.md#开发者如何新增一个模型)。简要：
1. `src/lib/llm/providers.ts` → `AVAILABLE_MODELS` 新增一项（UI id + label + hint）
2. `src/lib/llm/server.ts` → `UPSTREAM_MODEL_NAME` map 加一条"UI id → 网关上游别名"
3. `.env.example` + `docs/MODELS.md` 同步更新

**不要**新建 provider 类型或给 `createModel` 加 case 分支——所有模型共用同一份
`createOpenAI({ baseURL, apiKey })`。上游别名变更用 `HETAO_MODEL_<UI_ID>` env 覆盖，不改代码。

### 调整概念差异化（题材 / 机制）
- 题材候选：改 `prompts.ts` DESIGNER 差异化要求 + `schemas/conceptSchema.ts` 的 `ThemeDimension` 枚举（两处同步）
- 舞台机制：改 `StageMechanism` 枚举 + DESIGNER prompt 的 8 行机制清单表（两处同步，prompts.test.ts 有逐项断言）
- 机制必须由白名单动作组合定义（`rules/whitelists.ts`），多样性不能顶破制作可行性红线

### 调试 LLM 调用
请求时带上 header `x-chat-debug: 1`，或设置 `CHAT_DEBUG=1` 环境变量，服务端会打印详细日志（包含 `modelId` 字段方便排查走错供应商）。

### 子 Agent 流式调用（应对首 token 慢的上游）
默认子 Agent 走 `generateText` + 60s/120s 墙钟。部分上游在长 prompt 下首 token 慢、但持续吐字稳定，会误触发 `[network_timeout]`。设置 `SUB_AGENT_USE_STREAMING=1` 切换到 `streamText` + chunkMs 空闲超时（40s/60s 无新 token 才 abort），单次 idle 重试，总墙钟提升到 90s/180s 兜底。逻辑集中在 [src/app/api/chat/tools/shared.ts](src/app/api/chat/tools/shared.ts)。

---

## 待办 / 已知限制

| 项目 | 状态 | 说明 |
|------|------|------|
| 即梦 CLI 接入 | 未完成 | 当前仅输出提示词文档，未调用真实出图 API |
| 会话隔离 | 已完成 | `useConversationStore` + 工件 store per-session（commit `e15bd23`） |
| 真实 7 步法实测 | **未做（下次首选）** | 三批反同质化工作 + 双轴差异化均未经过完整真实流程验证，见 DEV_LOG 优先级 TODO |
| 机制校验只在 schema 路径生效 | 已知折衷 | 文本回退路径无结构化数据可查机制重复（DeepSeek 等不支持 JSON-schema 时） |
| 消息列表虚拟滚动 | 未完成 | 长会话时 DOM 节点堆积，可用 `@tanstack/virtual` |
| 长上下文处理 | 基础实现 | 超过 8 条消息才触发 LLM 记忆压缩，可改为基于 token 计数 |
