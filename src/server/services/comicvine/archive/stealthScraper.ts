/**
 * ComicVine Stealth Scraper
 *
 * Uses playwright-extra with stealth plugin to scrape ComicVine pages
 * for data not available via API (concepts, themes, etc.)
 *
 * Usage:
 * - API returns `site_detail_url` for volumes/issues
 * - Pass that URL to this scraper to get concepts/themes
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { logger } from '@/utils/logger';

// Add stealth plugin
chromium.use(StealthPlugin());

const BROWSER_DATA_DIR = path.join(os.tmpdir(), 'comicvine-stealth-browser');

// ============================================================================
// Types
// ============================================================================

export interface ScrapedPageData {
  url: string;
  title: string;
  /** Themes from Volume Themes infobox (Action, Adventure, etc.) */
  themes: string[];
  /** Concepts from sidebar (fallback) */
  concepts: string[];
  characters: string[];
  locations: string[];
  objects: string[];
  teams: string[];
  storyArcs: string[];
  creators: string[];
  /** Volume metadata */
  volumeName?: string;
  publisher?: string;
  year?: string;
}

export interface ScraperOptions {
  headless?: boolean;
  timeout?: number;
  visitHomepageFirst?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => {setTimeout(resolve, delay)});
}

function ensureBrowserDir(): void {
  if (!fs.existsSync(BROWSER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }
}

// ============================================================================
// Main Scraper
// ============================================================================

/**
 * Scrape a ComicVine page for concepts and other metadata
 *
 * @param url - ComicVine URL (volume or issue page)
 * @param options - Scraper options
 * @returns Scraped data including concepts, characters, etc.
 */
export async function scrapeComicVinePage(
  url: string,
  options: ScraperOptions = {}
): Promise<ScrapedPageData | null> {
  const {
    headless = false,
    timeout = 30000,
    visitHomepageFirst = true,
  } = options;

  logger.info('[StealthScraper] Starting scrape', { url });

  ensureBrowserDir();

  const browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });

  try {
    const page = browser.pages()[0] ?? await browser.newPage();
    page.setDefaultTimeout(timeout);

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    // Visit homepage first to establish session (helps avoid detection)
    if (visitHomepageFirst) {
      logger.debug('[StealthScraper] Visiting homepage first');
      await page.goto('https://comicvine.gamespot.com/', {
        waitUntil: 'domcontentloaded',
      });
      await randomDelay(1500, 2500);
    }

    // Navigate to target URL
    logger.debug('[StealthScraper] Navigating to target', { url });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    const pageTitle = await page.title();
    logger.info('[StealthScraper] Page loaded', { title: pageTitle });

    // Extract data
    const extractedData = await page.evaluate(() => {
      const extractByHrefPattern = (pattern: string): string[] => {
        const items: string[] = [];
        document.querySelectorAll(`a[href*="${pattern}"]`).forEach(link => {
          const text = link.textContent?.trim();
          if (text && !items.includes(text) && text.length > 1) {
            items.push(text);
          }
        });
        return items;
      };

      // Extract from sidebar sections (more reliable)
      const extractFromSidebar = (sectionName: string): string[] => {
        const items: string[] = [];
        document.querySelectorAll('.wiki-details-object').forEach(section => {
          const header = section.querySelector('h3')?.textContent?.trim().toLowerCase();
          if (header === sectionName.toLowerCase()) {
            section.querySelectorAll('.wiki-item-display a').forEach(link => {
              const text = link.textContent?.trim();
              if (text && text.length > 1 && !items.includes(text)) {
                items.push(text);
              }
            });
          }
        });
        return items;
      };

      // Extract themes from the volume info table
      // NOTE: div[data-field="themes"] contains ALL theme options (dropdown), not selected ones
      // We need to find the actual selected themes from the table display
      const extractThemesFromInfobox = (): string[] => {
        const themes: string[] = [];

        // Method 1: Look for themes in table structure (th>Themes / td with selected values)
        document.querySelectorAll('th').forEach(th => {
          if (th.textContent?.trim().toLowerCase() === 'themes') {
            const td = th.nextElementSibling;
            if (td?.tagName === 'TD') {
              // Look for .wiki-item-display which contains ONLY selected items
              const wikiDisplay = td.querySelector('.wiki-item-display');
              if (wikiDisplay) {
                wikiDisplay.querySelectorAll('a').forEach(link => {
                  const text = link.textContent?.trim();
                  if (text && text.length > 1 && !themes.includes(text)) {
                    themes.push(text);
                  }
                });
              }
            }
          }
        });

        // Method 2: Look for concepts section as fallback (concepts often serve as themes)
        if (themes.length === 0) {
          document.querySelectorAll('.wiki-details-object').forEach(section => {
            const header = section.querySelector('h3')?.textContent?.trim().toLowerCase();
            if (header === 'concepts') {
              section.querySelectorAll('.wiki-item-display a').forEach(link => {
                const text = link.textContent?.trim();
                if (text && text.length > 1 && !themes.includes(text)) {
                  themes.push(text);
                }
              });
            }
          });
        }

        return themes;
      };

      // Extract from Volume details section (dt/dd pairs)
      const extractFromVolumeDetails = (labelName: string): string => {
        let value = '';
        document.querySelectorAll('dt').forEach(dt => {
          const label = dt.textContent?.trim().toLowerCase();
          if (label === labelName.toLowerCase()) {
            const dd = dt.nextElementSibling;
            if (dd?.tagName === 'DD') {
              value = dd.textContent?.trim() ?? '';
            }
          }
        });
        return value;
      };

      const themes = extractThemesFromInfobox();

      return {
        // Themes from Volume Themes infobox (primary source)
        themes,
        // Also try concepts from sidebar as fallback
        concepts: extractFromSidebar('concepts').length > 0
          ? extractFromSidebar('concepts')
          : extractByHrefPattern('/4015-'),
        characters: extractFromSidebar('characters').length > 0
          ? extractFromSidebar('characters')
          : extractByHrefPattern('/4005-'),
        locations: extractFromSidebar('locations').length > 0
          ? extractFromSidebar('locations')
          : extractByHrefPattern('/4020-'),
        objects: extractFromSidebar('objects').length > 0
          ? extractFromSidebar('objects')
          : extractByHrefPattern('/4055-'),
        teams: extractFromSidebar('teams').length > 0
          ? extractFromSidebar('teams')
          : extractByHrefPattern('/4060-'),
        storyArcs: extractFromSidebar('story arcs').length > 0
          ? extractFromSidebar('story arcs')
          : extractByHrefPattern('/4045-'),
        creators: extractFromSidebar('creators'),
        // Volume details
        volumeName: extractFromVolumeDetails('name'),
        publisher: extractFromVolumeDetails('publisher'),
        year: extractFromVolumeDetails('year'),
      };
    });

    const result: ScrapedPageData = {
      url,
      title: pageTitle,
      themes: extractedData.themes,
      concepts: extractedData.concepts,
      characters: extractedData.characters.slice(0, 50),
      locations: extractedData.locations,
      objects: extractedData.objects,
      teams: extractedData.teams,
      storyArcs: extractedData.storyArcs,
      creators: extractedData.creators,
    };
    // Only add optional fields if they have values
    if (extractedData.volumeName) result.volumeName = extractedData.volumeName;
    if (extractedData.publisher) result.publisher = extractedData.publisher;
    if (extractedData.year) result.year = extractedData.year;

    logger.info('[StealthScraper] Extraction complete', {
      themes: result.themes.length,
      concepts: result.concepts.length,
      characters: result.characters.length,
      locations: result.locations.length,
    });

    return result;

  } catch (error) {
    logger.error('[StealthScraper] Scrape failed', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;

  } finally {
    await browser.close();
    logger.debug('[StealthScraper] Browser closed');
  }
}

/**
 * Scrape multiple ComicVine pages
 *
 * Reuses browser session for efficiency
 */
export async function scrapeMultiplePages(
  urls: string[],
  options: ScraperOptions = {}
): Promise<Map<string, ScrapedPageData | null>> {
  const results = new Map<string, ScrapedPageData | null>();

  const {
    headless = false,
    timeout = 30000,
  } = options;

  logger.info('[StealthScraper] Batch scrape starting', { count: urls.length });

  ensureBrowserDir();

  const browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  try {
    const page = browser.pages()[0] ?? await browser.newPage();
    page.setDefaultTimeout(timeout);

    // Visit homepage first
    await page.goto('https://comicvine.gamespot.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(1500, 2500);

    for (const url of urls) {
      try {
        // eslint-disable-next-line no-await-in-loop -- Rate-limited scraping; sequential with delays prevents anti-bot blocking
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        // eslint-disable-next-line no-await-in-loop -- Rate-limited scraping; sequential with delays prevents anti-bot blocking
        await randomDelay(2000, 3000);

        // eslint-disable-next-line no-await-in-loop -- Rate-limited scraping; sequential with delays prevents anti-bot blocking
        const pageTitle = await page.title();

        // eslint-disable-next-line no-await-in-loop -- Rate-limited scraping; sequential with delays prevents anti-bot blocking
        const extractedData = await page.evaluate(() => {
          const extractFromSidebar = (sectionName: string): string[] => {
            const items: string[] = [];
            document.querySelectorAll('.wiki-details-object').forEach(section => {
              const header = section.querySelector('h3')?.textContent?.trim().toLowerCase();
              if (header === sectionName.toLowerCase()) {
                section.querySelectorAll('.wiki-item-display a').forEach(link => {
                  const text = link.textContent?.trim();
                  if (text && text.length > 1 && !items.includes(text)) {
                    items.push(text);
                  }
                });
              }
            });
            return items;
          };

          // Extract themes from table structure (NOT div[data-field] which has all options)
          const extractThemes = (): string[] => {
            const themes: string[] = [];
            // Look for themes in table structure (th>Themes / td with selected values)
            document.querySelectorAll('th').forEach(th => {
              if (th.textContent?.trim().toLowerCase() === 'themes') {
                const td = th.nextElementSibling;
                if (td?.tagName === 'TD') {
                  // Look for .wiki-item-display which contains ONLY selected items
                  const wikiDisplay = td.querySelector('.wiki-item-display');
                  if (wikiDisplay) {
                    wikiDisplay.querySelectorAll('a').forEach(link => {
                      const text = link.textContent?.trim();
                      if (text && text.length > 1 && !themes.includes(text)) {
                        themes.push(text);
                      }
                    });
                  }
                }
              }
            });
            // Fallback: concepts section
            if (themes.length === 0) {
              const conceptsThemes = extractFromSidebar('concepts');
              conceptsThemes.forEach(t => themes.push(t));
            }
            return themes;
          };

          return {
            themes: extractThemes(),
            concepts: extractFromSidebar('concepts'),
            characters: extractFromSidebar('characters'),
            locations: extractFromSidebar('locations'),
            objects: extractFromSidebar('objects'),
            teams: extractFromSidebar('teams'),
            storyArcs: extractFromSidebar('story arcs'),
            creators: extractFromSidebar('creators'),
          };
        });

        results.set(url, {
          url,
          title: pageTitle,
          themes: extractedData.themes,
          concepts: extractedData.concepts,
          characters: extractedData.characters.slice(0, 50),
          locations: extractedData.locations,
          objects: extractedData.objects,
          teams: extractedData.teams,
          storyArcs: extractedData.storyArcs,
          creators: extractedData.creators,
        });

        logger.debug('[StealthScraper] Page scraped', { url, title: pageTitle });

      } catch (error) {
        logger.error('[StealthScraper] Failed to scrape page', { url, error });
        results.set(url, null);
      }
    }

  } finally {
    await browser.close();
  }

  logger.info('[StealthScraper] Batch scrape complete', {
    total: urls.length,
    successful: Array.from(results.values()).filter(v => v !== null).length,
  });

  return results;
}

/**
 * Clear the browser profile/cache
 */
export function clearBrowserCache(): void {
  if (fs.existsSync(BROWSER_DATA_DIR)) {
    fs.rmSync(BROWSER_DATA_DIR, { recursive: true });
    logger.info('[StealthScraper] Browser cache cleared');
  }
}
