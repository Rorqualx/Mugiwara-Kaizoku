#!/usr/bin/env npx tsx

import { logger } from '../src/utils/logger';

// Chapters that are reportedly missing
const missingChapters = [5, 6, 7, 148, 149, 150, 151, 163, 164, 165, 166, 178, 196];

async function testFireForceFandomChapters() {
    logger.info('🔍 Testing Fire Force Fandom chapter extraction...\n');
    
    try {
        // Import the Fandom dynamic parser
        const { DynamicWikiParser } = await import('../src/server/services/fandom/dynamic/DynamicWikiParser');
        const parser = new DynamicWikiParser();
        
        // Get volume list page
        const volumeListUrl = 'https://fire-force.fandom.com/wiki/Chapters_and_Volumes';
        logger.info(`Fetching volume list from: ${volumeListUrl}`);
        
        const response = await fetch(volumeListUrl);
        const html = await response.text();
        
        // Extract all chapters
        const chapterRegex = /Chapter\s+(\d+)/gi;
        const allChapterNumbers: number[] = [];
        let match;
        
        while ((match = chapterRegex.exec(html)) !== null) {
            const chapterNum = parseInt(match[1]);
            if (!allChapterNumbers.includes(chapterNum)) {
                allChapterNumbers.push(chapterNum);
            }
        }
        
        allChapterNumbers.sort((a, b) => a - b);
        
        logger.info(`\n📊 Chapter Analysis:`);
        logger.info(`Total unique chapters found: ${allChapterNumbers.length}`);
        logger.info(`Chapter range: ${allChapterNumbers[0]} - ${allChapterNumbers[allChapterNumbers.length - 1]}`);
        
        // Check for missing chapters
        logger.info(`\n🔍 Checking for missing chapters:`);
        const foundMissing: number[] = [];
        const stillMissing: number[] = [];
        
        for (const chapter of missingChapters) {
            if (allChapterNumbers.includes(chapter)) {
                foundMissing.push(chapter);
            } else {
                stillMissing.push(chapter);
            }
        }
        
        if (foundMissing.length > 0) {
            logger.info(`✅ Found these "missing" chapters: ${foundMissing.join(', ')}`);
        }
        
        if (stillMissing.length > 0) {
            logger.warn(`❌ Actually missing chapters: ${stillMissing.join(', ')}`);
        }
        
        // Look for gaps in chapter numbering
        logger.info(`\n📋 Checking for gaps in chapter sequence:`);
        const gaps: number[] = [];
        for (let i = 1; i <= 305; i++) {
            if (!allChapterNumbers.includes(i)) {
                gaps.push(i);
            }
        }
        
        if (gaps.length > 0) {
            logger.warn(`Missing chapters in sequence: ${gaps.join(', ')}`);
        } else {
            logger.info(`No gaps found in chapter sequence 1-305`);
        }
        
        // Check if we're getting chapter 0
        if (allChapterNumbers.includes(0)) {
            logger.info(`\n📝 Note: Chapter 0 found (might be a prologue or special chapter)`);
        }
        
        // Try to extract chapters using the parser
        logger.info(`\n🔧 Testing dynamic parser extraction...`);
        const parsedData = await parser.extractFromWiki('fire-force');
        
        if (parsedData.chapters && parsedData.chapters.length > 0) {
            logger.info(`Parser extracted ${parsedData.chapters.length} chapters`);
            
            // Check which of the "missing" chapters the parser found
            const parserChapterNumbers = parsedData.chapters.map(ch => {
                const match = ch.title.match(/Chapter\s+(\d+)/i);
                return match ? parseInt(match[1]) : null;
            }).filter(n => n !== null) as number[];
            
            const parserFoundMissing = missingChapters.filter(ch => parserChapterNumbers.includes(ch));
            const parserStillMissing = missingChapters.filter(ch => !parserChapterNumbers.includes(ch));
            
            if (parserFoundMissing.length > 0) {
                logger.info(`✅ Parser found these "missing" chapters: ${parserFoundMissing.join(', ')}`);
            }
            
            if (parserStillMissing.length > 0) {
                logger.warn(`❌ Parser didn't find: ${parserStillMissing.join(', ')}`);
                
                // Let's check the raw HTML for these specific chapters
                logger.info(`\n🔍 Searching HTML for missing chapters directly...`);
                for (const chapter of parserStillMissing) {
                    const patterns = [
                        `Chapter ${chapter}:`,
                        `Chapter ${chapter} `,
                        `"Chapter ${chapter}"`,
                        `>Chapter ${chapter}<`
                    ];
                    
                    let found = false;
                    for (const pattern of patterns) {
                        if (html.includes(pattern)) {
                            found = true;
                            const index = html.indexOf(pattern);
                            const snippet = html.substring(Math.max(0, index - 50), Math.min(html.length, index + 100));
                            logger.info(`Found "Chapter ${chapter}" in HTML: ...${snippet}...`);
                            break;
                        }
                    }
                    
                    if (!found) {
                        logger.warn(`Chapter ${chapter} not found in HTML at all`);
                    }
                }
            }
        } else {
            logger.error(`Parser failed to extract chapters`);
        }
        
    } catch (error) {
        logger.error('Error testing Fire Force chapters:', error);
    }
}

testFireForceFandomChapters();