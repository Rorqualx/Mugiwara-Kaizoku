#!/usr/bin/env npx tsx

import { logger } from '../src/utils/logger';
import { wikipediaService } from '../src/server/services/wikipedia/WikipediaService';

async function testWikipediaIntegration() {
    logger.info('Testing enhanced Wikipedia integration with Fire Force...\n');
    
    try {
        // Test findBestMatch with Fire Force
        const result = await wikipediaService.findBestMatch('Fire Force');
        
        if (result) {
            logger.info('✅ Wikipedia integration successful!');
            logger.info(`Title: ${result.title}`);
            logger.info(`Volumes: ${result.volumes || 'N/A'}`);
            logger.info(`Chapters: ${result.chapters || 'N/A'}`);
            logger.info(`Publisher: ${result.publisher || 'N/A'}`);
            logger.info(`English Publisher: ${result.englishPublisher || 'N/A'}`);
            logger.info(`Status: ${result.status || 'N/A'}`);
            
            if (result.volumeList && result.volumeList.length > 0) {
                logger.info(`\nVolume List: ${result.volumeList.length} volumes found`);
                
                // Show first 3 volumes
                result.volumeList.slice(0, 3).forEach((vol: any) => {
                    logger.info(`\nVolume ${vol.number}:`);
                    if (vol.title) logger.info(`  Title: ${vol.title}`);
                    if (vol.alternativeTitles?.length > 0) {
                        logger.info(`  Alt Titles: ${vol.alternativeTitles.join(', ')}`);
                    }
                    if (vol.originalReleaseDate) logger.info(`  Release: ${vol.originalReleaseDate}`);
                    if (vol.isbn) logger.info(`  ISBN: ${vol.isbn}`);
                    if (vol.chapters?.length > 0) {
                        logger.info(`  Chapters: ${vol.chapters.length}`);
                        const firstChapter = vol.chapters[0];
                        if (firstChapter) {
                            logger.info(`    First: Ch.${firstChapter.number} - ${firstChapter.title || 'No title'}`);
                        }
                    }
                });
                
                // Calculate total chapters from volumes
                const totalChapters = result.volumeList.reduce((sum: number, vol: any) => 
                    sum + (vol.chapters?.length || 0), 0);
                logger.info(`\nTotal chapters across all volumes: ${totalChapters}`);
            } else {
                logger.info('\n❌ No volume list found');
            }
            
            if (result.chapterList && result.chapterList.length > 0) {
                logger.info(`\nChapter List: ${result.chapterList.length} chapters found`);
                // Show first 3 chapters
                result.chapterList.slice(0, 3).forEach((ch: any) => {
                    logger.info(`  Ch.${ch.number}: ${ch.title || 'No title'}`);
                });
            }
        } else {
            logger.error('❌ Failed to find Wikipedia data for Fire Force');
        }
    } catch (error) {
        logger.error('Test failed:', error);
    }
}

// Run the test
testWikipediaIntegration().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
});