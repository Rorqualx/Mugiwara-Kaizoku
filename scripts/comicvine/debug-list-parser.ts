/**
 * Debug List Parser
 *
 * Directly test what the list parser finds without merger
 */

import { ComicVineScrapingService } from '@/server/services/comicvine/scrapingService';
import { parseChaptersFromLists } from '@/server/services/comicvine/list-parser';
import { parseChaptersFromText } from '@/server/services/comicvine/text-parser';
import { logger } from '@/utils/logger';
import * as cheerio from 'cheerio';

async function debugListParser() {
  const scraper = new ComicVineScrapingService();
  const volumeUrl = 'https://comicvine.gamespot.com/naruto-1-the-tests-of-the-ninja/4000-111264/';

  // Get the HTML
  const $ = await scraper.fetchPage(volumeUrl);
  if (!$) {
    logger.error('Failed to fetch page');
    process.exit(1);
  }

  // Find the chapter section
  const chapterSection = $('h2:contains("Chapter Titles")').first();
  logger.info(`Chapter section found: ${chapterSection.length > 0 ? 'YES' : 'NO'}`);

  if (chapterSection.length > 0) {
    logger.info(`Section text: "${chapterSection.text().trim()}"`);

    const chapterList = chapterSection.nextAll('ul, ol').first();
    logger.info(`Chapter list found: ${chapterList.length > 0 ? 'YES' : 'NO'}`);

    if (chapterList.length > 0) {
      const listItems = chapterList.find('li');
      logger.info(`List items found: ${listItems.length}`);

      logger.info('\n=== Raw List Item Text ===');
      listItems.each((idx, el) => {
        const text = $(el).text().trim();
        logger.info(`${idx + 1}. "${text}"`);
      });

      // Try parsing with list parser
      logger.info('\n=== Parsed Chapters ===');
      const parsedChapters = parseChaptersFromLists($);
      logger.info(`Total parsed: ${parsedChapters.length}`);
      parsedChapters.forEach((ch, idx) => {
        logger.info(`${idx + 1}. Chapter ${ch.number}: ${ch.title}`);
      });
    }
  }

  // Try text parsing
  logger.info('\n=== Text Parsing ===');
  const bodyText = $('.wiki-item-display').text() || $('body').text();
  const chaptersFromText = parseChaptersFromText(bodyText);
  logger.info(`Text parsing found: ${chaptersFromText.length} chapters`);
  chaptersFromText.slice(0, 5).forEach((ch, idx) => {
    logger.info(`${idx + 1}. Chapter ${ch.number}: ${ch.title}`);
  });
}

debugListParser()
  .catch(logger.error)
  .finally(() => process.exit(0));
