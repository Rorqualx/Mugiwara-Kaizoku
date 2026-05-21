/**
 * ComicVine Full Scrape: Search -> Volume -> Issue -> Concepts
 *
 * Complete flow to reliably find and extract concepts/themes
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

chromium.use(StealthPlugin());

const BROWSER_DATA_DIR = path.join(os.tmpdir(), 'comicvine-browser-profile');

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

interface ExtractedData {
  volumeUrl: string;
  volumeTitle: string;
  volumeId: string;
  issueUrl: string;
  issueTitle: string;
  issueId: string;
  concepts: string[];
  characters: string[];
  locations: string[];
  objects: string[];
  teams: string[];
  storyArcs: string[];
  allSidebarData: Record<string, string[]>;
}

async function scrapeComicVine(searchQuery: string): Promise<ExtractedData | null> {
  console.log('='.repeat(60));
  console.log(`Full ComicVine Scrape: "${searchQuery}"`);
  console.log('='.repeat(60));

  // Clear browser profile
  if (fs.existsSync(BROWSER_DATA_DIR)) {
    fs.rmSync(BROWSER_DATA_DIR, { recursive: true });
  }
  fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });

  const browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  let result: ExtractedData | null = null;

  try {
    const page = browser.pages()[0] || await browser.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Step 1: Homepage
    console.log('\n--- Step 1: Visit homepage ---');
    await page.goto('https://comicvine.gamespot.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    // Step 2: Search
    console.log('\n--- Step 2: Search ---');
    const searchUrl = `https://comicvine.gamespot.com/search/?q=${encodeURIComponent(searchQuery)}&i=volume`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    // Step 3: Find the Kodansha/USA version (not German/French/Spanish)
    console.log('\n--- Step 3: Find English version ---');

    // Get all search results and find the Kodansha USA one
    const searchResults = await page.evaluate(() => {
      const results: Array<{href: string, text: string}> = [];
      document.querySelectorAll('.search-results li, [class*="result"]').forEach(item => {
        const link = item.querySelector('a[href*="/4050-"]');
        if (link) {
          const href = link.getAttribute('href') || '';
          const text = item.textContent || '';
          results.push({ href, text });
        }
      });
      return results;
    });

    console.log('Found volumes:');
    searchResults.forEach((r, i) => {
      const isUSA = r.text.includes('Kodansha Comics USA') || r.text.includes('USA');
      console.log(`  ${i + 1}. ${r.href} ${isUSA ? '← USA' : ''}`);
    });

    // Find USA/Kodansha version, or fall back to first
    const usaResult = searchResults.find(r =>
      r.text.includes('Kodansha Comics USA') ||
      r.text.includes('Kodansha USA')
    );
    const targetHref = usaResult?.href || searchResults[0]?.href;

    if (!targetHref) {
      console.log('No volume found');
      return null;
    }

    console.log('Selected:', targetHref);
    const volumeLink = await page.$(`a[href="${targetHref}"]`);
    if (!volumeLink) {
      console.log('Could not find link');
      return null;
    }

    await volumeLink.click();
    await page.waitForLoadState('domcontentloaded');
    await randomDelay(2000, 3000);

    const volumeTitle = await page.title();
    const volumeUrl = page.url();
    const volumeIdMatch = volumeUrl.match(/\/4050-(\d+)/);
    const volumeId = volumeIdMatch ? volumeIdMatch[1] : '';

    console.log('Volume:', volumeTitle);
    console.log('URL:', volumeUrl);

    // Step 4: Find and click first issue
    console.log('\n--- Step 4: Click first issue ---');

    // Get issue link
    const issueLink = await page.$('a[href*="/4000-"]');
    if (!issueLink) {
      console.log('No issues found on volume page');
      return null;
    }

    await issueLink.click();
    await page.waitForLoadState('domcontentloaded');
    await randomDelay(3000, 4000);

    const issueTitle = await page.title();
    const issueUrl = page.url();
    const issueIdMatch = issueUrl.match(/\/4000-(\d+)/);
    const issueId = issueIdMatch ? issueIdMatch[1] : '';

    console.log('Issue:', issueTitle);
    console.log('URL:', issueUrl);

    await page.screenshot({ path: '/tmp/comicvine-issue-page.png', fullPage: true });
    console.log('Screenshot: /tmp/comicvine-issue-page.png');

    // Step 5: Extract all data
    console.log('\n--- Step 5: Extract data ---');

    const extractedData = await page.evaluate(() => {
      const data: Record<string, unknown> = {};

      // Extract by link patterns
      const extractByHref = (pattern: string): string[] => {
        const items: string[] = [];
        document.querySelectorAll(`a[href*="${pattern}"]`).forEach(link => {
          const text = link.textContent?.trim();
          if (text && !items.includes(text) && text.length > 1) {
            items.push(text);
          }
        });
        return items;
      };

      data.concepts = extractByHref('/4015-');
      data.characters = extractByHref('/4005-').slice(0, 20);
      data.locations = extractByHref('/4020-');
      data.objects = extractByHref('/4055-');
      data.teams = extractByHref('/4060-');
      data.storyArcs = extractByHref('/4045-');

      // Extract all sidebar sections
      const sidebar: Record<string, string[]> = {};
      document.querySelectorAll('.wiki-details-object').forEach(section => {
        const header = section.querySelector('h3')?.textContent?.trim();
        if (header) {
          const items: string[] = [];
          section.querySelectorAll('.wiki-item-display a').forEach(link => {
            const text = link.textContent?.trim();
            if (text && text.length > 1) items.push(text);
          });
          sidebar[header] = items;
        }
      });
      data.sidebar = sidebar;

      return data;
    });

    result = {
      volumeUrl,
      volumeTitle,
      volumeId,
      issueUrl,
      issueTitle,
      issueId,
      concepts: extractedData.concepts as string[],
      characters: extractedData.characters as string[],
      locations: extractedData.locations as string[],
      objects: extractedData.objects as string[],
      teams: extractedData.teams as string[],
      storyArcs: extractedData.storyArcs as string[],
      allSidebarData: extractedData.sidebar as Record<string, string[]>,
    };

    console.log('\n=== EXTRACTED DATA ===');
    console.log('Concepts:', result.concepts);
    console.log('Characters:', result.characters.slice(0, 10));
    console.log('Locations:', result.locations);
    console.log('Objects:', result.objects);
    console.log('Teams:', result.teams);
    console.log('Story Arcs:', result.storyArcs);
    console.log('\nSidebar sections:', Object.keys(result.allSidebarData));

    // Keep browser open
    console.log('\n--- Browser open for 8 seconds ---');
    await randomDelay(8000, 8000);

  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }

  return result;
}

async function main(): Promise<void> {
  const result = await scrapeComicVine('Fire Force');

  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULT');
  console.log('='.repeat(60));

  if (result) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('No data extracted');
  }
}

main().catch(console.error);
