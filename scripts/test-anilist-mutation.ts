#!/usr/bin/env npx tsx

import { logger } from '../src/utils/logger';

// Simulate the exact data structure returned by fetchAnilistMetadata mutation
const simulateAnilistMutationResponse = () => {
    // This is what the mutation returns based on metadata.ts lines 1462-1477
    return {
        status: 'success',
        data: {
            cover: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105310-b1LNASz7xux0.jpg',
            description: 'The story follows special fire force...',
            alternativeTitles: ['Fire Force', 'Enen no Shouboutai'],
            genres: ['Action', 'Supernatural', 'Shounen'],
            authors: ['Atsushi Ohkubo'],
            status: 'FINISHED',
            volumes: 34,
            chapters: 305,
            averageScore: 75,
            popularity: 12345,
            startDate: '2015-09-23',
            endDate: '2022-02-22'
        }
    };
};

function testFieldExtraction() {
    logger.info('Testing AniList mutation response and field extraction...\n');
    
    const response = simulateAnilistMutationResponse();
    
    if (response.status === 'success' && response.data) {
        const data = response.data;
        
        logger.info('📝 AniList mutation returns:');
        logger.info('Keys:', Object.keys(data));
        
        logger.info('\n🔍 Field extraction test:');
        
        // Test title extraction
        logger.info('\nTitle field:');
        logger.info('  data.title:', data.title); // undefined
        logger.info('  data.alternativeTitles:', data.alternativeTitles); // array
        logger.info('  Title to use:', data.alternativeTitles?.[0] || 'No title');
        
        // Test other fields
        logger.info('\nOther fields:');
        logger.info('  data.status:', data.status);
        logger.info('  data.startDate:', data.startDate);
        logger.info('  data.endDate:', data.endDate);
        logger.info('  data.genres:', data.genres);
        logger.info('  data.authors:', data.authors);
        
        logger.info('\n✅ Solution:');
        logger.info('For AniList in getFieldOptions, we need to:');
        logger.info('1. Extract title from alternativeTitles[0]');
        logger.info('2. All other fields are at root level');
        logger.info('3. The special handling in UniversalImportWizard.tsx should work');
        
        // Simulate how it's stored in selectedSourcesMetadata
        const selectedSourcesMetadata = {
            anilist: data
        };
        
        logger.info('\n📦 Stored in selectedSourcesMetadata as:');
        logger.info(JSON.stringify(selectedSourcesMetadata, null, 2));
        
        // Test field extraction logic
        const fieldName = 'title';
        const sourceData = selectedSourcesMetadata.anilist;
        
        let rawValue = sourceData[fieldName] || sourceData.metadata?.[fieldName];
        logger.info(`\n🔍 Extracting ${fieldName}:`);
        logger.info(`  Initial rawValue:`, rawValue); // undefined
        
        // Apply special handling for AniList
        if (!rawValue && 'anilist' === 'anilist') {
            if (fieldName === 'title') {
                if (sourceData.alternativeTitles && sourceData.alternativeTitles.length > 0) {
                    rawValue = sourceData.alternativeTitles[0];
                }
            }
        }
        
        logger.info(`  After special handling:`, rawValue); // 'Fire Force'
    }
}

// Run the test
testFieldExtraction();