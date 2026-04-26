# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat-workspace.spec.ts >> mobile tab switching >> shows chat tab by default on mobile
- Location: tests/e2e/chat-workspace.spec.ts:122:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('[data-testid="chat-input"]')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[data-testid="chat-input"]')
    9 × locator resolved to <textarea rows="2" data-testid="chat-input" placeholder="描述你的关卡需求，或上传题组/知识点文档…" class="w-full resize-none bg-transparent text-sm leading-6 text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:outline-none"></textarea>
      - unexpected value "hidden"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e6]
        - generic [ref=e11]: Agent Designer
      - navigation [ref=e12]:
        - tablist "工作区视图切换" [ref=e13]:
          - tab "对话" [ref=e14]
          - tab "设计文档" [ref=e15]
      - generic [ref=e17]:
        - generic [ref=e19]: Gemini 3.1
        - img [ref=e20]
        - combobox "选择大模型" [ref=e22] [cursor=pointer]:
          - option "Gemini 3.1 — Google · 综合推理强" [selected]
          - option "GPT 5.2 — OpenAI · 代码与长文"
          - option "Kimi K2.5 — Moonshot · 中文长上下文"
          - option "DeepSeek V3.2 — DeepSeek · 成本敏感场景"
          - option "Doubao Seed 2.0 Pro — 字节火山引擎 · 国内直连"
    - generic [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e26]:
          - heading "策划准备" [level=3] [ref=e27]
          - button "折叠策划准备" [ref=e28]:
            - img [ref=e29]
        - generic [ref=e31]:
          - generic [ref=e32]:
            - generic [ref=e33]:
              - generic [ref=e34]:
                - img [ref=e35]
                - text: 策划会话
                - generic [ref=e38]: "1"
              - button "新建" [ref=e39]:
                - img [ref=e40]
                - text: 新建
            - list [ref=e41]:
              - listitem [ref=e42]:
                - button "新策划 04-24 17:28 04/24 17:28" [ref=e43]:
                  - paragraph [ref=e44]: 新策划 04-24 17:28
                  - paragraph [ref=e45]: 04/24 17:28
                - generic [ref=e46]:
                  - button "重命名" [ref=e47]:
                    - img [ref=e48]
                  - button "删除" [ref=e51]:
                    - img [ref=e52]
          - generic [ref=e55]:
            - generic [ref=e56]:
              - generic [ref=e57]: 阶段世界观文档
              - generic [ref=e58]: 上传整个阶段共用的剧情世界观
            - button "点击上传文档" [ref=e60]:
              - img [ref=e61]
              - text: 点击上传文档
          - generic [ref=e64]:
            - generic [ref=e65]:
              - generic [ref=e66]: 课节知识点文档
              - generic [ref=e67]: 上传当前课节的知识点整理
            - button "点击上传文档" [ref=e69]:
              - img [ref=e70]
              - text: 点击上传文档
          - button "开始策划" [disabled]
      - generic [ref=e74]:
        - generic [ref=e76]:
          - img [ref=e78]
          - heading "Agent Designer V2" [level=2] [ref=e82]
          - paragraph [ref=e83]: 我是你的主控 Orchestrator。你可以在左侧展开「策划准备」面板上传阶段世界观和课节知识点文档，或直接描述关卡需求开始设计流程。
        - generic [ref=e85]:
          - textbox "描述你的关卡需求，或上传题组/知识点文档…"
          - generic:
            - button "上传题目/知识点信息文档 (.txt, .md)" [ref=e87]:
              - img [ref=e88]
            - button "发送" [disabled] [ref=e90]:
              - img [ref=e91]
              - text: 发送
  - button "Open Next.js Dev Tools" [ref=e98] [cursor=pointer]:
    - img [ref=e99]
  - alert [ref=e102]
```

# Test source

```ts
  26  |   test("loads homepage with empty states", async ({ page }) => {
  27  |     await page.goto("/");
  28  | 
  29  |     await expect(page.locator(selectors.chatEmptyState)).toBeVisible();
  30  |     await expect(page.locator(selectors.artifactEmptyState)).toBeVisible();
  31  |     await expect(page.locator(selectors.chatInput)).toBeVisible();
  32  |     await expect(page.locator(selectors.chatSendButton)).toBeDisabled();
  33  |   });
  34  | 
  35  |   test("sends message and syncs artifact in success scenario", async ({
  36  |     page,
  37  |   }) => {
  38  |     await page.goto("/");
  39  | 
  40  |     await page
  41  |       .locator(selectors.chatInput)
  42  |       .fill("请生成一个测试方案 [test-scenario:success]");
  43  |     await expect(page.locator(selectors.chatSendButton)).toBeEnabled();
  44  |     await page.locator(selectors.chatSendButton).click();
  45  | 
  46  |     await expect(page.locator(selectors.artifactActiveTitle)).toBeVisible({ timeout: 15000 });
  47  | 
  48  |     await expect(page.locator(selectors.chatMessageList)).toContainText(
  49  |       "稳定的测试工件"
  50  |     );
  51  |     await expect(page.locator(selectors.artifactActiveTitle)).toHaveText(
  52  |       "核心包装概念"
  53  |     );
  54  |     await expect(page.locator(selectors.artifactSummaryCard)).toContainText(
  55  |       "概念方案"
  56  |     );
  57  |     await expect(page.locator(selectors.artifactContent)).toContainText(
  58  |       "方案 A"
  59  |     );
  60  |   });
  61  | 
  62  |   test("renders tool error and allows retry flow", async ({ page }) => {
  63  |     await page.goto("/");
  64  | 
  65  |     await page
  66  |       .locator(selectors.chatInput)
  67  |       .fill("请触发失败 [test-scenario:tool-error]");
  68  |     await expect(page.locator(selectors.chatSendButton)).toBeEnabled();
  69  |     await page.locator(selectors.chatSendButton).click();
  70  | 
  71  |     await expect(page.locator(selectors.chatMessageList)).toContainText(
  72  |       "工具执行失败"
  73  |     );
  74  |     const retryButton = page.getByRole("button", { name: "重新生成本轮回复" });
  75  |     await expect(retryButton).toBeVisible();
  76  |     await expect(retryButton).toBeEnabled();
  77  |   });
  78  | 
  79  |   test("shows request-level error state", async ({ page }) => {
  80  |     await page.goto("/");
  81  | 
  82  |     await page
  83  |       .locator(selectors.chatInput)
  84  |       .fill("触发请求错误 [test-scenario:request-error]");
  85  |     await expect(page.locator(selectors.chatSendButton)).toBeEnabled();
  86  |     await page.locator(selectors.chatSendButton).click();
  87  | 
  88  |     await expect(page.locator(selectors.chatRequestError)).toBeVisible();
  89  |     await expect(page.locator(selectors.chatRequestError)).toContainText(
  90  |       "测试模式：请求级失败"
  91  |     );
  92  |     await expect(
  93  |       page.getByRole("button", { name: "重新生成上一轮回复" })
  94  |     ).toBeVisible();
  95  |   });
  96  | 
  97  |   test("shows approval-requested state", async ({ page }) => {
  98  |     await page.goto("/");
  99  | 
  100 |     await page
  101 |       .locator(selectors.chatInput)
  102 |       .fill("等待人工确认 [test-scenario:approval]");
  103 |     await expect(page.locator(selectors.chatSendButton)).toBeEnabled();
  104 |     await page.locator(selectors.chatSendButton).click();
  105 | 
  106 |     await expect(page.locator(selectors.chatMessageList)).toContainText(
  107 |       "等待确认"
  108 |     );
  109 |     await expect(page.locator(selectors.chatMessageList)).toContainText(
  110 |       "等待你确认后继续"
  111 |     );
  112 |   });
  113 | });
  114 | 
  115 | // ---------------------------------------------------------------------------
  116 | // Mobile tab switching
  117 | // ---------------------------------------------------------------------------
  118 | 
  119 | test.describe("mobile tab switching", () => {
  120 |   test.use({ viewport: { width: 375, height: 812 } });
  121 | 
  122 |   test("shows chat tab by default on mobile", async ({ page }) => {
  123 |     await page.goto("/");
  124 | 
  125 |     // Chat pane must be visible
> 126 |     await expect(page.locator(selectors.chatInput)).toBeVisible();
      |                                                     ^ Error: expect(locator).toBeVisible() failed
  127 |     // Artifact pane must not be visible on mobile at start
  128 |     await expect(page.locator(selectors.artifactEmptyState)).toBeHidden();
  129 |   });
  130 | 
  131 |   test("switches to artifact tab and back", async ({ page }) => {
  132 |     await page.goto("/");
  133 | 
  134 |     // Switch to artifact tab
  135 |     await page.getByRole("button", { name: /设计文档/ }).click();
  136 |     await expect(page.locator(selectors.artifactEmptyState)).toBeVisible();
  137 |     await expect(page.locator(selectors.chatInput)).toBeHidden();
  138 | 
  139 |     // Switch back to chat
  140 |     await page.getByRole("button", { name: "对话" }).click();
  141 |     await expect(page.locator(selectors.chatInput)).toBeVisible();
  142 |     await expect(page.locator(selectors.artifactEmptyState)).toBeHidden();
  143 |   });
  144 | 
  145 |   test("artifact tab badge shows count after generation", async ({ page }) => {
  146 |     await page.goto("/");
  147 | 
  148 |     await page
  149 |       .locator(selectors.chatInput)
  150 |       .fill("请生成 [test-scenario:success]");
  151 |     await page.locator(selectors.chatSendButton).click();
  152 |     await expect(page.locator(selectors.chatLoadingState)).toBeHidden();
  153 | 
  154 |     // Badge count should be visible on the tab button
  155 |     const artifactTabBtn = page.getByRole("button", { name: /设计文档/ });
  156 |     await expect(artifactTabBtn).toContainText("1");
  157 |   });
  158 | });
  159 | 
  160 | // ---------------------------------------------------------------------------
  161 | // Artifact markdown rendering
  162 | // ---------------------------------------------------------------------------
  163 | 
  164 | test.describe("artifact markdown rendering", () => {
  165 |   test("renders markdown headings and lists as HTML elements", async ({
  166 |     page,
  167 |   }) => {
  168 |     await page.goto("/");
  169 | 
  170 |     await page
  171 |       .locator(selectors.chatInput)
  172 |       .fill("请生成 [test-scenario:success]");
  173 |     await page.locator(selectors.chatSendButton).click();
  174 |     await expect(page.locator(selectors.artifactActiveTitle)).toBeVisible({ timeout: 15000 });
  175 | 
  176 |     const content = page.locator(selectors.artifactContent);
  177 | 
  178 |     // Headings must be rendered as <h1>/<h2>, not as raw "##" text
  179 |     await expect(content.locator("h1")).toBeVisible();
  180 |     await expect(content.locator("h2").first()).toBeVisible();
  181 | 
  182 |     // List items must be rendered as <li>, not as raw "- " text
  183 |     await expect(content.locator("li").first()).toBeVisible();
  184 | 
  185 |     // Raw markdown syntax must NOT appear as plain text
  186 |     await expect(content).not.toContainText("## 方案");
  187 |     await expect(content).not.toContainText("# 核心");
  188 |   });
  189 | });
  190 | 
  191 | // ---------------------------------------------------------------------------
  192 | // Artifact persistence (localStorage)
  193 | // ---------------------------------------------------------------------------
  194 | 
  195 | test.describe("artifact persistence", () => {
  196 |   test("artifacts survive page reload", async ({ page }) => {
  197 |     await page.goto("/");
  198 | 
  199 |     // Generate an artifact
  200 |     await page
  201 |       .locator(selectors.chatInput)
  202 |       .fill("生成工件 [test-scenario:success]");
  203 |     await page.locator(selectors.chatSendButton).click();
  204 |     await expect(page.locator(selectors.chatLoadingState)).toBeHidden();
  205 |     await expect(page.locator(selectors.artifactActiveTitle)).toBeVisible();
  206 | 
  207 |     // Reload the page
  208 |     await page.reload();
  209 | 
  210 |     // Artifact should still be present
  211 |     await expect(page.locator(selectors.artifactActiveTitle)).toHaveText(
  212 |       "核心包装概念"
  213 |     );
  214 |     await expect(page.locator(selectors.artifactContent)).toContainText(
  215 |       "方案 A"
  216 |     );
  217 |   });
  218 | });
  219 | 
  220 | // ---------------------------------------------------------------------------
  221 | // Multi-session conversation persistence
  222 | // ---------------------------------------------------------------------------
  223 | 
  224 | test.describe("conversation persistence and sessions", () => {
  225 |   test("chat messages survive mid-session reload", async ({ page }) => {
  226 |     await page.goto("/");
```