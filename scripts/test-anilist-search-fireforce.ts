#!/usr/bin/env npx tsx

import { anilistService } from '../src/server/services/anilist/service';
import { logger } from '../src/utils/logger';

async function findFireForce() {
    logger.info('Searching for Fire Force on AniList...\n');
    
    try {
        await anilistService.initialize();
        const results = await anilistService.searchManga('Fire Force');
        
        if (results.length > 0) {
            logger.info('Found Fire Force results:');
            results.forEach(result => {
                logger.info(`  ID: ${result.id}, Title: ${result.title}`);
            });
            
            // Get the first result's details
            const fireForce = results[0];
            logger.info(`\nUsing Fire Force ID: ${fireForce.id}`);
        } else {
            logger.error('No results found for Fire Force');
        }
    } catch (error) {
        logger.error('Search failed:', error);
    }
}

// Run the test
findFireForce().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
});