/**
 * ComicVine: Use API for URLs, then scrape for concepts
 *
 * Strategy:
 * 1. Use API to get site_detail_url for issues
 * 2. Use stealth browser to scrape those URLs for concepts/themes
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

chromium.use(StealthPlugin());

const BROWSER_DATA_DIR = path.join(os.tmpdir(), 'comicvine-browser-profile');
const API_KEY = process.env.COMICVINE_API_KEY;

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

interface IssueResult {
  id: number;
  name: string;
  issue_number: string;
  site_detail_url: string;
}

async function getIssueUrlsFromApi(volumeId: number): Promise<IssueResult[]> {
  if (!API_KEY) {
    console.log('No API key found, using known Fire Force URLs');
    // Return known Fire Force issue URLs
    return [
      {
        id: 557264,
        name: 'Fire Walk With Me',
        issue_number: '1',
        site_detail_url: 'https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/'
      }
    ];
  }

  const url = `https://comicvine.gamespot.com/api/issues/?api_key=${API_KEY}&format=json&filter=volume:${volumeId}&field_list=id,name,issue_number,site_detail_url&limit=10`;

  console.log('Fetching issues from API for volume:', volumeId);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'MuggiwaraKaizoku/1.0 (manga library app)'
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json() as { results: IssueResult[] };
  return data.results || [];
}

async function scrapeConceptsFromUrl(
  browser: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  url: string
): Promise<string[]> {
  const page = browser.pages()[0] || await browser.newPage();

  console.log('Scraping:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await randomDelay(2000, 3000);

  const title = await page.title();
  console.log('Page title:', title);

  // Extract concepts
  const concepts = await page.evaluate(() => {
    const results: string[] = [];

    // Look for concept links
    document.querySelectorAll('a[href*="/concept/"], a[href*="/4015-"]').forEach(link => {
      const text = link.textContent?.trim();
      if (text && !results.includes(text) && text.length > 1) {
        results.push(text);
      }
    });

    // Look in sidebar sections
    document.querySelectorAll('.wiki-details-object').forEach(section => {
      const header = section.querySelector('h3')?.textContent?.trim()?.toLowerCase();
      if (header === 'concepts') {
        section.querySelectorAll('a').forEach(link => {
          const text = link.textContent?.trim();
          if (text && !results.includes(text) && text.length > 1) {
            results.push(text);
          }
        });
      }
    });

    return results;
  });

  return concepts;
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ComicVine: API URLs + Browser Scraping');
  console.log('='.repeat(60));

  // Fire Force volume ID (correct: 4050-95557)
  const FIRE_FORCE_VOLUME_ID = 95557;

  // Step 1: Get issue URLs from API (or use known URLs)
  console.log('\n--- Step 1: Get issue URLs ---');
  const issues = await getIssueUrlsFromApi(FIRE_FORCE_VOLUME_ID);
  console.log(`Found ${issues.length} issues`);
  issues.forEach(issue => {
    console.log(`  #${issue.issue_number}: ${issue.name}`);
    console.log(`    URL: ${issue.site_detail_url}`);
  });

  if (issues.length === 0) {
    console.log('No issues found');
    return;
  }

  // Step 2: Launch browser and scrape first issue for concepts
  console.log('\n--- Step 2: Launch stealth browser ---');

  if (!fs.existsSync(BROWSER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }

  const browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  try {
    const page = browser.pages()[0] || await browser.newPage();

    // Visit homepage first to establish session
    console.log('\n--- Step 3: Visit homepage ---');
    await page.goto('https://comicvine.gamespot.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    // Step 4: Scrape the first issue
    console.log('\n--- Step 4: Scrape first issue for concepts ---');
    const firstIssue = issues[0];
    const concepts = await scrapeConceptsFromUrl(browser, firstIssue.site_detail_url);

    console.log('\n=== EXTRACTED CONCEPTS ===');
    console.log(concepts);

    // Take screenshot
    await page.screenshot({ path: '/tmp/comicvine-concepts.png', fullPage: true });
    console.log('\nScreenshot saved to /tmp/comicvine-concepts.png');

    // Step 5: Extract all sidebar data for debugging
    const sidebarData = await page.evaluate(() => {
      const data: Record<string, string[]> = {};

      document.querySelectorAll('.wiki-details-object').forEach(section => {
        const header = section.querySelector('h3')?.textContent?.trim();
        if (header) {
          const items: string[] = [];
          section.querySelectorAll('.wiki-item-display a').forEach(link => {
            const text = link.textContent?.trim();
            if (text && text.length > 1) items.push(text);
          });
          data[header] = items;
        }
      });

      return data;
    });

    console.log('\n=== ALL SIDEBAR DATA ===');
    console.log(JSON.stringify(sidebarData, null, 2));

    // Keep browser open briefly
    console.log('\n--- Browser will stay open for 10 seconds ---');
    await randomDelay(10000, 10000);

  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

main().catch(console.error);
