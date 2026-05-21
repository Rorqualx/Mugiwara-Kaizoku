/**
 * Test ComicVine with the correct Fire Force URL
 *
 * Correct volume 1 URL: https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

chromium.use(StealthPlugin());

const CORRECT_URLS = {
  homepage: 'https://comicvine.gamespot.com/',
  fireForceVolume: 'https://comicvine.gamespot.com/fire-force/4050-95669/',
  fireForceIssue1: 'https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/',
  search: 'https://comicvine.gamespot.com/search/?q=fire+force',
};

const BROWSER_DATA_DIR = path.join(os.tmpdir(), 'comicvine-browser-profile');

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Test ComicVine with Correct Fire Force URL');
  console.log('='.repeat(60));
  console.log('Target: Fire Force #1 - Fire Walk With Me (4000-557264)');

  if (!fs.existsSync(BROWSER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
  }

  const browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
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
    const page = browser.pages()[0] || await browser.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    // Step 1: Visit homepage first (establishes session)
    console.log('\n--- Step 1: Visit homepage ---');
    await page.goto(CORRECT_URLS.homepage, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    // Scroll around like a human
    await page.evaluate(() => window.scrollTo(0, 300));
    await randomDelay(500, 800);
    await page.evaluate(() => window.scrollTo(0, 0));
    await randomDelay(500, 800);

    // Step 2: Navigate to Fire Force Issue #1 (correct URL)
    console.log('\n--- Step 2: Navigate to Fire Force Issue #1 ---');
    console.log('URL:', CORRECT_URLS.fireForceIssue1);
    await page.goto(CORRECT_URLS.fireForceIssue1, { waitUntil: 'domcontentloaded' });
    await randomDelay(3000, 4000);

    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log('\nPage title:', pageTitle);
    console.log('Page URL:', pageUrl);

    // Check if we got the right page
    const isCorrect = pageTitle.toLowerCase().includes('fire force');
    console.log('Correct page?:', isCorrect ? 'YES!' : 'NO - Got wrong page');

    // Take screenshot
    await page.screenshot({ path: '/tmp/comicvine-fire-force-correct.png', fullPage: true });
    console.log('Screenshot saved to /tmp/comicvine-fire-force-correct.png');

    if (isCorrect) {
      // Step 3: Extract all metadata from the page
      console.log('\n--- Step 3: Extract metadata ---');

      const metadata = await page.evaluate(() => {
        const data: Record<string, unknown> = {};

        // Get page title
        data.title = document.querySelector('h1')?.textContent?.trim();

        // Get description/summary
        const descSection = document.querySelector('.wiki-details .js-toc-content, .wiki-content-block');
        data.description = descSection?.textContent?.trim().substring(0, 500);

        // Extract concepts
        const concepts: string[] = [];
        document.querySelectorAll('a[href*="/concept/"], a[href*="/4015-"]').forEach(link => {
          const text = link.textContent?.trim();
          if (text && !concepts.includes(text)) {
            concepts.push(text);
          }
        });
        data.concepts = concepts;

        // Extract characters
        const characters: string[] = [];
        document.querySelectorAll('a[href*="/4005-"]').forEach(link => {
          const text = link.textContent?.trim();
          if (text && !characters.includes(text) && text.length > 1) {
            characters.push(text);
          }
        });
        data.characters = characters.slice(0, 10);

        // Extract locations
        const locations: string[] = [];
        document.querySelectorAll('a[href*="/location/"], a[href*="/4020-"]').forEach(link => {
          const text = link.textContent?.trim();
          if (text && !locations.includes(text)) {
            locations.push(text);
          }
        });
        data.locations = locations;

        // Extract objects
        const objects: string[] = [];
        document.querySelectorAll('a[href*="/object/"], a[href*="/4055-"]').forEach(link => {
          const text = link.textContent?.trim();
          if (text && !objects.includes(text)) {
            objects.push(text);
          }
        });
        data.objects = objects;

        // Extract story arcs
        const storyArcs: string[] = [];
        document.querySelectorAll('a[href*="/story-arc/"], a[href*="/4045-"]').forEach(link => {
          const text = link.textContent?.trim();
          if (text && !storyArcs.includes(text)) {
            storyArcs.push(text);
          }
        });
        data.storyArcs = storyArcs;

        // Get sidebar sections
        const sidebarData: Record<string, string[]> = {};
        document.querySelectorAll('.wiki-details-object').forEach(section => {
          const header = section.querySelector('h3')?.textContent?.trim();
          if (header) {
            const items: string[] = [];
            section.querySelectorAll('.wiki-item-display a').forEach(link => {
              const text = link.textContent?.trim();
              if (text && text.length > 1) items.push(text);
            });
            if (items.length > 0) {
              sidebarData[header] = items;
            }
          }
        });
        data.sidebarSections = sidebarData;

        // Get issue details
        const issueDetails: Record<string, string> = {};
        document.querySelectorAll('.aside dt, .issue-details dt').forEach(dt => {
          const label = dt.textContent?.trim();
          const value = (dt.nextElementSibling as HTMLElement)?.textContent?.trim();
          if (label && value) {
            issueDetails[label] = value;
          }
        });
        data.issueDetails = issueDetails;

        return data;
      });

      console.log('\n=== EXTRACTED METADATA ===');
      console.log(JSON.stringify(metadata, null, 2));

      // Step 4: Navigate to the volume page to compare
      console.log('\n--- Step 4: Navigate to volume page ---');
      await page.goto(CORRECT_URLS.fireForceVolume, { waitUntil: 'domcontentloaded' });
      await randomDelay(3000, 4000);

      const volumeTitle = await page.title();
      console.log('Volume page title:', volumeTitle);
      console.log('Volume correct?:', volumeTitle.toLowerCase().includes('fire force') ? 'YES!' : 'NO');

      // Take screenshot
      await page.screenshot({ path: '/tmp/comicvine-fire-force-volume.png', fullPage: true });
      console.log('Screenshot saved to /tmp/comicvine-fire-force-volume.png');

      // Extract volume data
      const volumeData = await page.evaluate(() => {
        const data: Record<string, unknown> = {};
        data.title = document.querySelector('h1')?.textContent?.trim();

        // Count issues
        const issueLinks = document.querySelectorAll('a[href*="/4000-"]');
        data.issueCount = issueLinks.length;

        // Get some issue titles
        const issues: string[] = [];
        issueLinks.forEach(link => {
          const text = link.textContent?.trim();
          if (text && !issues.includes(text)) {
            issues.push(text);
          }
        });
        data.sampleIssues = issues.slice(0, 10);

        return data;
      });

      console.log('\n=== VOLUME DATA ===');
      console.log(JSON.stringify(volumeData, null, 2));
    }

    // Keep browser open briefly
    console.log('\n--- Browser will stay open for 10 seconds ---');
    await randomDelay(10000, 10000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

main().catch(console.error);
