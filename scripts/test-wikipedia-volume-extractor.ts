#!/usr/bin/env npx tsx

import { wikipediaVolumeExtractor } from '../src/server/services/wikipedia/wikipediaVolumeExtractor';
import { logger } from '../src/utils/logger';

async function testWikipediaVolumeExtractor() {
    logger.info('Testing Wikipedia Volume Extractor for Fire Force...\n');
    
    // Test with Fire Force
    const result = await wikipediaVolumeExtractor.extractVolumeData('Fire Force');
    
    if (result) {
        logger.info('Extraction successful!');
        logger.info(`Total volumes found: ${result.totalVolumes}`);
        logger.info(`Total chapters found: ${result.totalChapters}`);
        logger.info(`Actual volumes extracted: ${result.volumes.length}`);
        
        if (result.publisher) {
            logger.info(`Publisher: ${result.publisher}`);
        }
        if (result.englishPublisher) {
            logger.info(`English Publisher: ${result.englishPublisher}`);
        }
        if (result.serialization) {
            logger.info(`Serialization: ${result.serialization}`);
        }
        if (result.status) {
            logger.info(`Status: ${result.status}`);
        }
        
        // Show first 3 volumes as examples
        logger.info('\nFirst 3 volumes:');
        result.volumes.slice(0, 3).forEach(volume => {
            logger.info(`\nVolume ${volume.number}:`);
            if (volume.title) logger.info(`  Title: ${volume.title}`);
            if (volume.japaneseTitle) logger.info(`  Japanese: ${volume.japaneseTitle}`);
            if (volume.englishTitle) logger.info(`  English: ${volume.englishTitle}`);
            if (volume.releaseDate) logger.info(`  Release: ${volume.releaseDate}`);
            if (volume.isbn) logger.info(`  ISBN: ${volume.isbn}`);
            if (volume.chapters && volume.chapters.length > 0) {
                logger.info(`  Chapters: ${volume.chapters.length}`);
                const firstChapter = volume.chapters[0];
                if (firstChapter) {
                    logger.info(`    First: Ch.${firstChapter.number} - ${firstChapter.title || 'No title'}`);
                }
            }
        });
        
        // Test direct URL extraction
        logger.info('\n\nTesting direct URL extraction...');
        const urlResult = await wikipediaVolumeExtractor.extractFromUrl('https://en.wikipedia.org/wiki/List_of_Fire_Force_chapters');
        
        if (urlResult) {
            logger.info('Direct URL extraction successful!');
            logger.info(`Volumes from URL: ${urlResult.volumes.length}`);
        }
    } else {
        logger.error('Failed to extract volume data');
    }
}

// Run the test
testWikipediaVolumeExtractor().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
});