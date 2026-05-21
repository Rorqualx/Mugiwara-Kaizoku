#!/usr/bin/env npx tsx

import { appRouter } from '../src/server/trpc/root';
import { prisma } from '../src/server/db';
import { logger } from '../src/utils/logger';

async function testAnilistEnhancement() {
    logger.info('Testing AniList enhancement flow...\n');
    
    try {
        // Create a mock context
        const ctx = {
            db: prisma,
            session: null,
        };
        
        // Create the caller
        const caller = appRouter.createCaller(ctx);
        
        // Test the fetchAnilistMetadata mutation
        logger.info('📡 Calling fetchAnilistMetadata mutation...');
        const result = await caller.metadata.fetchAnilistMetadata({
            id: '86310' // Fire Force ID
        });
        
        logger.info('📦 Mutation result:', {
            status: result.status,
            hasData: !!result.data,
            dataKeys: result.data ? Object.keys(result.data) : [],
            data: result.data
        });
        
        if (result.status === 'success' && result.data) {
            logger.info('\n✅ Success! AniList data structure:');
            logger.info('  alternativeTitles:', result.data.alternativeTitles);
            logger.info('  description:', result.data.description?.substring(0, 100) + '...');
            logger.info('  genres:', result.data.genres);
            logger.info('  status:', result.data.status);
            logger.info('  volumes:', result.data.volumes);
            logger.info('  chapters:', result.data.chapters);
            
            logger.info('\n🎯 This data should appear in the dropdown when AniList is selected');
        } else {
            logger.error('❌ Failed to fetch AniList data:', result);
        }
    } catch (error) {
        logger.error('Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testAnilistEnhancement().catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
});