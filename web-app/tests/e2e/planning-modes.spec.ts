import { expect, test } from "@playwright/test";

/**
 * Phase 4 · 三种策划模式的 E2E 覆盖
 *
 * 1. SetupSidebar 模式切换 UI（纯前端状态机，无网络依赖）：
 *    - 切换 ModeSelector 后激活态正确
 *    - single-group 模式下出现 GroupPicker，integration 模式下出现 STEP 03 上传卡
 *    - 默认 standard 模式两者都不显示
 *
 * 2. test-mode mock 工件（通过 [test-scenario:*] marker 触发）：
 *    - single-group-success 工件不含"前置/后置剧情衔接"
 *    - integration-success 工件含"用户原始壳子对照表"
 */

const selectors = {
  chatInput: '[data-testid="chat-input"]',
  chatSendButton: '[data-testid="chat-send-button"]',
  artifactActiveTitle: '[data-testid="artifact-active-title"]',
  artifactContent: '[data-testid="artifact-content"]',
  modeSelector: '[data-testid="mode-selector"]',
  modeOptionStandard: '[data-testid="mode-option-standard"]',
  modeOptionSingleGroup: '[data-testid="mode-option-single-group"]',
  modeOptionIntegration: '[data-testid="mode-option-integration"]',
  modeHint: '[data-testid="mode-hint"]',
  groupPicker: '[data-testid="group-picker"]',
  shellUploadSlot: '[data-testid="shell-upload-slot"]',
  startPlanningButton: '[data-testid="start-planning-button"]',
};

// ---------------------------------------------------------------------------
// SetupSidebar mode switching
// ---------------------------------------------------------------------------

test.describe("planning mode selector", () => {
  test("defaults to standard and hides single-group / integration extras", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator(selectors.modeSelector)).toBeVisible();
    await expect(page.locator(selectors.modeOptionStandard)).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator(selectors.modeOptionSingleGroup)).toHaveAttribute(
      "aria-selected",
      "false"
    );
    await expect(page.locator(selectors.modeOptionIntegration)).toHaveAttribute(
      "aria-selected",
      "false"
    );

    // No GroupPicker / shell upload in standard mode
    await expect(page.locator(selectors.groupPicker)).toBeHidden();
    await expect(page.locator(selectors.shellUploadSlot)).toBeHidden();
  });

  test("switching to single-group reveals the group picker", async ({ page }) => {
    await page.goto("/");

    await page.locator(selectors.modeOptionSingleGroup).click();

    await expect(page.locator(selectors.modeOptionSingleGroup)).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator(selectors.groupPicker)).toBeVisible();
    await expect(page.locator(selectors.shellUploadSlot)).toBeHidden();

    // Hint text reflects the active mode (single-group hint mentions skipping group loop)
    await expect(page.locator(selectors.modeHint)).toContainText("跳过");
  });

  test("switching to integration reveals the shell upload card", async ({
    page,
  }) => {
    await page.goto("/");

    await page.locator(selectors.modeOptionIntegration).click();

    await expect(page.locator(selectors.modeOptionIntegration)).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator(selectors.shellUploadSlot)).toBeVisible();
    await expect(page.locator(selectors.groupPicker)).toBeHidden();

    await expect(page.locator(selectors.modeHint)).toContainText("壳子");
  });

  test("start button stays disabled until prerequisites for the active mode are met", async ({
    page,
  }) => {
    await page.goto("/");

    // Standard mode: disabled because both docs are missing
    await expect(page.locator(selectors.startPlanningButton)).toBeDisabled();

    // Single-group mode: also disabled (extra requirement: a selected group)
    await page.locator(selectors.modeOptionSingleGroup).click();
    await expect(page.locator(selectors.startPlanningButton)).toBeDisabled();

    // Integration mode: also disabled (extra requirement: shell doc)
    await page.locator(selectors.modeOptionIntegration).click();
    await expect(page.locator(selectors.startPlanningButton)).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// New mock scenarios via [test-scenario:*] marker
// ---------------------------------------------------------------------------

test.describe("test-mode mock scenarios", () => {
  test("single-group-success returns a doc without storyline-bridge sections", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .locator(selectors.chatInput)
      .fill("生成单题组文档 [test-scenario:single-group-success]");
    await page.locator(selectors.chatSendButton).click();

    await expect(page.locator(selectors.artifactActiveTitle)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator(selectors.artifactActiveTitle)).toHaveText(
      "关卡设计介绍文档"
    );

    const content = page.locator(selectors.artifactContent);
    // Hard guarantee: no storyline bridge segments in single-group output
    await expect(content).not.toContainText("前置剧情衔接");
    await expect(content).not.toContainText("后置剧情衔接");
    // Sanity: still contains the regular sections
    await expect(content).toContainText("代码与舞台效果映射");
    await expect(content).toContainText("可替换效果类型表");
  });

  test("integration-success returns a doc starting with the original-shell table", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .locator(selectors.chatInput)
      .fill("整合用户壳子 [test-scenario:integration-success]");
    await page.locator(selectors.chatSendButton).click();

    await expect(page.locator(selectors.artifactActiveTitle)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator(selectors.artifactActiveTitle)).toHaveText(
      "关卡设计介绍文档"
    );

    const content = page.locator(selectors.artifactContent);
    // Hard guarantee: integration mode adds the shell comparison table
    await expect(content).toContainText("用户原始壳子对照表");
    await expect(content).toContainText("玩法本质是否保留");
    // Sanity: standard sections are still present
    await expect(content).toContainText("关卡设计总览表");
    // Storyline bridge segments are kept in integration mode (cross-group flow)
    await expect(content).toContainText("前置剧情衔接");
  });
});
