/**
 * Debug Chapter Parser
 *
 * Test chapter parsing on a single volume with detailed logging
 */

import { ComicVineScrapingService } from '@/server/services/comicvine/scrapingService';
import { parseChaptersFromLists } from '@/server/services/comicvine/list-parser';
import { parseChaptersFromText } from '@/server/services/comicvine/text-parser';
import { mergeAndProcessChapters } from '@/server/services/comicvine/chapter-merger';
import { logger } from '@/utils/logger';
import * as cheerio from 'cheerio';

async function debugChapterParser() {
  const scraper = new ComicVineScrapingService();
  const volumeUrl = 'https://comicvine.gamespot.com/naruto-1-the-tests-of-the-ninja/4000-111264/';

  logger.info(`=== Debugging Chapter Parser ===`);
  logger.info(`URL: ${volumeUrl}\n`);

  // Get HTML
  const $ = await scraper.fetchPage(volumeUrl);
  if (!$) {
    logger.error('Failed to fetch page');
    process.exit(1);
  }

  // Find the chapter section
  const chapterSection = $('h2:contains("Chapter Titles")').first();
  if (chapterSection.length === 0) {
    logger.error('Chapter Titles section not found');
    process.exit(1);
  }

  const chapterList = chapterSection.nextAll('ul, ol').first();
  if (chapterList.length === 0) {
    logger.error('Chapter list not found');
    process.exit(1);
  }

  const listItems = chapterList.find('li');
  logger.info(`Found ${listItems.length} list items\n`);

  // Log raw text
  logger.info('=== Raw List Item Text ===');
  listItems.each((idx, el) => {
    const text = $(el).text().trim();
    const html = $(el).html();
    logger.info(`${idx + 1}. Text: "${text}"`);
    logger.info(`   HTML: ${html?.substring(0, 100)}...`);
  });

  // Parse with list parser
  logger.info('\n=== parseChaptersFromLists() ===');
  const chaptersFromLists = parseChaptersFromLists($);
  logger.info(`Returned ${chaptersFromLists.length} chapters`);
  chaptersFromLists.forEach((ch, idx) => {
    logger.info(`  ${idx + 1}. [${ch.number}] "${ch.title}" ${ch.isSpecial ? '(SPECIAL)' : ''}`);
  });

  // Parse with text parser
  logger.info('\n=== parseChaptersFromText() ===');
  const bodyText = $('.wiki-item-display').text() || $('body').text();
  const chaptersFromText = parseChaptersFromText(bodyText);
  logger.info(`Returned ${chaptersFromText.length} chapters`);
  chaptersFromText.slice(0, 5).forEach((ch, idx) => {
    logger.info(`  ${idx + 1}. [${ch.number}] "${ch.title}"`);
  });

  // Merge
  logger.info('\n=== mergeAndProcessChapters() ===');
  const mergedChapters = mergeAndProcessChapters(chaptersFromLists, chaptersFromText);
  logger.info(`Returned ${mergedChapters.length} chapters`);
  mergedChapters.forEach((ch, idx) => {
    logger.info(`  ${idx + 1}. [${ch.number}] "${ch.title}"`);
  });

  logger.info('\n=== Analysis ===');
  logger.info(`parseChaptersFromLists returned: ${chaptersFromLists.length} chapters`);
  logger.info(`parseChaptersFromText returned: ${chaptersFromText.length} chapters`);
  logger.info(`mergeAndProcessChapters returned: ${mergedChapters.length} chapters`);
  logger.info(`Expected: ~8-10 chapters for Naruto Volume 1`);
}

debugChapterParser()
  .catch(logger.error)
  .finally(() => process.exit(0));
