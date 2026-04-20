# Agent Designer V2 Web App

基于 Next.js + Vercel AI SDK 的多智能体关卡设计 Web 应用，采用 `Chat + Artifacts` 双栏布局。左侧负责与 Orchestrator 对话，右侧展示概念方案、验证报告、设计文档和视觉提示词等工件。

## 已实现能力

- 主控 Orchestrator 通过 `/api/chat` 调度 4 个子工具
- 支持 `关卡策划`、`验证`、`文档编写`、`视觉提示词生成`
- 支持上传 `.md/.txt/.json/.csv` 文件作为上下文
- 工具结果自动同步到右侧工件区
- 支持 Markdown 渲染、图片预览、代码块展示
- 已适配当前 `ai` / `@ai-sdk/react` 版本接口

## 本地启动

```bash
npm install
npm run dev
```

启动后访问 `http://localhost:3000`。

## 环境变量

在 `web-app/.env.local` 中配置：

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key
GOOGLE_GENERATIVE_AI_MODEL=gemini-2.5-flash
# 可选：如果你通过 Google-compatible 代理访问，再设置下面这个
# GOOGLE_GENERATIVE_AI_BASE_URL=https://your-provider.example.com/v1beta
```

说明：当前项目通过 `@ai-sdk/google` 直接访问 Google AI / Gemini，也支持通过兼容 Google Generative AI 的代理转发。

## 关键目录

```text
src/app/api/chat/route.ts        # Orchestrator API 与工具编排
src/components/chat/ChatArea.tsx # 对话区与工具状态展示
src/components/artifacts/ArtifactArea.tsx # 工件查看区
src/lib/agents/prompts.ts        # 4 个子 Agent Prompt
src/store/useArtifactStore.ts    # 工件状态管理
```

## 当前限制

- Dreamina CLI 还未真正接入，当前输出的是提示词文档
- 测试文件尚未补齐
- 长上下文裁剪与长期记忆沉淀尚未实现

## 下一步

- 补最小测试集
- 完善 README 与环境配置说明
- 接入真实图片生成链路
- 增加长上下文与记忆管理机制
