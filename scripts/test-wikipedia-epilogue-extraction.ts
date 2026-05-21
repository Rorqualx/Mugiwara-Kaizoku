#!/usr/bin/env npx tsx

import axios from 'axios';
import { wikipediaVolumeExtractor } from '../src/server/services/wikipedia/wikipediaVolumeExtractor';
import { logger } from '../src/utils/logger';

async function testEpilogueExtraction() {
    logger.info('Testing epilogue extraction for Fire Force...');
    
    // Get the raw HTML to debug
    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    const url = `${apiUrl}?action=parse&page=List+of+Fire+Force+chapters&prop=text&format=json&origin=*`;
    
    const response = await axios.get(url);
    const html = response.data.parse?.text?.['*'];
    
    if (!html) {
        logger.error('Failed to get HTML');
        return;
    }
    
    // Look for the last volume in the HTML to see its chapters
    const lastVolumeMatch = html.match(/<tr[^>]*>\s*<td[^>]*>34<\/td>[\s\S]*?<\/tr>\s*<tr[^>]*>\s*<td[^>]*colspan[\s\S]*?<\/td>[\s\S]*?<\/tr>/i);
    
    if (lastVolumeMatch) {
        logger.info('\nFound Volume 34 HTML:');
        // Extract just the chapter list part
        const chapterMatch = lastVolumeMatch[0].match(/<td[^>]*colspan[^>]*>([\s\S]*?)<\/td>/);
        if (chapterMatch) {
            const chapterContent = chapterMatch[1];
            // Remove HTML tags for cleaner display
            const cleanContent = chapterContent
                .replace(/<[^>]+>/g, '')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&')
                .trim();
            
            logger.info('Chapter content in Volume 34:');
            logger.info(cleanContent.substring(0, 500) + '...');
            
            // Check for epilogues
            const epilogueMatches = cleanContent.match(/Epilogue[^\n]+/g);
            if (epilogueMatches) {
                logger.info('\nEpilogues found:');
                epilogueMatches.forEach(ep => logger.info(`  - ${ep}`));
            }
        }
    }
    
    // Now test the extractor
    logger.info('\n========================================');
    logger.info('Testing WikipediaVolumeExtractor...');
    
    const result = await wikipediaVolumeExtractor.extractVolumeData('Fire Force');
    
    if (result) {
        logger.info(`Total volumes: ${result.volumes.length}`);
        logger.info(`Total chapters extracted: ${result.totalChapters}`);
        
        // Check the last volume
        const lastVolume = result.volumes[result.volumes.length - 1];
        if (lastVolume) {
            logger.info(`\nLast volume (${lastVolume.number}):`);
            logger.info(`  Chapters: ${lastVolume.chapters?.length || 0}`);
            
            if (lastVolume.chapters && lastVolume.chapters.length > 0) {
                logger.info('  Chapter list:');
                lastVolume.chapters.forEach(ch => {
                    logger.info(`    - ${ch.number}: "${ch.title}"`);
                });
            }
            
            // Check if epilogues are present
            const epilogues = lastVolume.chapters?.filter(ch => 
                ch.number.toString().toLowerCase().includes('epilogue')
            );
            
            if (epilogues && epilogues.length > 0) {
                logger.info('\n✅ Epilogues successfully captured!');
            } else {
                logger.info('\n❌ Epilogues not found in extracted chapters');
            }
        }
        
        // Count all special chapters
        let specialCount = 0;
        result.volumes.forEach(vol => {
            if (vol.chapters) {
                vol.chapters.forEach(ch => {
                    const num = ch.number.toString().toLowerCase();
                    if (num.includes('epilogue') || num.includes('prologue') || 
                        num.includes('intro') || num.includes('special')) {
                        specialCount++;
                    }
                });
            }
        });
        
        logger.info(`\nTotal special chapters found: ${specialCount}`);
    }
}

// Run the test
testEpilogueExtraction().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
});