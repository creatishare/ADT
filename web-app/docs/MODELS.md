# 多模型配置指南

本项目所有模型统一通过公司 AI 网关（`hetao gateway`）调用，遵守"政策要求统一使用公司给的 API"的内部规定。
UI 入口：**左侧对话区顶部的"Orchestrator"条 → 点击右侧的模型徽章下拉选择**。

选中状态会持久化到浏览器 `localStorage`，刷新页面后保持不变。

---

## 支持的模型一览

| UI ID | 显示名 | 上游模型别名（发给网关的 `model` 字段） |
|-------|--------|----------------------------------------|
| `deepseek-v4-flash` | DeepSeek V4 Flash | `ali.public.deepseek-v4-flash` |
| `deepseek-v4-flash-free` | DeepSeek V4 Flash (免费) | `ht.local.deepseek-v4-flash` |
| `deepseek-v4-pro` | DeepSeek V4 Pro | `ali.public.deepseek-v4-pro` |
| `qwen3.6-flash` | Qwen 3.6 Flash | `qwen3.6-flash` |
| `gpt-5.4-mini` | GPT 5.4 Mini | `gpt-5.4-mini` |
| `gpt-5.5` | GPT 5.5 | `gpt-5.5` |

> 所有模型共用同一个网关、同一把 API Key。换模型只是修改请求体里的 `model` 字段，
> 不会触发供应商切换或 baseURL 变化。
>
> 带 "(免费)" 后缀的 `deepseek-v4-flash-free` 走公司本地中转通道 (`ht.local.*`)，
> 适合大量低优先级调用；正式生产建议用 `ali.public.*` 系列以获得 SLA 保障。

---

## 通用流程

1. 复制 `.env.example` 为 `.env.local`
2. 在 `HETAO_GATEWAY_API_KEY`（或多把 Key 的 `HETAO_GATEWAY_API_KEYS`）里填入公司签发的 Key
3. `npm run dev` 启动，UI 顶部模型徽章里随时切换模型
4. 如果 Key 缺失或失效，UI 会显示：
   > 当前选择的模型 "xxx" 缺少 API Key。请在 .env.local 中配置 HETAO_GATEWAY_API_KEYS…

> 💡 `HETAO_GATEWAY_BASE_URL`、`HETAO_MODEL_*` 等其他环境变量都是可选的，
> 只在公司变更网关地址、或某个上游别名升级时才需要配置。

---

## 必填环境变量

```env
# 一把 Key（最简单）
HETAO_GATEWAY_API_KEY="your-hetao-gateway-key"

# 或多把 Key 用逗号分隔，服务端按轮询分发（适合多人并发场景）
HETAO_GATEWAY_API_KEYS="key-1,key-2,key-3"
```

---

## 可选环境变量

### 1. 切换网关地址

```env
# 默认值：https://ai-gateway.corp.hetao101.com
HETAO_GATEWAY_BASE_URL="https://ai-gateway.corp.hetao101.com"
```

### 2. 覆盖某个 UI 模型对应的上游别名

命名规则：`HETAO_MODEL_<UI_ID 转大写，非字母数字替换为下划线>`

```env
HETAO_MODEL_DEEPSEEK_V4_FLASH="ali.public.deepseek-v4-flash-2026q2"
HETAO_MODEL_DEEPSEEK_V4_FLASH_FREE="ht.local.deepseek-v4-flash-v2"
HETAO_MODEL_DEEPSEEK_V4_PRO="ali.public.deepseek-v4-pro-2026q2"
HETAO_MODEL_QWEN3_6_FLASH="qwen3.7-flash"
HETAO_MODEL_GPT_5_4_MINI="gpt-5.4-mini-2026q2"
HETAO_MODEL_GPT_5_5="gpt-5.5-2026q2"
```

### 3. 并发限流（默认关闭）

公司网关在网关侧已经做了限流，客户端**默认不再加二层限流**——
之前的 "Key 池大小 × 3" 公式在单 Key 场景下会让 Orchestrator 与子 Agent 抢同一个名额，
高并发时直接自死锁，所以现在改成 **opt-in** 模式：

```env
# 默认：完全不限制。下面两个变量任何一个都不要设。

# 直接指定 hetao 网关的并发上限（优先级最高）
LLM_CONCURRENCY_HETAO=20

# 或：「每把 Key 容量 × Key 池大小 = 总容量」公式
LLM_PER_KEY_CONCURRENCY=5
```

> ⚠️ 启用时务必保证 **容量 ≥ 同时在线用户数 × (1 + 子 Agent 数)**，
> 否则 Orchestrator 流持有 slot 阻塞子 Agent，会再次出现死锁。

---

## 开发者：如何新增一个模型

1. 在 [`src/lib/llm/providers.ts`](../src/lib/llm/providers.ts) 的 `AVAILABLE_MODELS` 数组新增一项：
   ```ts
   {
     id: "your-model-id",
     label: "Your Model",
     hint: "公司网关 · 一句话定位",
     provider: "hetao",
   }
   ```

2. 在 [`src/lib/llm/server.ts`](../src/lib/llm/server.ts) 的 `UPSTREAM_MODEL_NAME` map 中加映射：
   ```ts
   const UPSTREAM_MODEL_NAME: Record<ModelId, string> = {
     // ...
     "your-model-id": "gateway.actual.upstream-alias",
   };
   ```

3. 如需运行时覆盖该模型的上游别名，使用 `HETAO_MODEL_<UI_ID>` 环境变量即可，无需改代码。

由于 `ModelId` 是通过 `as const` 推导出的联合类型，上面两步中 TypeScript 的穷举检查会
自动提示遗漏的位置。

---

## 架构备注

- **客户端**只关心 `AVAILABLE_MODELS` 的元数据（id / label / hint / provider），不会接触到任何 API Key。
- **服务端** `createModel(modelId)` 是唯一读取 `process.env` 的入口，所有模型统一走 OpenAI 兼容协议 + 公司网关。
- 请求时通过 HTTP 头 `x-model-id` 传递当前选中模型，未传或非法值会自动回退到 `DEFAULT_MODEL_ID`。
- 鉴权失败、Key 缺失等错误统一在 `getProviderFailureMessage()` 中转换为友好中文提示。
- 想接入除公司网关外的供应商？目前出于合规原因不支持。若策略放开，需要在 `ProviderId` 联合类型中新增成员，并同步更新 `keyPool`/`gate`/`server` 的 `Record<ProviderId, …>` 表。
