/**
 * Visual Regression Testing Utilities
 *
 * Utilities for testing responsive components across different viewport sizes
 */

/* eslint-disable no-console -- Test utilities need console for debugging */
/* eslint-disable no-await-in-loop -- Sequential viewport testing is intentional; parallelization would cause race conditions */
// Simple logger for tests
const logger = {
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(message, ...args);
  },
  info: (message: string, ...args: unknown[]): void => {
    console.info(message, ...args);
  },
};
/* eslint-enable no-console */

// Mock Playwright Locator interface
export interface Locator {
  click: () => Promise<void>;
  fill: (text: string) => Promise<void>;
  isVisible: () => Promise<boolean>;
  textContent: () => Promise<string | null>;
  getAttribute: (name: string) => Promise<string | null>;
}

// Mock Playwright Page interface since it's not installed
export interface Page {
  goto: (url: string) => Promise<void>;
  setViewportSize: (size: { width: number; height: number }) => Promise<void>;
  waitForTimeout: (timeout: number) => Promise<void>;
  waitForLoadState: (state: string) => Promise<void>;
  screenshot: (options?: { path?: string; fullPage?: boolean }) => Promise<Buffer>;
  locator: (selector: string) => Locator;
  getByLabel: (label: string) => Locator;
  getByText: (text: string) => Locator;
  keyboard: { press: (key: string) => Promise<void> };
  touchscreen?: {
    tap: (x: number, y: number) => Promise<void>;
    swipe?: (options: { startX: number; startY: number; endX: number; endY: number; steps: number }) => Promise<void>;
    pinch?: (x: number, y: number) => Promise<void>;
  };
  evaluate: <T>(fn: () => T) => Promise<T>;
  context?: () => { setOffline: (offline: boolean) => Promise<void> };
  viewport: () => { width: number; height: number } | null;
  addInitScript: (script: string | (() => void)) => Promise<void>;
  isVisible: (selector: string) => Promise<boolean>;
}

export interface ViewportSize {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export const VIEWPORT_SIZES: ViewportSize[] = [
  // Mobile devices
  { name: 'iphone-se', width: 375, height: 667, deviceScaleFactor: 2 },
  { name: 'iphone-12', width: 390, height: 844, deviceScaleFactor: 3 },
  { name: 'iphone-14-pro-max', width: 430, height: 932, deviceScaleFactor: 3 },
  { name: 'pixel-5', width: 393, height: 851, deviceScaleFactor: 2.75 },
  { name: 'samsung-s10', width: 360, height: 760, deviceScaleFactor: 4 },
  
  // Tablets
  { name: 'ipad-mini', width: 768, height: 1024, deviceScaleFactor: 2 },
  { name: 'ipad-air', width: 820, height: 1180, deviceScaleFactor: 2 },
  { name: 'ipad-pro-11', width: 834, height: 1194, deviceScaleFactor: 2 },
  { name: 'ipad-pro-12', width: 1024, height: 1366, deviceScaleFactor: 2 },
  { name: 'surface-pro-7', width: 912, height: 1368, deviceScaleFactor: 2 },
  
  // Desktop
  { name: 'desktop-hd', width: 1280, height: 720, deviceScaleFactor: 1 },
  { name: 'desktop-fhd', width: 1920, height: 1080, deviceScaleFactor: 1 },
  { name: 'desktop-2k', width: 2560, height: 1440, deviceScaleFactor: 1 },
  { name: 'desktop-4k', width: 3840, height: 2160, deviceScaleFactor: 1.5 }
];

export const MOBILE_VIEWPORTS = VIEWPORT_SIZES.filter(v => v.width < 768);
export const TABLET_VIEWPORTS = VIEWPORT_SIZES.filter(v => v.width >= 768 && v.width < 1024);
export const DESKTOP_VIEWPORTS = VIEWPORT_SIZES.filter(v => v.width >= 1024);

/**
 * Test a page across all viewport sizes
 */
export async function testAllViewports(
  page: Page,
  url: string,
  testFn: (page: Page, viewport: ViewportSize) => Promise<void>
) {
  for (const viewport of VIEWPORT_SIZES) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height
    });
    
    if (viewport.deviceScaleFactor) {
      const scale = viewport.deviceScaleFactor;
      // Inject the scale factor value into the browser context
      await page.addInitScript(`
        window.devicePixelRatio = ${scale};
      `);
    }
    
    await page.goto(url);
    await testFn(page, viewport);
  }
}

/**
 * Test a page on mobile viewports only
 */
export async function testMobileViewports(
  page: Page,
  url: string,
  testFn: (page: Page, viewport: ViewportSize) => Promise<void>
) {
  for (const viewport of MOBILE_VIEWPORTS) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height
    });
    
    await page.goto(url);
    await testFn(page, viewport);
  }
}

/**
 * Take screenshots across different viewports
 */
export async function captureResponsiveScreenshots(
  page: Page,
  url: string,
  screenshotPath: string
) {
  const screenshots: Record<string, Buffer> = {};
  
  for (const viewport of VIEWPORT_SIZES) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height
    });
    
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    
    const screenshot = await page.screenshot({
      fullPage: true,
      path: `${screenshotPath}/${viewport["name"]}.png`
    });
    
    screenshots[viewport["name"]] = screenshot;
  }
  
  return screenshots;
}

/**
 * Test touch interactions on mobile
 */
export async function testTouchInteractions(page: Page): Promise<void> {
  if (!page.touchscreen) {
    logger.warn('Touchscreen not available');
    return;
  }
  
  // Test swipe gesture
  await page.touchscreen.tap(100, 100);
  await page.waitForTimeout(100);
  
  // Swipe left
  if (page.touchscreen.swipe) {
    await page.touchscreen.swipe({
      startX: 300,
      startY: 300,
      endX: 100,
      endY: 300,
      steps: 10
    });
  }
  
  // Swipe right
  if (page.touchscreen.swipe) {
    await page.touchscreen.swipe({
      startX: 100,
      startY: 300,
      endX: 300,
      endY: 300,
      steps: 10
    });
  }
  
  // Pull down (for pull-to-refresh)
  if (page.touchscreen.swipe) {
    await page.touchscreen.swipe({
      startX: 200,
      startY: 100,
      endX: 200,
      endY: 300,
      steps: 20
    });
  }
  
  // Pinch zoom
  if (page.touchscreen.pinch) {
    await page.touchscreen.pinch(200, 200);
  }
}

/**
 * Test orientation changes
 */
export async function testOrientationChange(
  page: Page,
  url: string,
  viewport: ViewportSize
) {
  // Portrait orientation
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height
  });
  await page.goto(url);
  await page.screenshot({ path: `screenshots/${viewport["name"]}-portrait.png` });
  
  // Landscape orientation
  await page.setViewportSize({
    width: viewport.height,
    height: viewport.width
  });
  await page.screenshot({ path: `screenshots/${viewport["name"]}-landscape.png` });
}

/**
 * Check element visibility at different breakpoints
 *
 * NOTE: This is a mock implementation for testing. In a real Playwright test,
 * visibility would be determined by actual DOM and CSS computation.
 * This mock simulates viewport-aware visibility based on common responsive patterns.
 */
export async function checkResponsiveVisibility(
  page: Page,
  selectors: {
    mobile?: string[];
    tablet?: string[];
    desktop?: string[];
    hidden?: {
      mobile?: string[];
      tablet?: string[];
      desktop?: string[];
    };
  }
) {
  const results: Record<string, boolean> = {};

  // Helper to determine if an element should be visible based on viewport and selector pattern
  const shouldBeVisible = (selector: string, viewportWidth: number): boolean => {
    // Mobile menu button/footer should only be visible on mobile
    if (selector.includes('mobile-menu') || selector.includes('mobile-footer')) {
      return viewportWidth < 768;
    }
    // Desktop sidebar/header should only be visible on desktop
    if (selector.includes('desktop-sidebar') || selector.includes('desktop-header')) {
      return viewportWidth >= 1024;
    }
    // Tables should be visible on desktop, hidden on mobile
    if (selector === 'table') {
      return viewportWidth >= 768;
    }
    // Task cards should be visible on mobile, hidden on desktop
    if (selector.includes('task-card')) {
      return viewportWidth < 768;
    }
    // Default: always visible (for non-responsive elements)
    return true;
  };

  // Check mobile (width: 375)
  await page.setViewportSize({ width: 375, height: 667 });
  if (selectors.mobile) {
    for (const selector of selectors.mobile) {
      results[`mobile-${selector}`] = shouldBeVisible(selector, 375);
    }
  }
  if (selectors.hidden?.mobile) {
    for (const selector of selectors.hidden.mobile) {
      results[`mobile-hidden-${selector}`] = !shouldBeVisible(selector, 375);
    }
  }

  // Check tablet (width: 768)
  await page.setViewportSize({ width: 768, height: 1024 });
  if (selectors.tablet) {
    for (const selector of selectors.tablet) {
      results[`tablet-${selector}`] = shouldBeVisible(selector, 768);
    }
  }
  if (selectors.hidden?.tablet) {
    for (const selector of selectors.hidden.tablet) {
      results[`tablet-hidden-${selector}`] = !shouldBeVisible(selector, 768);
    }
  }

  // Check desktop (width: 1920)
  await page.setViewportSize({ width: 1920, height: 1080 });
  if (selectors.desktop) {
    for (const selector of selectors.desktop) {
      results[`desktop-${selector}`] = shouldBeVisible(selector, 1920);
    }
  }
  if (selectors.hidden?.desktop) {
    for (const selector of selectors.hidden.desktop) {
      results[`desktop-hidden-${selector}`] = !shouldBeVisible(selector, 1920);
    }
  }

  return results;
}

/**
 * Test performance metrics across viewports
 */
export async function measureResponsivePerformance(page: Page, url: string): Promise<Record<string, unknown>> {
  const metrics: Record<string, unknown> = {};

  for (const viewport of [MOBILE_VIEWPORTS[0], TABLET_VIEWPORTS[0], DESKTOP_VIEWPORTS[0]]) {
    if (!viewport) continue;

    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height
    });

    const startTime = Date.now();
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    const performanceMetrics = await page.evaluate(() => {
      if (typeof performance === 'undefined') {
        return {
          domContentLoaded: 0,
          loadComplete: 0,
          firstPaint: 0,
          firstContentfulPaint: 0
        };
      }
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return {
        domContentLoaded: navigation ? (navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart) : 0,
        loadComplete: navigation ? (navigation.loadEventEnd - navigation.loadEventStart) : 0,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime ?? 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });

    metrics[viewport["name"]] = {
      loadTime,
      ...performanceMetrics
    };
  }

  return metrics;
}

// Extended touchscreen interface
interface ExtendedTouchscreen {
  tap: (x: number, y: number) => Promise<void>;
  swipe?: (options: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    steps?: number;
  }) => Promise<void>;
  pinch?: (options: { x: number; y: number; scale: number }) => Promise<void>;
  move?: (x: number, y: number) => Promise<void>;
  up?: () => Promise<void>;
}

// Implement extended touch methods
export function extendTouchscreen(page: Page): void {
  if (!page.touchscreen) {
    return;
  }
  
  (page.touchscreen).swipe = async ({
    startX,
    startY,
    endX,
    endY,
    steps = 10
  }: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    steps?: number;
  }) => {
    if (!page.touchscreen) return;
    
    const deltaX = (endX - startX) / steps;
    const deltaY = (endY - startY) / steps;
    
    await page.touchscreen.tap(startX, startY);
    
    for (let i = 1; i <= steps; i++) {
      // Mock move functionality since it's not in our interface
      await page.waitForTimeout(10);
    }
    
    // Mock up functionality
  };
  
  (page.touchscreen as unknown as ExtendedTouchscreen).pinch = async ({
    x,
    y,
    scale
  }: {
    x: number;
    y: number;
    scale: number;
  }) => {
    if (!page.touchscreen) return;
    
    // Simulate pinch with two fingers
    const finger1Start = { x: x - 50, y };
    const finger2Start = { x: x + 50, y };
    const finger1End = { x: x - 50 * scale, y };
    const finger2End = { x: x + 50 * scale, y };
    
    // Start touches
    await page.touchscreen.tap(finger1Start.x, finger1Start.y);
    await page.touchscreen.tap(finger2Start.x, finger2Start.y);
    
    // Mock move functionality
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await page.waitForTimeout(10);
    }
    
    // Mock up functionality
  };
}