#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../src/utils/logger';

// Chapters that are reportedly missing
const missingChapters = [5, 6, 7, 148, 149, 150, 151, 163, 164, 165, 166, 178, 196];

async function testFireForceDirect() {
    logger.info('🔍 Testing Fire Force Fandom direct chapter extraction...\n');
    
    try {
        // Fetch the List of Volumes page
        const volumeListUrl = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
        logger.info(`Fetching: ${volumeListUrl}`);
        
        const response = await axios.get(volumeListUrl);
        const $ = cheerio.load(response.data);
        
        // Look for all chapter references in various formats
        const chapters = new Set<number>();
        
        // Method 1: Look for "Chapter X" text patterns
        $('*').each((_, elem) => {
            const text = $(elem).text();
            const matches = text.matchAll(/Chapter\s+(\d+)/gi);
            for (const match of matches) {
                const num = parseInt(match[1]);
                if (num > 0 && num <= 305) {
                    chapters.add(num);
                }
            }
        });
        
        logger.info(`\n📊 Extraction Results:`);
        logger.info(`Found ${chapters.size} unique chapters using text pattern`);
        
        // Method 2: Look in table cells specifically
        const tableChapters = new Set<number>();
        $('table td, table th').each((_, elem) => {
            const text = $(elem).text();
            const matches = text.matchAll(/Chapter\s+(\d+)/gi);
            for (const match of matches) {
                const num = parseInt(match[1]);
                if (num > 0 && num <= 305) {
                    tableChapters.add(num);
                }
            }
        });
        
        logger.info(`Found ${tableChapters.size} chapters in table cells`);
        
        // Method 3: Look in links
        const linkChapters = new Set<number>();
        $('a').each((_, elem) => {
            const text = $(elem).text();
            const href = $(elem).attr('href') || '';
            const fullText = text + ' ' + href;
            const matches = fullText.matchAll(/Chapter[_\s]+(\d+)/gi);
            for (const match of matches) {
                const num = parseInt(match[1]);
                if (num > 0 && num <= 305) {
                    linkChapters.add(num);
                }
            }
        });
        
        logger.info(`Found ${linkChapters.size} chapters in links`);
        
        // Method 4: Look in tab panels
        const tabChapters = new Set<number>();
        $('.tabber-panel, .wds-tab__content, .mw-collapsible-content').each((_, elem) => {
            const text = $(elem).text();
            const matches = text.matchAll(/Chapter\s+(\d+)/gi);
            for (const match of matches) {
                const num = parseInt(match[1]);
                if (num > 0 && num <= 305) {
                    tabChapters.add(num);
                }
            }
        });
        
        logger.info(`Found ${tabChapters.size} chapters in tab panels`);
        
        // Combine all found chapters
        const allChapters = new Set([...chapters, ...tableChapters, ...linkChapters, ...tabChapters]);
        const sortedChapters = Array.from(allChapters).sort((a, b) => a - b);
        
        logger.info(`\n📋 Combined Results:`);
        logger.info(`Total unique chapters found: ${sortedChapters.length}`);
        if (sortedChapters.length > 0) {
            logger.info(`Chapter range: ${sortedChapters[0]} - ${sortedChapters[sortedChapters.length - 1]}`);
        }
        
        // Check for missing chapters
        logger.info(`\n🔍 Checking for reported missing chapters:`);
        const foundMissing: number[] = [];
        const stillMissing: number[] = [];
        
        for (const chapter of missingChapters) {
            if (allChapters.has(chapter)) {
                foundMissing.push(chapter);
            } else {
                stillMissing.push(chapter);
            }
        }
        
        if (foundMissing.length > 0) {
            logger.info(`✅ Found these chapters: ${foundMissing.join(', ')}`);
        }
        
        if (stillMissing.length > 0) {
            logger.warn(`❌ Not found on page: ${stillMissing.join(', ')}`);
            
            // Let's check if these chapters exist in the HTML at all
            logger.info(`\n🔎 Searching raw HTML for missing chapters...`);
            const html = response.data;
            
            for (const chapter of stillMissing) {
                const patterns = [
                    `Chapter ${chapter}`,
                    `Chapter_${chapter}`,
                    `"Chapter ${chapter}"`,
                    `>Chapter ${chapter}<`,
                    `Chapter%20${chapter}`
                ];
                
                let found = false;
                for (const pattern of patterns) {
                    if (html.includes(pattern)) {
                        found = true;
                        const index = html.indexOf(pattern);
                        const snippet = html.substring(Math.max(0, index - 100), Math.min(html.length, index + 100));
                        logger.info(`Found "Chapter ${chapter}" in raw HTML but not extracted properly`);
                        logger.debug(`Context: ...${snippet.replace(/\s+/g, ' ').substring(0, 150)}...`);
                        break;
                    }
                }
                
                if (!found) {
                    logger.warn(`Chapter ${chapter} not found in HTML at all - might be on a different page`);
                }
            }
        }
        
        // Check for gaps in sequence
        logger.info(`\n📊 Gap Analysis:`);
        const gaps: number[] = [];
        for (let i = 1; i <= 305; i++) {
            if (!allChapters.has(i)) {
                gaps.push(i);
            }
        }
        
        if (gaps.length > 0) {
            logger.info(`Missing ${gaps.length} chapters from sequence 1-305`);
            if (gaps.length <= 20) {
                logger.info(`Missing chapters: ${gaps.join(', ')}`);
            } else {
                logger.info(`Missing chapters: ${gaps.slice(0, 20).join(', ')}... and ${gaps.length - 20} more`);
            }
        } else {
            logger.info(`✅ No gaps found - all chapters 1-305 present`);
        }
        
        // Analyze page structure
        logger.info(`\n📄 Page Structure Analysis:`);
        logger.info(`Tables found: ${$('table').length}`);
        logger.info(`Tab containers found: ${$('.tabber, .wds-tabs, .mw-collapsible').length}`);
        logger.info(`Links found: ${$('a').length}`);
        logger.info(`Images found: ${$('img').length}`);
        
        // Look for volume-specific patterns
        const volumes = new Set<number>();
        $('*').each((_, elem) => {
            const text = $(elem).text();
            const matches = text.matchAll(/Volume\s+(\d+)/gi);
            for (const match of matches) {
                const num = parseInt(match[1]);
                if (num > 0 && num <= 34) {
                    volumes.add(num);
                }
            }
        });
        
        logger.info(`Volumes found: ${volumes.size}`);
        
    } catch (error) {
        logger.error('Error testing Fire Force:', error);
    }
}

testFireForceDirect();