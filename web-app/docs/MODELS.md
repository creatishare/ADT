# 多模型配置指南

本项目支持在前端自由切换 5 个主流大模型。
UI 入口：**左侧对话区顶部的"Orchestrator"条 → 点击右侧的模型徽章下拉选择**。

选中状态会持久化到浏览器 `localStorage`，刷新页面后保持不变。

---

## 支持的模型一览

| UI ID | 显示名 | 供应商 | API 协议 | 需要的环境变量 |
|-------|--------|--------|---------|---------------|
| `gemini-3.1` | Gemini 3.1 | Google | Google 原生 | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `gpt-5-4` | GPT 5-4 | OpenAI | OpenAI 原生 | `OPENAI_API_KEY` |
| `kimi-k2.6` | Kimi K2.6 | Moonshot | OpenAI 兼容 | `MOONSHOT_API_KEY` |
| `deepseek-v4-pro` | DeepSeek V4 Pro | DeepSeek | OpenAI 兼容 | `DEEPSEEK_API_KEY` |
| `doubao-seed-2.0-pro` | Doubao Seed 2.0 Pro | 字节火山引擎 | OpenAI 兼容 | `DOUBAO_API_KEY` |

> ⚠️ 表格中的模型 ID 可能领先于实际发布版本。每个供应商都额外支持 `*_MODEL` 环境变量覆盖，
> 若线上还没有对应版本，填入当前可用的 stable 版本即可（见下文每节说明）。

---

## 通用流程

1. 复制 `.env.example` 为 `.env.local`
2. 按本页说明填入想要启用的模型 Key
3. 在 UI 顶部模型徽章里切换模型
4. 如果切换到未配置 Key 的模型，会看到：
   > 当前选择的模型 "xxx" 缺少 API Key。请在 .env.local 中配置 XXX_API_KEY…

   回到配置填入对应 Key 后重启 `npm run dev` 即可。

> 💡 所有 `*_BASE_URL` 和 `*_MODEL` 环境变量都是可选的，只有在需要走代理或覆盖默认值时才配置。

---

## 1. Google Gemini（gemini-3.1）

### 申请 API Key
- 控制台：<https://aistudio.google.com/app/apikey>
- 免费额度有，走 Google 官方 endpoint 直连时可能需要科学上网。

### 必填
```env
GOOGLE_GENERATIVE_AI_API_KEY="AIzaSy..."
```

### 可选
```env
# 走国内 Gemini 代理（OpenAI 兼容格式的代理不适用，这里需要 Gemini 原生协议代理）
GOOGLE_GENERATIVE_AI_BASE_URL="https://your-proxy.example.com/v1beta"

# 覆盖实际调用的模型名
# 例如 Gemini 3.1 尚未开放时回退到 2.5 Flash：
GOOGLE_GENERATIVE_AI_MODEL="gemini-2.5-flash"
```

### 常见问题
- **连接超时**：配置 `GOOGLE_GENERATIVE_AI_BASE_URL` 走国内可达代理。
- **404 模型不存在**：用 `GOOGLE_GENERATIVE_AI_MODEL` 改成当前可用的模型名。

---

## 2. OpenAI GPT（gpt-5-4）

### 申请 API Key
- 控制台：<https://platform.openai.com/api-keys>
- 需要绑定支付方式激活。

### 必填
```env
OPENAI_API_KEY="sk-proj-..."
```

### 可选
```env
# 走第三方中转或自建兼容代理
OPENAI_BASE_URL="https://api.openai.com/v1"

# 覆盖模型名。GPT 5.2 未发布前可先用 gpt-4o / gpt-4.1
OPENAI_MODEL="gpt-4o"
```

### 常见问题
- **429 rate limit**：首次充值账户的 TPM/RPM 比较低，等级别提升后消失。
- **model_not_found**：降级 `OPENAI_MODEL` 到当前账号已授权的模型。

---

## 3. Moonshot Kimi（kimi-k2.6）

### 申请 API Key
- 控制台：<https://platform.moonshot.cn/console/api-keys>
- 国内直连，无需代理。

### 必填
```env
MOONSHOT_API_KEY="sk-..."
```

### 可选
```env
MOONSHOT_BASE_URL="https://api.moonshot.cn/v1"
# Kimi K2.5 未上线前可用：moonshot-v1-128k / moonshot-v1-32k
MOONSHOT_MODEL="moonshot-v1-128k"
```

### 特性
- 长上下文优势明显（128K/256K/1M tokens）。
- OpenAI 兼容，我们直接用 `@ai-sdk/openai` + 自定义 `baseURL` 调用。

---

## 4. DeepSeek V4 Pro

### 申请 API Key
- 控制台：<https://platform.deepseek.com/api_keys>
- 国内直连，API 价格极低。

### 必填
```env
DEEPSEEK_API_KEY="sk-..."
```

### 可选
```env
DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
# 官方可用模型：deepseek-chat (V3 系列) / deepseek-reasoner (R1 推理)
DEEPSEEK_MODEL="deepseek-chat"
```

### 选型建议
- 本项目默认 `deepseek-chat`，适合 Orchestrator 和子 Agent 的结构化输出。
- 若想提高策划创意深度可改为 `deepseek-reasoner`，延迟会显著增加。

---

## 5. Doubao Seed 2.0 Pro（字节火山引擎）

### 申请 API Key
- 控制台：<https://console.volcengine.com/ark>
- 步骤：
  1. 在火山引擎开通"方舟"（Ark）服务
  2. 创建 API Key（注意：不是 AccessKey，而是 Ark 专用的 Bearer API Key）
  3. 在"在线推理"里创建模型接入点（Endpoint ID），或直接使用公共模型名

### 必填
```env
DOUBAO_API_KEY="your-ark-api-key"
```

### 可选
```env
DOUBAO_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"

# 两种填法任选其一：
#   A) 公共模型名（推荐，便于切换版本）
DOUBAO_MODEL="doubao-seed-2.0-pro"
#   B) 自建推理接入点 ID
# DOUBAO_MODEL="ep-20250101123456-xxxxx"
```

### 常见问题
- **401 Unauthorized**：确认使用的是 Ark API Key，而非 AccessKey/SecretKey。
- **model_not_found**：Doubao 版本更新较快，改为当前在火山控制台看到的公共模型名或创建接入点 ID。
- **区域问题**：默认走北京区，如需华东/华南区域更换 `DOUBAO_BASE_URL`。

---

## 开发者：如何新增一个模型

1. 在 [`src/lib/llm/providers.ts`](../src/lib/llm/providers.ts) 的 `AVAILABLE_MODELS` 数组新增一项：
   ```ts
   {
     id: "your-model-id",
     label: "Your Model",
     hint: "供应商 · 一句话定位",
     provider: "openai", // 或新增一个 provider 类型
   }
   ```

2. 在 [`src/lib/llm/server.ts`](../src/lib/llm/server.ts) 的 `createModel` switch 中添加对应 case：
   ```ts
   case "your-model-id": {
     const provider = createOpenAI({
       apiKey: requireEnv("YOUR_API_KEY", modelId),
       baseURL: process.env.YOUR_BASE_URL || "https://...",
     });
     return provider(process.env.YOUR_MODEL || "default-model-name");
   }
   ```

3. 在 `.env.example` 对应位置新增注释示例。

4. 在本文件（`docs/MODELS.md`）加一节申请说明。

由于 `ModelId` 是通过 `as const` 推导出的联合类型，上面 1-2 步中 TypeScript 的穷举检查会
自动提示所有需要补齐的地方。

---

## 架构备注

- **客户端**只关心 `AVAILABLE_MODELS` 的元数据（id / label / hint / provider），不会接触到任何 API Key。
- **服务端** `createModel(modelId)` 是唯一读取 `process.env` 的入口。
- 请求时通过 HTTP 头 `x-model-id` 传递当前选中模型，未传或非法值会自动回退到 `DEFAULT_MODEL_ID`。
- 鉴权失败、Key 缺失等错误统一在 `getProviderFailureMessage()` 中转换为友好中文提示。
