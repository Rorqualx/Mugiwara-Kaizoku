#!/usr/bin/env npx tsx

import { logger } from '../src/utils/logger';
import { wikipediaService } from '../src/server/services/wikipedia/WikipediaService';

async function testWikipediaVolumesUI() {
    logger.info('Testing Wikipedia volumes for UI display...\n');
    
    try {
        // Test findBestMatch with Fire Force (this is what the UI calls)
        const result = await wikipediaService.findBestMatch('Fire Force');
        
        if (result) {
            logger.info('✅ Wikipedia data fetched successfully!');
            
            // Check the rawData structure (as it appears in validatedInitialData)
            const rawData = {
                volumeList: result.volumeList,
                chapterList: result.chapterList
            };
            
            logger.info('\n📦 Data structure for UI:');
            logger.info('rawData.volumeList exists:', !!rawData.volumeList);
            logger.info('rawData.volumeList length:', rawData.volumeList?.length || 0);
            
            if (rawData.volumeList && rawData.volumeList.length > 0) {
                logger.info('\n✅ Volume data is properly structured for UI!');
                logger.info('First volume:', {
                    number: rawData.volumeList[0].number,
                    title: rawData.volumeList[0].title,
                    chapterCount: rawData.volumeList[0].chapters?.length || 0
                });
                
                // Count total chapters
                const totalChapters = rawData.volumeList.reduce((sum: number, vol: any) => 
                    sum + (vol.chapters?.length || 0), 0);
                logger.info(`\nTotal chapters across all volumes: ${totalChapters}`);
                
                logger.info('\n🎯 This data structure should work with the fixed getVolumesForSource function!');
            } else {
                logger.error('❌ Volume data is missing or empty');
            }
        } else {
            logger.error('❌ Failed to find Wikipedia data for Fire Force');
        }
    } catch (error) {
        logger.error('Test failed:', error);
    }
}

// Run the test
testWikipediaVolumesUI().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
});