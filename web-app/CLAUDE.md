@AGENTS.md

# Agent Designer V2 — 开发手册

> 面向 Claude Code 及其他 AI Agent 的快速上手文档。
> 阅读本文件后，应能立刻开始开发，无需额外询问。

---

## 项目一句话描述

基于 **Next.js + Vercel AI SDK + Google Gemini** 的多智能体 C++ 关卡策划系统。
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

# 4. 单元测试
npm test

# 5. E2E 测试（会自动启动 dev server，无需手动）
npm run test:e2e
```

`.env.local` 最少需要配置**你想在 UI 上切换到的那一个模型**对应的 Key 即可。
其余模型在被选中时会返回友好的缺失 Key 提示。

完整的 5 个模型（Gemini 3.1 / GPT 5.2 / Kimi K2.5 / DeepSeek V3.2 / Doubao Seed 2.0 Pro）
配置方式详见 **[docs/MODELS.md](docs/MODELS.md)**。

---

## 目录结构

```
src/
├── app/
│   ├── api/chat/
│   │   ├── route.ts              # POST 入口，~180 行，负责流编排
│   │   └── tools/                # ★ 子 Agent 工具定义（每个工具独立文件）
│   │       ├── types.ts          #   ArtifactPayload / ToolOutput 类型
│   │       ├── designStageFile.ts
│   │       ├── writeStageFile.ts
│   │       ├── validateStageFile.ts
│   │       ├── generateVisualDesign.ts
│   │       └── index.ts          #   统一 re-export
│   ├── layout.tsx
│   └── page.tsx                  # 双栏布局 + 移动端 Tab 切换
├── components/
│   ├── chat/ChatArea.tsx         # 左侧对话区（消息渲染 + 工具状态徽章）
│   ├── artifacts/ArtifactArea.tsx# 右侧工件展示区（纯渲染，无业务逻辑）
│   └── setup/SetupSidebar.tsx    # 左侧文档上传面板 + 下载按钮
├── lib/
│   ├── agents/prompts.ts         # 5 个 Agent 的 System Prompt 常量
│   ├── llm/                      # ★ 多模型接入层
│   │   ├── providers.ts          #   客户端共享：模型元数据 + ModelId 类型
│   │   └── server.ts             #   服务端：createModel(modelId) 工厂
│   └── chat/
│       ├── memory.ts             # 消息规范化 + 分层内存提取
│       ├── toolArtifact.ts       # 从工具输出中提取 artifact
│       └── artifactParser.ts     # ★ 工件解析工具（类别、状态、摘要、报告解析）
├── components/chat/
│   └── ModelPicker.tsx           # ★ 模型切换下拉，集成在 ChatArea 顶部
└── store/
    ├── useArtifactStore.ts       # 工件 Zustand store（已接入 localStorage 持久化）
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
      → resolveModelId(header) → createModel()      # 服务端根据 ID 路由到对应供应商
      → normalizeMessages + buildMemoryContext（消息 > 8 条时）
      → streamText（Orchestrator 模型）
          → 工具调用 → tools/ 子文件 → subAgentModel.generateText()
          → 返回 { content, artifact }
  → UIMessageStream 流式返回
  → ChatArea（工具状态徽章）
  → getToolArtifact() 提取 artifact
  → useArtifactStore.addArtifact()  ← localStorage 自动持久化
  → ArtifactArea 自动渲染
```

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
npm test
```

测试文件放在对应源文件旁（`*.test.ts`）：
- `lib/chat/memory.test.ts` — 消息规范化、记忆上下文
- `lib/chat/toolArtifact.test.ts` — 工件提取
- `store/useArtifactStore.test.ts` — 工件 store（含持久化行为）
- `store/useSetupStore.test.ts` — 设置 store

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
| LLM Provider | 多模型（Gemini / GPT / Kimi / DeepSeek / Doubao） | 用户可按任务/预算/合规切换；详见 [docs/MODELS.md](docs/MODELS.md) |
| 多模型路由 | HTTP Header `x-model-id` + `createModel()` 工厂 | 客户端不接触 Key；TS 穷举检查防遗漏 |
| OpenAI 兼容协议 | Kimi / DeepSeek / Doubao 均复用 `@ai-sdk/openai` + baseURL | 无需额外依赖，新增兼容供应商极便利 |
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
1. `src/lib/llm/providers.ts` → `AVAILABLE_MODELS` 新增元数据
2. `src/lib/llm/server.ts` → `createModel` switch 新增 case
3. `.env.example` + `docs/MODELS.md` 同步更新

### 调试 LLM 调用
请求时带上 header `x-chat-debug: 1`，或设置 `CHAT_DEBUG=1` 环境变量，服务端会打印详细日志（包含 `modelId` 字段方便排查走错供应商）。

### 子 Agent 流式调用（应对 Kimi 等慢上游）
默认子 Agent 走 `generateText` + 60s/120s 墙钟。Kimi 在长 prompt 下首 token 慢、但持续吐字稳定，会触发 `[network_timeout]`。设置 `SUB_AGENT_USE_STREAMING=1` 切换到 `streamText` + chunkMs 空闲超时（40s/60s 无新 token 才 abort），单次 idle 重试，总墙钟提升到 90s/180s 兜底。逻辑集中在 [src/app/api/chat/tools/shared.ts](src/app/api/chat/tools/shared.ts)。

---

## 待办 / 已知限制

| 项目 | 状态 | 说明 |
|------|------|------|
| 即梦 CLI 接入 | 未完成 | 当前仅输出提示词文档，未调用真实出图 API |
| 会话隔离 | 未完成 | 多次策划的工件混在同一 store，建议后续引入 sessionId |
| 消息列表虚拟滚动 | 未完成 | 长会话时 DOM 节点堆积，可用 `@tanstack/virtual` |
| 长上下文处理 | 基础实现 | 超过 8 条消息才触发 LLM 记忆压缩，可改为基于 token 计数 |
