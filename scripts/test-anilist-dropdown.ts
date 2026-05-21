#!/usr/bin/env npx tsx

import { anilistService } from '../src/server/services/anilist/service';
import { logger } from '../src/utils/logger';

async function testAnilistDropdown() {
    logger.info('Testing AniList dropdown data for Fire Force...\n');
    
    try {
        // Initialize the service first
        await anilistService.initialize();
        
        // Search for Fire Force
        const searchResults = await anilistService.searchManga('Fire Force');
        
        if (searchResults.length > 0) {
            const fireForce = searchResults[0];
            logger.info('Found Fire Force:', fireForce.title);
            
            // Get full details
            const details = await anilistService.getMangaDetails(fireForce.id);
            
            if (details) {
                logger.info('\n📊 AniList Data Structure:');
                logger.info('Title:', details.title);
                logger.info('Type:', details.type);
                logger.info('Status:', details.status);
                
                // Check date fields
                logger.info('\n📅 Date Fields:');
                logger.info('startDate:', details.startDate);
                logger.info('startDate type:', typeof details.startDate);
                if (details.startDate && typeof details.startDate === 'object') {
                    logger.info('startDate structure:', JSON.stringify(details.startDate));
                }
                
                logger.info('endDate:', details.endDate);
                logger.info('endDate type:', typeof details.endDate);
                if (details.endDate && typeof details.endDate === 'object') {
                    logger.info('endDate structure:', JSON.stringify(details.endDate));
                }
                
                // Check if it would appear in dropdown
                logger.info('\n🔍 Dropdown Compatibility Check:');
                
                // Simulate getFieldOptions logic
                const fields = ['title', 'status', 'startDate', 'endDate', 'description'];
                const options: any = {};
                
                for (const field of fields) {
                    const value = (details as any)[field];
                    if (value !== undefined && value !== null) {
                        // Handle date fields
                        if (field === 'startDate' || field === 'endDate') {
                            if (typeof value === 'object' && 'year' in value) {
                                const { year, month, day } = value;
                                options[field] = `${year}-${String(month || 1).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}`;
                            } else {
                                options[field] = String(value);
                            }
                        } else {
                            options[field] = String(value);
                        }
                    }
                }
                
                logger.info('Converted options:', options);
                
                // Check if all values are strings now
                logger.info('\n✅ All values are strings:');
                for (const [key, value] of Object.entries(options)) {
                    logger.info(`  ${key}: ${typeof value === 'string' ? '✓' : '✗'} (${typeof value})`);
                }
                
            } else {
                logger.error('Failed to get AniList details');
            }
        } else {
            logger.error('No search results found');
        }
    } catch (error) {
        logger.error('Test failed:', error);
    }
}

// Run the test
testAnilistDropdown().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
});