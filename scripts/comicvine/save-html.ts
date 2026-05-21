/**
 * Save ComicVine HTML for inspection
 *
 * Fetches a volume page and saves the raw HTML to understand the structure
 */

import { ComicVineScrapingService } from '@/server/services/comicvine/scrapingService';
import { logger } from '@/utils/logger';

async function saveHtml() {
  const scraper = new ComicVineScrapingService();
  const volumeUrl = 'https://comicvine.gamespot.com/naruto-1-the-tests-of-the-ninja/4000-111264/';

  logger.info(`Fetching: ${volumeUrl}`);

  const $ = await scraper.fetchPage(volumeUrl);
  if (!$) {
    logger.error('Failed to fetch page');
    process.exit(1);
  }

  // Save full HTML
  const html = $.html();
  const outputPath = '/tmp/comicvine-naruto-vol1.html';
  await Bun.write(outputPath, html);
  logger.info(`Saved full HTML to: ${outputPath}`);

  await analyzePageStructure($);
}

async function analyzePageStructure($: cheerio.CheerioAPI): Promise<void> {
  // Look for any h2 headings
  logger.info('\n=== All H2 Headings ===');
  $('h2').each((idx, el) => {
    logger.info(`${idx + 1}. "${$(el).text().trim()}"`);
  });

  // Look for any list elements
  logger.info('\n=== List Elements ===');
  logger.info(`<ul> elements: ${$('ul').length}`);
  logger.info(`<ol> elements: ${$('ol').length}`);
  logger.info(`<li> elements: ${$('li').length}`);

  await searchForChapterPatterns($);
  await checkMainContent($);
}

async function searchForChapterPatterns($: cheerio.CheerioAPI): Promise<void> {
  const html = $.html();
  const bodyText = $('body').text();

  // Look for chapter-related text
  logger.info('\n=== Searching for "chapter" in page ===');
  const chapterCount = (bodyText.toLowerCase().match(/chapter/g) ?? []).length;
  logger.info(`Found "chapter" ${chapterCount} times in body text`);

  // Look for common chapter patterns in HTML
  logger.info('\n=== Searching for Chapter Patterns in HTML ===');
  const chapterPatterns = [
    'Chapter 1',
    'Chapter One',
    'Chapter:',
    'Ch.',
    '#1',
    'Issue #',
  ];

  const htmlLower = html.toLowerCase();
  chapterPatterns.forEach((pattern) => {
    const count = (htmlLower.match(new RegExp(pattern.toLowerCase(), 'g')) ?? []).length;
    if (count > 0) {
      logger.info(`"${pattern}": ${count} occurrences`);
    }
  });
}

async function checkMainContent($: cheerio.CheerioAPI): Promise<void> {
  // Check for wiki-item-display (main content area)
  logger.info('\n=== Main Content Area ===');
  const wikiContent = $('.wiki-item-display');
  logger.info(`wiki-item-display found: ${wikiContent.length > 0 ? 'YES' : 'NO'}`);
  if (wikiContent.length > 0) {
    const textLength = wikiContent.text().length;
    logger.info(`Content length: ${textLength} chars`);
    logger.info(`First 500 chars: ${wikiContent.text().substring(0, 500)}...`);
  }

  logger.info(`\n✓ HTML saved. You can now inspect /tmp/comicvine-naruto-vol1.html`);
}

saveHtml()
  .catch(logger.error)
  .finally(() => process.exit(0));
