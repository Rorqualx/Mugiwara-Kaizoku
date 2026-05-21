/**
 * Fandom wiki scraping test
 *
 * Fandom is more accessible than ComicVine for manga metadata
 */

import { chromium } from 'playwright';

const FANDOM_URLS = {
  mainPage: 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)',
  volumesList: 'https://fire-force.fandom.com/wiki/List_of_Volumes',
  chapter0: 'https://fire-force.fandom.com/wiki/Chapter_0',
};

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Fandom Wiki Scraper Test - Fire Force');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Test 1: Main manga page
    console.log('\n--- Test 1: Main Manga Page ---');
    console.log('URL:', FANDOM_URLS.mainPage);

    await page.goto(FANDOM_URLS.mainPage, { waitUntil: 'domcontentloaded' });
    console.log('Page title:', await page.title());

    await page.screenshot({ path: '/tmp/fandom-main.png', fullPage: true });
    console.log('Screenshot saved to /tmp/fandom-main.png');

    // Extract genres/themes from the main page
    const mainPageData = await page.evaluate(() => {
      const data: {
        title: string;
        genres: string[];
        themes: string[];
        demographic: string;
        publisher: string;
        author: string;
        summary: string;
      } = {
        title: '',
        genres: [],
        themes: [],
        demographic: '',
        publisher: '',
        author: '',
        summary: '',
      };

      // Get title
      data.title = document.querySelector('h1.page-header__title')?.textContent?.trim() || '';

      // Look for infobox data
      const infobox = document.querySelector('.portable-infobox, .infobox');
      if (infobox) {
        infobox.querySelectorAll('.pi-item, tr').forEach((row) => {
          const label = row.querySelector('.pi-data-label, th')?.textContent?.toLowerCase().trim();
          const value = row.querySelector('.pi-data-value, td')?.textContent?.trim();

          if (label && value) {
            if (label.includes('genre')) {
              data.genres = value.split(/[,\n]/).map(g => g.trim()).filter(Boolean);
            } else if (label.includes('theme')) {
              data.themes = value.split(/[,\n]/).map(t => t.trim()).filter(Boolean);
            } else if (label.includes('demographic')) {
              data.demographic = value;
            } else if (label.includes('publisher')) {
              data.publisher = value;
            } else if (label.includes('author') || label.includes('written')) {
              data.author = value;
            }
          }
        });
      }

      // Get summary from first paragraph
      const summary = document.querySelector('.mw-parser-output > p:not(.pi-empty)')?.textContent?.trim();
      if (summary) {
        data.summary = summary.substring(0, 300);
      }

      return data;
    });

    console.log('Main page data:', JSON.stringify(mainPageData, null, 2));

    // Test 2: Volumes list page
    console.log('\n--- Test 2: Volumes List Page ---');
    console.log('URL:', FANDOM_URLS.volumesList);

    await page.goto(FANDOM_URLS.volumesList, { waitUntil: 'domcontentloaded' });
    console.log('Page title:', await page.title());

    await page.screenshot({ path: '/tmp/fandom-volumes.png', fullPage: true });
    console.log('Screenshot saved to /tmp/fandom-volumes.png');

    // Extract volume information
    const volumeData = await page.evaluate(() => {
      const volumes: { number: string; title: string; chapters: string }[] = [];

      // Look for volume tables
      const tables = document.querySelectorAll('table.wikitable, table.article-table');
      tables.forEach((table) => {
        const rows = table.querySelectorAll('tr');
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const volumeNum = cells[0]?.textContent?.trim() || '';
            const title = cells[1]?.textContent?.trim() || '';
            const chapters = cells[2]?.textContent?.trim() || '';
            if (volumeNum && (volumeNum.match(/^\d+$/) || volumeNum.toLowerCase().includes('vol'))) {
              volumes.push({ number: volumeNum, title, chapters });
            }
          }
        });
      });

      // Also try list format
      if (volumes.length === 0) {
        document.querySelectorAll('.mw-parser-output > ul > li, .mw-parser-output ol > li').forEach((li) => {
          const text = li.textContent || '';
          const match = text.match(/Volume\s*(\d+)/i);
          if (match) {
            volumes.push({ number: match[1], title: text.substring(0, 100), chapters: '' });
          }
        });
      }

      return volumes.slice(0, 10); // Return first 10
    });

    console.log('Volume data (first 10):', JSON.stringify(volumeData, null, 2));

    // Test 3: Individual chapter page
    console.log('\n--- Test 3: Chapter Page ---');
    console.log('URL:', FANDOM_URLS.chapter0);

    await page.goto(FANDOM_URLS.chapter0, { waitUntil: 'domcontentloaded' });
    console.log('Page title:', await page.title());

    await page.screenshot({ path: '/tmp/fandom-chapter.png', fullPage: true });
    console.log('Screenshot saved to /tmp/fandom-chapter.png');

    // Extract chapter information
    const chapterData = await page.evaluate(() => {
      const data: {
        title: string;
        chapterNumber: string;
        volume: string;
        pages: string;
        summary: string;
      } = {
        title: '',
        chapterNumber: '',
        volume: '',
        pages: '',
        summary: '',
      };

      // Get title
      data.title = document.querySelector('h1.page-header__title')?.textContent?.trim() || '';

      // Look for infobox data
      const infobox = document.querySelector('.portable-infobox, .infobox');
      if (infobox) {
        infobox.querySelectorAll('.pi-item, tr').forEach((row) => {
          const label = row.querySelector('.pi-data-label, th')?.textContent?.toLowerCase().trim();
          const value = row.querySelector('.pi-data-value, td')?.textContent?.trim();

          if (label && value) {
            if (label.includes('chapter') || label.includes('number')) {
              data.chapterNumber = value;
            } else if (label.includes('volume')) {
              data.volume = value;
            } else if (label.includes('page')) {
              data.pages = value;
            }
          }
        });
      }

      // Get summary
      const summary = document.querySelector('.mw-parser-output > p:not(.pi-empty)')?.textContent?.trim();
      if (summary) {
        data.summary = summary.substring(0, 500);
      }

      return data;
    });

    console.log('Chapter data:', JSON.stringify(chapterData, null, 2));

    console.log('\n--- All Tests Complete ---');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

main().catch(console.error);
