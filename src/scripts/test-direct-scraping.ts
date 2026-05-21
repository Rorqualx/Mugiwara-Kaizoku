#!/usr/bin/env npx tsx

/**
 * Direct test of ComicVine scraping logic
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

async function testScraping(): Promise<void> {
  const volumeUrl = 'https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-572847/';

  logger.info('Testing scraping for:', volumeUrl);

  try {
    const response = await axios.get<string>(volumeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data as string);
    
    // Debug: Look for the title
    logger.info('\n=== Title Search ===');
    const titleSelectors = [
      'h1.page-title',
      'h1.wiki-title',
      '.wiki-page-header h1',
      'h1[data-field="name"]',
      '.js-toc-generate',
      'h1',
      '.title-container h1'
    ];
    
    titleSelectors.forEach(selector => {
      const element = $(selector);
      if (element.length > 0) {
        logger.info(`Found with ${selector}:`, element.first().text().trim());
      }
    });
    
    // Debug: Look for chapter/content sections
    logger.info('\n=== Content/Chapter Search ===');
    const contentSelectors = [
      '.wiki-content-section',
      '.content-section',
      '#wiki-content',
      '.issue-contents',
      '.chapter-list',
      '.story-contents',
      'section',
      '[data-field="description"]'
    ];
    
    contentSelectors.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        logger.info(`Found ${elements.length} elements with selector: ${selector}`);
        elements.slice(0, 2).each((i, el) => {
          const text = $(el).text().trim().substring(0, 100);
          logger.info(`  Sample ${i + 1}: ${text}...`);
        });
      }
    });
    
    // Look for lists that might contain chapters
    logger.info('\n=== Lists that might be chapters ===');
    $('ul, ol').each((i, el) => {
      const listItems = $(el).find('li');
      if (listItems.length > 0) {
        const firstItem = listItems.first().text().trim();
        if (firstItem.toLowerCase().includes('chapter') || 
            firstItem.toLowerCase().includes('story') ||
            firstItem.toLowerCase().includes('episode')) {
          logger.info(`Found potential chapter list with ${listItems.length} items:`);
          listItems.slice(0, 3).each((j, li) => {
            logger.info(`  - ${$(li).text().trim()}`);
          });
        }
      }
    });
    
    // Look for any headers that might indicate chapters
    logger.info('\n=== Headers that might indicate chapters ===');
    $('h2, h3, h4').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('contents') || text.includes('chapter') || text.includes('table of contents')) {
        logger.info(`Found header: ${$(el).text().trim()}`);
        const nextElement = $(el).next();
        if (nextElement.length > 0) {
          logger.info(`  Next element type: ${nextElement.prop('tagName')}`);
          logger.info(`  Next element preview: ${nextElement.text().trim().substring(0, 100)}...`);
        }
      }
    });
    
  } catch (error: unknown) {
    console.error('Error:', error);
  }
}

void testScraping();