/**
 * Annotation E2E Test Helpers
 *
 * Provides helper functions for interacting with the annotation editor
 * in Playwright E2E tests.
 */

import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Selection tool types available in the annotation editor.
 */
export type SelectionToolType =
  | 'cursor'
  | 'brush'
  | 'rectangle'
  | 'block'
  | 'word'
  | 'column'
  | 'row'
  | 'url';

/**
 * Selection data returned from the annotation editor.
 */
export interface SelectionData {
  id: string;
  text: string;
  label: string;
  xpath: string;
  charStart: number;
  charEnd: number;
  prefix?: string;
  suffix?: string;
  contextSize?: number;
  isUnique?: boolean;
  isImage?: boolean;
  imageSrc?: string;
  globalCharStart?: number;
  globalCharEnd?: number;
}

/**
 * Completes first-time setup if no users exist.
 * Creates the initial admin account.
 *
 * @param page - Playwright page instance
 * @param username - Admin username to create
 * @param email - Admin email
 * @param password - Admin password
 */
export async function completeFirstTimeSetup(
  page: Page,
  username = 'admin',
  email = 'admin@test.local',
  password = 'admin123456'
): Promise<void> {
  // Check if we're on the setup page
  if (!page.url().includes('/setup')) {
    await page.goto('/setup');
  }

  // Wait for the setup form
  await page.waitForSelector('input');

  // Fill in the admin account details
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password').fill(password);

  // Submit the form
  await page.getByRole('button', { name: 'Create Admin Account' }).click();

  // Wait for success or redirect to login
  await page.waitForURL(/\/login/, { timeout: 10000 });
}

/**
 * Logs in to the application using test credentials.
 * Handles first-time setup if no users exist.
 *
 * @param page - Playwright page instance
 * @param username - Username to log in with (defaults to test user)
 * @param password - Password to use (defaults to test password)
 */
export async function login(
  page: Page,
  username = 'admin',
  password = 'admin123456'
): Promise<void> {
  await page.goto('/login');

  // Wait for page load and check where we ended up
  await page.waitForLoadState('networkidle');

  // Check if redirected to setup (no users exist)
  if (page.url().includes('/setup')) {
    await completeFirstTimeSetup(page, username, 'admin@test.local', password);
    // After setup, navigate to login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  }

  // Now we should be on the login page
  // Wait for the login form (Mantine form with label-based inputs)
  await page.waitForSelector('input');

  // Fill in credentials using label-based selectors
  // The app uses "identifier" field for username/email
  await page.getByLabel('Username or Email').fill(username);
  await page.getByLabel('Password').fill(password);

  // Submit the form
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for redirect to home or dashboard
  await page.waitForURL(/^\/$|\/dashboard|\/annotation/, { timeout: 10000 });
}

/**
 * Navigates to an annotation page by ID.
 *
 * @param page - Playwright page instance
 * @param pageId - ID of the annotation page
 */
export async function openAnnotationPage(page: Page, pageId: string): Promise<void> {
  await page.goto(`/annotation/${pageId}`);
  await waitForAnnotationReady(page);
}

/**
 * Waits for the annotation page to be fully loaded and ready.
 *
 * @param page - Playwright page instance
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForAnnotationReady(page: Page, timeout = 30000): Promise<void> {
  // Wait for the page heading to appear
  await page.waitForSelector('text=Annotate Page', { timeout });

  // Wait for the iframe to be present (no data-testid, just iframe)
  await page.waitForSelector('iframe', { timeout });

  // Wait for the Page View tab to be visible
  await page.waitForSelector('text=Page View', { timeout });
}

/**
 * Gets the page view iframe element.
 *
 * @param page - Playwright page instance
 * @returns The iframe locator
 */
export function getPageViewIframe(page: Page): Locator {
  return page.locator('iframe');
}

/**
 * Gets the content document of the page view iframe.
 *
 * @param page - Playwright page instance
 * @returns The frame locator for the iframe content
 */
export async function getPageViewFrame(page: Page): Promise<Locator> {
  const iframe = getPageViewIframe(page);
  await iframe.waitFor({ state: 'attached' });

  const frame = page.frameLocator('iframe');
  return frame.locator('body');
}

/**
 * Selects text within the page view iframe.
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector for the element containing the text
 * @param startOffset - Character offset to start selection
 * @param endOffset - Character offset to end selection
 */
export async function selectTextInPageView(
  page: Page,
  selector: string,
  startOffset: number,
  endOffset: number
): Promise<void> {
  const frame = page.frameLocator('iframe');

  // Execute selection in the iframe
  await frame.locator(selector).evaluate(
    (element: Element, { start, end }: { start: number; end: number }) => {
      const range = document.createRange();
      const textNode = element.firstChild;

      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        range.setStart(textNode, start);
        range.setEnd(textNode, end);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        // Dispatch mouseup to trigger selection handling
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      }
    },
    { start: startOffset, end: endOffset }
  );
}

/**
 * Clicks on an element within the page view iframe.
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector for the element to click
 */
export async function clickInPageView(page: Page, selector: string): Promise<void> {
  const frame = page.frameLocator('iframe');
  await frame.locator(selector).click();
}

/**
 * Gets the current selections from the annotation editor.
 *
 * @param page - Playwright page instance
 * @returns Array of selection data
 */
export async function getSelections(page: Page): Promise<SelectionData[]> {
  return page.evaluate(() => {
    // Access the React component state via window or data attribute
    const selectionsElement = document.querySelector('[data-selections]');
    if (selectionsElement) {
      const data = selectionsElement.getAttribute('data-selections');
      return data ? (JSON.parse(data) as SelectionData[]) : [];
    }
    return [];
  });
}

/**
 * Gets the selection count from the UI.
 *
 * @param page - Playwright page instance
 * @returns Number of current selections
 */
export async function getSelectionCount(page: Page): Promise<number> {
  const countElement = page.locator('[data-testid="selection-count"]');
  const text = await countElement.textContent();
  return parseInt(text ?? '0', 10);
}

/**
 * Sets the active selection tool.
 *
 * @param page - Playwright page instance
 * @param tool - The tool to activate
 */
export async function setSelectionTool(page: Page, tool: SelectionToolType): Promise<void> {
  const toolButton = page.locator(`[data-testid="tool-${tool}"]`);
  await toolButton.click();

  // Wait for tool to be activated
  await expect(toolButton).toHaveAttribute('data-active', 'true');
}

/**
 * Gets the currently active selection tool.
 *
 * @param page - Playwright page instance
 * @returns The active tool type
 */
export async function getActiveSelectionTool(page: Page): Promise<SelectionToolType | null> {
  const activeTool = page.locator('[data-testid^="tool-"][data-active="true"]');
  const testId = await activeTool.getAttribute('data-testid');

  if (testId) {
    return testId.replace('tool-', '') as SelectionToolType;
  }
  return null;
}

/**
 * Adds a label to the current selection.
 *
 * @param page - Playwright page instance
 * @param label - The label to apply
 */
export async function addLabel(page: Page, label: string): Promise<void> {
  const labelButton = page.locator(`[data-testid="label-${label}"]`);
  await labelButton.click();
}

/**
 * Saves the current annotations.
 *
 * @param page - Playwright page instance
 */
export async function saveAnnotations(page: Page): Promise<void> {
  const saveButton = page.locator('[data-testid="save-annotations"]');
  await saveButton.click();

  // Wait for save to complete
  await page.waitForFunction(
    () => !document.querySelector('[data-saving="true"]'),
    { timeout: 10000 }
  );
}

/**
 * Clears all selections.
 *
 * @param page - Playwright page instance
 */
export async function clearSelections(page: Page): Promise<void> {
  const clearButton = page.locator('[data-testid="clear-selections"]');
  await clearButton.click();
}

/**
 * Performs undo action.
 *
 * @param page - Playwright page instance
 */
export async function undo(page: Page): Promise<void> {
  await page.keyboard.press('Meta+z');
}

/**
 * Performs redo action.
 *
 * @param page - Playwright page instance
 */
export async function redo(page: Page): Promise<void> {
  await page.keyboard.press('Meta+Shift+z');
}

/**
 * Waits for a specific number of selections to be present.
 *
 * @param page - Playwright page instance
 * @param count - Expected number of selections
 * @param timeout - Maximum time to wait in milliseconds
 */
export async function waitForSelectionCount(
  page: Page,
  count: number,
  timeout = 5000
): Promise<void> {
  await page.waitForFunction(
    (expectedCount: number) => {
      const element = document.querySelector('[data-testid="selection-count"]');
      const currentCount = parseInt(element?.textContent ?? '0', 10);
      return currentCount === expectedCount;
    },
    count,
    { timeout }
  );
}

/**
 * Drags from one point to another in the page view iframe.
 * Useful for testing brush and rectangle selection tools.
 *
 * @param page - Playwright page instance
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param endX - Ending X coordinate
 * @param endY - Ending Y coordinate
 */
export async function dragInPageView(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<void> {
  const iframe = getPageViewIframe(page);
  const box = await iframe.boundingBox();

  if (box) {
    const actualStartX = box.x + startX;
    const actualStartY = box.y + startY;
    const actualEndX = box.x + endX;
    const actualEndY = box.y + endY;

    await page.mouse.move(actualStartX, actualStartY);
    await page.mouse.down();
    await page.mouse.move(actualEndX, actualEndY, { steps: 10 });
    await page.mouse.up();
  }
}

/**
 * Double-clicks on an element in the page view iframe.
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector for the element
 */
export async function doubleClickInPageView(page: Page, selector: string): Promise<void> {
  const frame = page.frameLocator('iframe');
  await frame.locator(selector).dblclick();
}

/**
 * Gets the XPath validation results after save/reload.
 *
 * @param page - Playwright page instance
 * @returns Array of XPath validation results
 */
export async function getXPathValidationResults(page: Page): Promise<
  Array<{
    isStable: boolean;
    originalXPath: string;
    resolvedElement: boolean;
    characterOffsetShift: number;
    recommendation: 'safe' | 'recompute' | 'skip_normalization';
  }>
> {
  return page.evaluate(() => {
    const element = document.querySelector('[data-xpath-validation]');
    if (element) {
      const data = element.getAttribute('data-xpath-validation');
      return data ? JSON.parse(data) : [];
    }
    return [];
  });
}

/**
 * Enables or disables HTML normalization.
 *
 * @param page - Playwright page instance
 * @param enabled - Whether to enable normalization
 */
export async function setNormalization(page: Page, enabled: boolean): Promise<void> {
  const checkbox = page.locator('[data-testid="normalization-toggle"]');
  const isChecked = await checkbox.isChecked();

  if (isChecked !== enabled) {
    await checkbox.click();
  }
}
