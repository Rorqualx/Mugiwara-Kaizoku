/**
 * Find the SELECTED themes (not all options)
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
  console.log('Finding SELECTED themes...\n');

  const browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  try {
    const page = browser.pages()[0] || await browser.newPage();

    await page.goto('https://comicvine.gamespot.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 3000);

    await page.goto('https://comicvine.gamespot.com/fire-force/4050-95557/', { waitUntil: 'domcontentloaded' });
    await randomDelay(3000, 4000);

    // Find the themes in the Volume details section (displayed, not form)
    const themesData = await page.evaluate(() => {
      const result: Record<string, unknown> = {};

      // The displayed themes should be in the .wiki-details section as links or text
      // Look for "Themes" row in the table-like structure
      const wikiDetails = document.querySelector('.wiki-details');
      if (wikiDetails) {
        result.wikiDetailsHtml = wikiDetails.innerHTML.substring(0, 3000);
      }

      // Look for all dt/dd pairs and their structure
      const dtDdPairs: Array<{label: string, ddHtml: string, ddText: string}> = [];
      document.querySelectorAll('.wiki-details dt, .aside dt').forEach(dt => {
        const label = dt.textContent?.trim() || '';
        const dd = dt.nextElementSibling;
        if (dd?.tagName === 'DD') {
          dtDdPairs.push({
            label,
            ddHtml: dd.innerHTML?.substring(0, 500) || '',
            ddText: dd.textContent?.trim().substring(0, 200) || ''
          });
        }
      });
      result.dtDdPairs = dtDdPairs;

      // Specifically find Themes row - the VALUE should be links
      let selectedThemes: string[] = [];
      document.querySelectorAll('dt').forEach(dt => {
        const label = dt.textContent?.trim()?.toLowerCase();
        if (label === 'themes' || label === 'volume themes') {
          const dd = dt.nextElementSibling;
          if (dd?.tagName === 'DD') {
            // Get the links in the dd (these should be the selected themes)
            dd.querySelectorAll('a').forEach(link => {
              const text = link.textContent?.trim();
              if (text && text.length > 1) {
                selectedThemes.push(text);
              }
            });

            // If no links, check for display items (not form options)
            if (selectedThemes.length === 0) {
              // Look for displayed values, not form inputs
              const displayDiv = dd.querySelector('.wiki-item-display, [class*="display"], [class*="value"]');
              if (displayDiv) {
                displayDiv.querySelectorAll('a').forEach(link => {
                  const text = link.textContent?.trim();
                  if (text && text.length > 1) {
                    selectedThemes.push(text);
                  }
                });
              }
            }
          }
        }
      });
      result.selectedThemes = selectedThemes;

      // Also try getting from the visible table/list in sidebar
      const volumeDetailsSection = document.querySelector('.wiki-details');
      if (volumeDetailsSection) {
        // Look for rows where label is "Themes"
        volumeDetailsSection.querySelectorAll('tr, .row, dl').forEach(row => {
          const text = row.textContent || '';
          if (text.toLowerCase().includes('themes')) {
            result.themesRowHtml = row.innerHTML?.substring(0, 500);
          }
        });
      }

      return result;
    });

    console.log('=== THEMES DATA ===\n');
    console.log('Selected themes found:', themesData.selectedThemes);
    console.log('\nDT/DD pairs:');
    (themesData.dtDdPairs as Array<{label: string, ddText: string}>).forEach(pair => {
      if (pair.label.toLowerCase().includes('theme')) {
        console.log(`  ${pair.label}: ${pair.ddText}`);
      }
    });
    console.log('\nThemes row HTML:', themesData.themesRowHtml);

    await randomDelay(8000, 8000);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
