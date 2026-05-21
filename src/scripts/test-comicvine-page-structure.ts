#!/usr/bin/env npx tsx

/**
 * Test script to analyze ComicVine page structure
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

async function testComicVineStructure(): Promise<void> {
  logger.info('=== Testing ComicVine Page Structure ===\n');

  // Test series page
  const seriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';
  logger.info('Fetching series page:', seriesUrl);
  
  try {
    const seriesResponse = await axios.get(seriesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(seriesResponse.data as string);
    
    // Look for volume/issue links
    logger.info('\n=== Volume/Issue Links on Series Page ===');
    const volumeLinks: string[] = [];
    
    // Try different selectors for issue links
    const selectors = [
      'a[href*="/4000-"]',  // Links with 4000- pattern (individual issues)
      '.issue-list a',
      '.volume-issues a',
      'ul.issue-list li a'
    ];
    
    selectors.forEach(selector => {
      $(selector).each((i, el) => {
        const href = $(el).attr('href');
        if (href?.includes('/4000-')) {
          const fullUrl = href.startsWith('http') ? href : `https://comicvine.gamespot.com${href}`;
          if (!volumeLinks.includes(fullUrl)) {
            volumeLinks.push(fullUrl);
          }
        }
      });
    });
    
    logger.info(`Found ${volumeLinks.length} volume links`);
    logger.info('First 5 volume links:');
    volumeLinks.slice(0, 5).forEach(link => logger.info('  -', link));
    
    // Now test a volume page
    const volumeUrl = 'https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/';
    logger.info('\n=== Testing Volume Page ===');
    logger.info('Fetching volume page:', volumeUrl);
    
    const volumeResponse = await axios.get(volumeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const v$ = cheerio.load(volumeResponse.data as string);
    
    // Look for chapter information
    logger.info('\n=== Looking for Chapter Data ===');
    
    // Check the description/content area
    const contentSelectors = [
      '.wiki-details',
      '.issue-details',
      '.content-body',
      'h3:contains("Contents")',
      'h3:contains("Chapters")',
      'h3:contains("Stories")',
      'h4:contains("Contents")',
      'h4:contains("Chapters")',
      '.issue-story-list',
      '.story-list'
    ];
    
    contentSelectors.forEach(selector => {
      const elements = v$(selector);
      if (elements.length > 0) {
        logger.info(`\nFound with selector "${selector}":`);
        elements.each((i, el) => {
          const text = v$(el).text().trim();
          if (text.length > 0) {
            logger.info(`  ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
            
            // If it's a header, check the next element
            if (selector.includes('h3') || selector.includes('h4')) {
              const nextEl = v$(el).next();
              if (nextEl.length > 0) {
                logger.info('  Next element:', nextEl.prop('tagName'));
                if (nextEl.is('ul, ol')) {
                  logger.info('  List items:');
                  nextEl.find('li').each((j, li) => {
                    if (j < 5) {  // First 5 items
                      logger.info('    -', v$(li).text().trim());
                    }
                  });
                }
              }
            }
          }
        });
      }
    });
    
    // Look for any text containing chapter patterns
    logger.info('\n=== Text containing chapter patterns ===');
    const bodyText = v$('body').text();
    const chapterMatches = bodyText.match(/Chapter\s+[IVX\d]+[^.]*\./gi);
    if (chapterMatches) {
      logger.info('Found chapter mentions:');
      chapterMatches.slice(0, 10).forEach(match => {
        logger.info('  -', match);
      });
    }
    
    // Check for Roman numerals
    const romanMatches = bodyText.match(/\b[IVX]+\.\s+[A-Z][^.]*\./g);
    if (romanMatches) {
      logger.info('\nFound Roman numeral patterns:');
      romanMatches.slice(0, 10).forEach(match => {
        logger.info('  -', match);
      });
    }
    
  } catch (error: unknown) {
    console.error('Error:', error);
  }
}

void testComicVineStructure();