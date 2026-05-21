/**
 * Find where themes are located on ComicVine pages
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

async function main(): Promise<void> {
  console.log('Finding themes on ComicVine...\n');

  if (fs.existsSync(BROWSER_DATA_DIR)) {
    fs.rmSync(BROWSER_DATA_DIR, { recursive: true });
  }
  fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });

  const browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  try {
    const page = browser.pages()[0] || await browser.newPage();

    // Homepage first
    await page.goto('https://comicvine.gamespot.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    // Go to Fire Force volume
    await page.goto('https://comicvine.gamespot.com/fire-force/4050-95557/', { waitUntil: 'domcontentloaded' });
    await randomDelay(3000, 4000);

    console.log('Page title:', await page.title());

    // Find ALL sections on the page - look for themes, genres, infobox
    const pageStructure = await page.evaluate(() => {
      const result: Record<string, unknown> = {};

      // Get all text that contains "theme" or "genre"
      const themeMatches: string[] = [];
      const allText = document.body.innerText;
      const lines = allText.split('\n');
      lines.forEach((line, i) => {
        if (line.toLowerCase().includes('theme') || line.toLowerCase().includes('genre')) {
          themeMatches.push(`Line ${i}: ${line.trim()}`);
        }
      });
      result.themeTextMatches = themeMatches.slice(0, 20);

      // Get all h3, h4 headers to find section names
      const headers: string[] = [];
      document.querySelectorAll('h2, h3, h4, dt, .header, [class*="title"]').forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length < 50) {
          headers.push(`${el.tagName}.${el.className}: ${text}`);
        }
      });
      result.headers = headers;

      // Get right sidebar / aside content
      const asideContent: string[] = [];
      document.querySelectorAll('aside, [class*="sidebar"], [class*="aside"], [class*="detail"]').forEach(el => {
        asideContent.push(el.className + ': ' + el.textContent?.substring(0, 200));
      });
      result.asideContent = asideContent.slice(0, 10);

      // Look for infobox specifically
      const infoboxContent: string[] = [];
      document.querySelectorAll('[class*="infobox"], [class*="info-box"], .pod, [class*="volume-detail"]').forEach(el => {
        infoboxContent.push(el.className + ': ' + el.textContent?.substring(0, 300));
      });
      result.infoboxContent = infoboxContent;

      // Get all dt/dd pairs (definition lists often used for metadata)
      const dtDdPairs: Array<{label: string, value: string}> = [];
      document.querySelectorAll('dt').forEach(dt => {
        const label = dt.textContent?.trim() || '';
        const dd = dt.nextElementSibling;
        if (dd?.tagName === 'DD') {
          dtDdPairs.push({
            label,
            value: dd.textContent?.trim().substring(0, 100) || ''
          });
        }
      });
      result.dtDdPairs = dtDdPairs;

      // Look for any element containing "Themes" as text
      const themesElements: string[] = [];
      document.querySelectorAll('*').forEach(el => {
        const ownText = el.childNodes[0]?.textContent?.trim();
        if (ownText?.toLowerCase() === 'themes' || ownText?.toLowerCase() === 'theme') {
          themesElements.push(`${el.tagName}.${el.className}: parent=${el.parentElement?.className}`);
        }
      });
      result.themesElements = themesElements;

      // Get the full right column HTML structure
      const rightColumn = document.querySelector('.pod-listing, [class*="right"], aside');
      result.rightColumnClasses = rightColumn?.className;

      return result;
    });

    console.log('\n=== PAGE STRUCTURE ===\n');
    console.log(JSON.stringify(pageStructure, null, 2));

    // Take screenshot
    await page.screenshot({ path: '/tmp/comicvine-themes-search.png', fullPage: true });
    console.log('\nScreenshot: /tmp/comicvine-themes-search.png');

    // Keep open
    await randomDelay(10000, 10000);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
