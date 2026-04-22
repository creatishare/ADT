import { expect, test } from "@playwright/test";

const selectors = {
  chatEmptyState: '[data-testid="chat-empty-state"]',
  chatInput: '[data-testid="chat-input"]',
  chatSendButton: '[data-testid="chat-send-button"]',
  chatMessageList: '[data-testid="chat-message-list"]',
  chatLoadingState: '[data-testid="chat-loading-state"]',
  chatRequestError: '[data-testid="chat-request-error"]',
  artifactEmptyState: '[data-testid="artifact-empty-state"]',
  artifactActiveTitle: '[data-testid="artifact-active-title"]',
  artifactSummaryCard: '[data-testid="artifact-summary-card"]',
  artifactContent: '[data-testid="artifact-content"]',
  artifactTabs: '[data-testid="artifact-tabs"]',
};

// ---------------------------------------------------------------------------
// Core workspace
// ---------------------------------------------------------------------------

test.describe("chat workspace", () => {
  test("loads homepage with empty states", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(selectors.chatEmptyState)).toBeVisible();
    await expect(page.locator(selectors.artifactEmptyState)).toBeVisible();
    await expect(page.locator(selectors.chatInput)).toBeVisible();
    await expect(page.locator(selectors.chatSendButton)).toBeDisabled();
  });

  test("sends message and syncs artifact in success scenario", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .locator(selectors.chatInput)
      .fill("请生成一个测试方案 [test-scenario:success]");
    await expect(page.locator(selectors.chatSendButton)).toBeEnabled();
    await page.locator(selectors.chatSendButton).click();

    await expect(page.locator(selectors.artifactActiveTitle)).toBeVisible({ timeout: 15000 });

    await expect(page.locator(selectors.chatMessageList)).toContainText(
      "稳定的测试工件"
    );
    await expect(page.locator(selectors.artifactActiveTitle)).toHaveText(
      "核心包装概念"
    );
    await expect(page.locator(selectors.artifactSummaryCard)).toContainText(
      "概念方案"
    );
    await expect(page.locator(selectors.artifactContent)).toContainText(
      "方案 A"
    );
  });

  test("renders tool error and allows retry flow", async ({ page }) => {
    await page.goto("/");

    await page
      .locator(selectors.chatInput)
      .fill("请触发失败 [test-scenario:tool-error]");
    await expect(page.locator(selectors.chatSendButton)).toBeEnabled();
    await page.locator(selectors.chatSendButton).click();

    await expect(page.locator(selectors.chatMessageList)).toContainText(
      "工具执行失败"
    );
    const retryButton = page.getByRole("button", { name: "重新生成本轮回复" });
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();
  });

  test("shows request-level error state", async ({ page }) => {
    await page.goto("/");

    await page
      .locator(selectors.chatInput)
      .fill("触发请求错误 [test-scenario:request-error]");
    await expect(page.locator(selectors.chatSendButton)).toBeEnabled();
    await page.locator(selectors.chatSendButton).click();

    await expect(page.locator(selectors.chatRequestError)).toBeVisible();
    await expect(page.locator(selectors.chatRequestError)).toContainText(
      "测试模式：请求级失败"
    );
    await expect(
      page.getByRole("button", { name: "重新生成上一轮回复" })
    ).toBeVisible();
  });

  test("shows approval-requested state", async ({ page }) => {
    await page.goto("/");

    await page
      .locator(selectors.chatInput)
      .fill("等待人工确认 [test-scenario:approval]");
    await expect(page.locator(selectors.chatSendButton)).toBeEnabled();
    await page.locator(selectors.chatSendButton).click();

    await expect(page.locator(selectors.chatMessageList)).toContainText(
      "等待确认"
    );
    await expect(page.locator(selectors.chatMessageList)).toContainText(
      "等待你确认后继续"
    );
  });
});

// ---------------------------------------------------------------------------
// Mobile tab switching
// ---------------------------------------------------------------------------

test.describe("mobile tab switching", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("shows chat tab by default on mobile", async ({ page }) => {
    await page.goto("/");

    // Chat pane must be visible
    await expect(page.locator(selectors.chatInput)).toBeVisible();
    // Artifact pane must not be visible on mobile at start
    await expect(page.locator(selectors.artifactEmptyState)).toBeHidden();
  });

  test("switches to artifact tab and back", async ({ page }) => {
    await page.goto("/");

    // Switch to artifact tab
    await page.getByRole("button", { name: /设计文档/ }).click();
    await expect(page.locator(selectors.artifactEmptyState)).toBeVisible();
    await expect(page.locator(selectors.chatInput)).toBeHidden();

    // Switch back to chat
    await page.getByRole("button", { name: "对话" }).click();
    await expect(page.locator(selectors.chatInput)).toBeVisible();
    await expect(page.locator(selectors.artifactEmptyState)).toBeHidden();
  });

  test("artifact tab badge shows count after generation", async ({ page }) => {
    await page.goto("/");

    await page
      .locator(selectors.chatInput)
      .fill("请生成 [test-scenario:success]");
    await page.locator(selectors.chatSendButton).click();
    await expect(page.locator(selectors.chatLoadingState)).toBeHidden();

    // Badge count should be visible on the tab button
    const artifactTabBtn = page.getByRole("button", { name: /设计文档/ });
    await expect(artifactTabBtn).toContainText("1");
  });
});

// ---------------------------------------------------------------------------
// Artifact markdown rendering
// ---------------------------------------------------------------------------

test.describe("artifact markdown rendering", () => {
  test("renders markdown headings and lists as HTML elements", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .locator(selectors.chatInput)
      .fill("请生成 [test-scenario:success]");
    await page.locator(selectors.chatSendButton).click();
    await expect(page.locator(selectors.artifactActiveTitle)).toBeVisible({ timeout: 15000 });

    const content = page.locator(selectors.artifactContent);

    // Headings must be rendered as <h1>/<h2>, not as raw "##" text
    await expect(content.locator("h1")).toBeVisible();
    await expect(content.locator("h2").first()).toBeVisible();

    // List items must be rendered as <li>, not as raw "- " text
    await expect(content.locator("li").first()).toBeVisible();

    // Raw markdown syntax must NOT appear as plain text
    await expect(content).not.toContainText("## 方案");
    await expect(content).not.toContainText("# 核心");
  });
});

// ---------------------------------------------------------------------------
// Artifact persistence (localStorage)
// ---------------------------------------------------------------------------

test.describe("artifact persistence", () => {
  test("artifacts survive page reload", async ({ page }) => {
    await page.goto("/");

    // Generate an artifact
    await page
      .locator(selectors.chatInput)
      .fill("生成工件 [test-scenario:success]");
    await page.locator(selectors.chatSendButton).click();
    await expect(page.locator(selectors.chatLoadingState)).toBeHidden();
    await expect(page.locator(selectors.artifactActiveTitle)).toBeVisible();

    // Reload the page
    await page.reload();

    // Artifact should still be present
    await expect(page.locator(selectors.artifactActiveTitle)).toHaveText(
      "核心包装概念"
    );
    await expect(page.locator(selectors.artifactContent)).toContainText(
      "方案 A"
    );
  });
});
