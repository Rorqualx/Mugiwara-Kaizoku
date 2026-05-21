#!/usr/bin/env npx tsx
/**
 * Test script to verify AniList ID population
 */

import { AniListProvider } from '../src/server/services/search/providers/AniListProvider';
import { SearchResultValidator } from '../src/server/services/search/providers/SearchResultValidator';
import { MetadataProvider } from '@prisma/client';

async function testAniListIds() {
    try {
        console.log('🔍 Testing AniList ID extraction for Fire Force\n');
        
        const provider = new AniListProvider();
        const searchResults = await provider.search('Fire Force');
        
        const fireForce = searchResults.find((r: any) => 
            r.title?.toLowerCase().includes('fire force') || 
            r.id === '86310' || 
            r.anilistId === 86310
        );
        
        if (!fireForce) {
            console.log('❌ Fire Force not found in search results');
            return;
        }
        
        console.log('📊 Fire Force Search Result:');
        console.log('==========================');
        console.log('Direct properties:');
        console.log(`  id: ${fireForce.id}`);
        console.log(`  anilistId: ${fireForce.anilistId}`);
        console.log(`  malId: ${fireForce.malId}`);
        
        if (fireForce.metadata) {
            console.log('\nMetadata properties:');
            console.log(`  metadata.anilistId: ${fireForce.metadata.anilistId}`);
            console.log(`  metadata.malId: ${fireForce.metadata.malId}`);
            console.log(`  metadata.idMal: ${fireForce.metadata.idMal}`);
        }
        
        // Test validation
        console.log('\n🔄 Testing SearchResultValidator:');
        const validated = SearchResultValidator.validateAndTransform(fireForce, MetadataProvider.ANILIST);
        
        if (validated) {
            console.log('Validated result:');
            console.log(`  id: ${validated.id}`);
            console.log(`  anilistId: ${validated.anilistId}`);
            console.log(`  malId: ${validated.malId || 'undefined'}`);
            
            if (validated.metadata) {
                console.log('\nValidated metadata:');
                console.log(`  metadata.idMal: ${validated.metadata.idMal}`);
                console.log(`  metadata.malId: ${validated.metadata.malId || 'undefined'}`);
            }
        }
        
        // Check what should be available
        console.log('\n✅ Expected values:');
        console.log(`  AniList ID should be: 86310`);
        console.log(`  MAL ID should be: 91037`);
        
        console.log('\n🎯 Issues found:');
        if (!fireForce.anilistId && fireForce.anilistId !== 0) {
            console.log('  ❌ anilistId is missing from search result');
        }
        if (!fireForce.malId && !fireForce.metadata?.idMal && !fireForce.metadata?.malId) {
            console.log('  ❌ MAL ID is missing from all locations');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testAniListIds().catch(console.error);