/**
 * Browser-Based Scraper for ComicVine
 *
 * Uses Puppeteer to bypass Cloudflare protection
 * and extract themes/concepts from ComicVine pages.
 *
 * @module browserScraper
 */

import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

import { logger } from '@/utils/logger';


import { extractVolumeMetadata } from '../metadata-extractor';

import type { VolumeMetadata } from '../metadata-extractor';
import type { Browser, Page } from 'puppeteer';

// Browser instance management
let browserInstance: Browser | null = null;
let browserLastUsed: number = 0;
const BROWSER_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Configuration options for browser scraping
 */
interface BrowserScraperOptions {
  /** Timeout for page navigation in milliseconds */
  timeout?: number;
  /** Wait for Cloudflare challenge in milliseconds */
  cloudflareWait?: number;
  /** Whether to run in headless mode */
  headless?: boolean;
  /** Whether to take debug screenshots */
  debug?: boolean;
}

const DEFAULT_OPTIONS: Required<BrowserScraperOptions> = {
  timeout: 30000,
  cloudflareWait: 10000,
  headless: true,
  debug: false,
};

/**
 * Get or create a browser instance
 * Reuses existing browser to avoid repeated startup costs
 */
async function getBrowser(headless: boolean = true): Promise<Browser> {
  // Check if existing browser is still valid
  if (browserInstance) {
    try {
      // Test if browser is still connected
      const pages = await browserInstance.pages();
      if (pages.length >= 0) {
        browserLastUsed = Date.now();
        return browserInstance;
      }
    } catch {
      // Browser is disconnected, will create new one
      browserInstance = null;
    }
  }

  logger.info('[BrowserScraper] Launching new browser instance');

  browserInstance = await puppeteer.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--ignore-certificate-errors',
    ],
  });

  browserLastUsed = Date.now();

  // Set up idle cleanup
  scheduleIdleCleanup();

  return browserInstance;
}

/**
 * Schedule browser cleanup if idle
 */
function scheduleIdleCleanup(): void {
  setTimeout(() => {
    void (async () => {
      if (browserInstance && Date.now() - browserLastUsed > BROWSER_IDLE_TIMEOUT) {
        logger.info('[BrowserScraper] Closing idle browser instance');
        try {
          await browserInstance.close();
        } catch {
          // Ignore close errors
        }
        browserInstance = null;
      } else if (browserInstance) {
        // Reschedule if still in use
        scheduleIdleCleanup();
      }
    })();
  }, BROWSER_IDLE_TIMEOUT);
}

/**
 * Configure page with realistic browser behavior
 */
async function configurePage(page: Page): Promise<void> {
  // Set realistic viewport
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  });

  // Override navigator properties to appear more human
  await page.evaluateOnNewDocument(() => {
    // Override webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin' },
        { name: 'Chrome PDF Viewer' },
        { name: 'Native Client' },
      ],
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });
}

/**
 * Wait for Cloudflare challenge to be solved
 * Detects and waits for various Cloudflare protection pages
 */
async function waitForCloudflare(
  page: Page,
  timeout: number
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // eslint-disable-next-line no-await-in-loop -- Sequential browser content polling required to detect Cloudflare challenge completion
    const pageContent = await page.content();

    // Check for Cloudflare challenge indicators
    const isCloudflare =
      pageContent.includes('cf-browser-verification') ||
      pageContent.includes('cf_clearance') ||
      pageContent.includes('Checking your browser') ||
      pageContent.includes('Just a moment') ||
      pageContent.includes('cf-spinner') ||
      pageContent.includes('challenge-platform');

    if (!isCloudflare) {
      logger.info('[BrowserScraper] Cloudflare challenge passed or not present');
      return true;
    }

    logger.debug('[BrowserScraper] Waiting for Cloudflare challenge...');
    // eslint-disable-next-line no-await-in-loop -- Sequential delay required between Cloudflare challenge polling attempts
    await new Promise<void>((resolve) => { setTimeout(resolve, 1000); });
  }

  logger.warn('[BrowserScraper] Cloudflare challenge timeout');
  return false;
}

/**
 * Fetch page HTML using browser automation
 * Bypasses Cloudflare and other JavaScript-based protections
 */
export async function fetchPageWithBrowser(
  url: string,
  options: BrowserScraperOptions = {}
): Promise<string | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let page: Page | null = null;

  try {
    const browser = await getBrowser(opts.headless);
    page = await browser.newPage();

    await configurePage(page);

    logger.info('[BrowserScraper] Navigating to:', url);

    // Navigate to the page
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: opts.timeout,
    });

    if (!response) {
      logger.error('[BrowserScraper] No response received');
      return null;
    }

    const status = response.status();
    logger.info('[BrowserScraper] Initial response status:', status);

    // Check for Cloudflare and wait if needed
    if (status === 403 || status === 503) {
      const cloudflareSuccess = await waitForCloudflare(page, opts.cloudflareWait);
      if (!cloudflareSuccess) {
        logger.error('[BrowserScraper] Failed to bypass Cloudflare');
        if (opts.debug) {
          await page.screenshot({ path: '/tmp/cloudflare-failure.png' });
        }
        return null;
      }
    }

    // Wait for content to load
    await page.waitForSelector('body', { timeout: 5000 });

    // Additional wait for dynamic content
    await new Promise<void>((resolve) => { setTimeout(resolve, 2000); });

    // Get final page content
    const html = await page.content();

    if (opts.debug) {
      await page.screenshot({ path: '/tmp/comicvine-success.png', fullPage: true });
      logger.info('[BrowserScraper] Debug screenshot saved');
    }

    logger.info('[BrowserScraper] Successfully fetched page', {
      contentLength: html.length,
    });

    return html;
  } catch (error) {
    logger.error('[BrowserScraper] Failed to fetch page', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Scrape volume metadata using browser automation
 * Uses Puppeteer to bypass Cloudflare and extract themes/concepts
 */
export async function scrapeVolumeWithBrowser(
  volumeUrl: string,
  options: BrowserScraperOptions = {}
): Promise<VolumeMetadata | null> {
  try {
    logger.info('[BrowserScraper] Scraping volume with browser:', volumeUrl);

    const html = await fetchPageWithBrowser(volumeUrl, options);
    if (!html) {
      return null;
    }

    // Use cheerio to parse the HTML
    const $ = cheerio.load(html);

    // Use existing metadata extraction logic
    const metadata = extractVolumeMetadata($, volumeUrl);

    logger.info('[BrowserScraper] Extracted metadata:', {
      volumeTitle: metadata.volumeTitle,
      themesCount: metadata.themes?.length ?? 0,
      themes: metadata.themes ?? [],
      genresCount: metadata.genres?.length ?? 0,
    });

    return metadata;
  } catch (error) {
    logger.error('[BrowserScraper] Failed to scrape volume', {
      volumeUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract concepts/themes from a ComicVine page using browser
 * Focused method for getting just the themes/concepts
 */
export async function extractConceptsWithBrowser(
  volumeUrl: string,
  options: BrowserScraperOptions = {}
): Promise<string[]> {
  try {
    const html = await fetchPageWithBrowser(volumeUrl, options);
    if (!html) {
      return [];
    }

    const $ = cheerio.load(html);
    const concepts: string[] = [];

    // Extract from multiple selector patterns
    // Pattern 1: Sidebar with concept links
    $('a[href*="/concept/"], a[href*="/4015-"]').each((_, link) => {
      const conceptName = $(link).text().trim();
      if (conceptName && conceptName.length > 1 && !concepts.includes(conceptName)) {
        // Filter out navigation elements
        if (!['Concepts', 'View all', 'See all'].includes(conceptName)) {
          concepts.push(conceptName);
        }
      }
    });

    // Pattern 2: Wiki details section
    $('.wiki-details dt').each((_, dt) => {
      const labelText = $(dt).text().toLowerCase().trim();
      if (labelText.includes('concept')) {
        const dd = $(dt).next('dd');
        dd.find('a').each((__, link) => {
          const conceptName = $(link).text().trim();
          if (conceptName && !concepts.includes(conceptName)) {
            concepts.push(conceptName);
          }
        });
      }
    });

    // Pattern 3: Direct text matching in sidebar
    $('[class*="aside"], [class*="sidebar"]').find('a').each((_, link) => {
      const href = $(link).attr('href') ?? '';
      if (href.includes('/concept/') || href.includes('/4015-')) {
        const conceptName = $(link).text().trim();
        if (conceptName && !concepts.includes(conceptName)) {
          concepts.push(conceptName);
        }
      }
    });

    logger.info('[BrowserScraper] Extracted concepts:', {
      count: concepts.length,
      concepts,
    });

    return concepts;
  } catch (error) {
    logger.error('[BrowserScraper] Failed to extract concepts', {
      volumeUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Close the browser instance
 * Call this when shutting down the application
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    try {
      await browserInstance.close();
      logger.info('[BrowserScraper] Browser closed');
    } catch (error) {
      logger.error('[BrowserScraper] Error closing browser', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    browserInstance = null;
  }
}

// Export for testing
export const browserScraperService = {
  fetchPageWithBrowser,
  scrapeVolumeWithBrowser,
  extractConceptsWithBrowser,
  closeBrowser,
};
