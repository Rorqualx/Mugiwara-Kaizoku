/**
 * Direct ComicVine Scraping - Correct Fire Force URL
 *
 * Volume: https://comicvine.gamespot.com/fire-force/4050-95557/
 * Issue 1: https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

chromium.use(StealthPlugin());

const BROWSER_DATA_DIR = path.join(os.tmpdir(), 'comicvine-browser-profile');

const URLS = {
  homepage: 'https://comicvine.gamespot.com/',
  volume: 'https://comicvine.gamespot.com/fire-force/4050-95557/',
  issue1: 'https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/',
};

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Direct ComicVine Scrape - Fire Force');
  console.log('='.repeat(60));
  console.log('Volume URL:', URLS.volume);
  console.log('Issue 1 URL:', URLS.issue1);

  // Clear browser profile for fresh start
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

  try {
    const page = browser.pages()[0] || await browser.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    // Step 1: Visit homepage
    console.log('\n--- Step 1: Visit homepage ---');
    await page.goto(URLS.homepage, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);
    await page.evaluate(() => window.scrollTo(0, 300));
    await randomDelay(500, 800);

    // Step 2: Go to volume page
    console.log('\n--- Step 2: Navigate to Fire Force volume ---');
    await page.goto(URLS.volume, { waitUntil: 'domcontentloaded' });
    await randomDelay(3000, 4000);

    const volumeTitle = await page.title();
    console.log('Volume title:', volumeTitle);
    console.log('Correct page?', volumeTitle.toLowerCase().includes('fire force') ? 'YES!' : 'NO');

    await page.screenshot({ path: '/tmp/comicvine-ff-volume.png', fullPage: true });
    console.log('Screenshot: /tmp/comicvine-ff-volume.png');

    // Extract issue links from volume page
    const issueLinks = await page.evaluate(() => {
      const links: Array<{text: string, href: string}> = [];
      document.querySelectorAll('a[href*="/4000-"]').forEach(link => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';
        if (href.includes('fire-force') && text) {
          links.push({ text: text.substring(0, 50), href });
        }
      });
      return links.slice(0, 10);
    });

    console.log('\nIssue links found on volume page:');
    issueLinks.forEach(l => console.log(`  ${l.text} -> ${l.href}`));

    // Step 3: Go to issue #1
    console.log('\n--- Step 3: Navigate to Issue #1 ---');
    await page.goto(URLS.issue1, { waitUntil: 'domcontentloaded' });
    await randomDelay(3000, 4000);

    const issueTitle = await page.title();
    console.log('Issue title:', issueTitle);
    console.log('Correct page?', issueTitle.toLowerCase().includes('fire force') ? 'YES!' : 'NO');

    await page.screenshot({ path: '/tmp/comicvine-ff-issue1.png', fullPage: true });
    console.log('Screenshot: /tmp/comicvine-ff-issue1.png');

    // Step 4: Extract all data from issue page
    console.log('\n--- Step 4: Extract data ---');

    const extractedData = await page.evaluate(() => {
      const data: Record<string, unknown> = {};

      // Title
      data.title = document.querySelector('h1')?.textContent?.trim();

      // Concepts
      const concepts: string[] = [];
      document.querySelectorAll('a[href*="/concept/"], a[href*="/4015-"]').forEach(link => {
        const text = link.textContent?.trim();
        if (text && !concepts.includes(text)) concepts.push(text);
      });
      data.concepts = concepts;

      // Characters
      const characters: string[] = [];
      document.querySelectorAll('a[href*="/4005-"]').forEach(link => {
        const text = link.textContent?.trim();
        if (text && !characters.includes(text) && text.length > 1) characters.push(text);
      });
      data.characters = characters.slice(0, 15);

      // Locations
      const locations: string[] = [];
      document.querySelectorAll('a[href*="/location/"], a[href*="/4020-"]').forEach(link => {
        const text = link.textContent?.trim();
        if (text && !locations.includes(text)) locations.push(text);
      });
      data.locations = locations;

      // Objects
      const objects: string[] = [];
      document.querySelectorAll('a[href*="/object/"], a[href*="/4055-"]').forEach(link => {
        const text = link.textContent?.trim();
        if (text && !objects.includes(text)) objects.push(text);
      });
      data.objects = objects;

      // Story arcs
      const storyArcs: string[] = [];
      document.querySelectorAll('a[href*="/story-arc/"], a[href*="/4045-"]').forEach(link => {
        const text = link.textContent?.trim();
        if (text && !storyArcs.includes(text)) storyArcs.push(text);
      });
      data.storyArcs = storyArcs;

      // Teams
      const teams: string[] = [];
      document.querySelectorAll('a[href*="/team/"], a[href*="/4060-"]').forEach(link => {
        const text = link.textContent?.trim();
        if (text && !teams.includes(text)) teams.push(text);
      });
      data.teams = teams;

      // All sidebar sections
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

    console.log('\n=== EXTRACTED DATA ===');
    console.log(JSON.stringify(extractedData, null, 2));

    // Keep browser open
    console.log('\n--- Browser open for 10 seconds ---');
    await randomDelay(10000, 10000);

  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

main().catch(console.error);
