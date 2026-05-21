#!/usr/bin/env npx tsx
/**
 * Test script to fetch and display Fire Force data from AniList
 */

import { AniListProvider } from '../src/server/services/search/providers/AniListProvider';
import { logger } from '../src/utils/logger';
import { SearchResultValidator } from '../src/server/services/search/providers/SearchResultValidator';
import { MetadataProvider } from '@prisma/client';

async function testFireForceAniList() {
    try {
        console.log('🔥 Testing AniList API for Fire Force (En\'en no Shouboutai)\n');
        
        // Initialize the AniList provider
        const provider = new AniListProvider();
        
        // Search for Fire Force
        console.log('📡 Searching for "Fire Force" on AniList...\n');
        const searchResults = await provider.search('Fire Force');
        
        if (!searchResults || searchResults.length === 0) {
            console.log('❌ No results found for Fire Force');
            return;
        }
        
        console.log(`✅ Found ${searchResults.length} results\n`);
        
        // Find the main Fire Force manga (ID: 86310)
        const fireForce = searchResults.find((r: any) => 
            r.title?.toLowerCase().includes('fire force') || 
            r.title?.toLowerCase().includes('en en no shouboutai') ||
            r.id === '86310' || 
            r.anilistId === 86310
        );
        
        if (!fireForce) {
            console.log('⚠️ Could not find main Fire Force manga in results');
            console.log('\nAll results:');
            searchResults.forEach((r: any, i: number) => {
                console.log(`${i + 1}. ${r.title} (ID: ${r.id || r.anilistId})`);
            });
            return;
        }
        
        console.log('📚 Fire Force Manga Data from AniList:');
        console.log('=====================================\n');
        
        // Display basic info
        console.log('📖 Basic Information:');
        console.log(`  Title: ${fireForce.title}`);
        console.log(`  AniList ID: ${fireForce.anilistId || fireForce.id}`);
        console.log(`  Status: ${fireForce.status || 'Unknown'}`);
        console.log(`  Format: ${fireForce.format || fireForce.metadata?.format || 'Unknown'}`);
        
        // Check for volumes and chapters
        console.log('\n📊 Volume/Chapter Data:');
        console.log(`  Volumes: ${fireForce.volumes || fireForce.metadata?.volumes || 'Not provided'}`);
        console.log(`  Chapters: ${fireForce.chapters || fireForce.metadata?.chapters || 'Not provided'}`);
        
        // Check for dates
        console.log('\n📅 Dates:');
        const startDate = fireForce.startDate || fireForce.metadata?.startDate;
        const endDate = fireForce.endDate || fireForce.metadata?.endDate;
        console.log(`  Start Date: ${JSON.stringify(startDate) || 'Not provided'}`);
        console.log(`  End Date: ${JSON.stringify(endDate) || 'Not provided'}`);
        
        // Check for authors and artists
        console.log('\n✍️ Creators:');
        console.log(`  Authors: ${fireForce.authors?.join(', ') || fireForce.metadata?.authors?.join(', ') || 'Not provided'}`);
        console.log(`  Artists: ${fireForce.artists?.join(', ') || fireForce.metadata?.artists?.join(', ') || 'Not provided'}`);
        
        // Check for images
        console.log('\n🖼️ Images:');
        console.log(`  Cover: ${fireForce.cover || fireForce.coverImage ? 'Available' : 'Not available'}`);
        console.log(`  Banner: ${fireForce.bannerImage || fireForce.metadata?.bannerImage ? 'Available' : 'Not available'}`);
        if (fireForce.bannerImage || fireForce.metadata?.bannerImage) {
            console.log(`    Banner URL: ${fireForce.bannerImage || fireForce.metadata?.bannerImage}`);
        }
        
        // Check for scores
        console.log('\n⭐ Ratings:');
        console.log(`  Average Score: ${fireForce.averageScore || fireForce.metadata?.averageScore || 'Not provided'}`);
        console.log(`  Popularity: ${fireForce.popularity || fireForce.metadata?.popularity || 'Not provided'}`);
        
        // Check for genres and tags
        console.log('\n🏷️ Genres & Tags:');
        console.log(`  Genres: ${fireForce.genres?.join(', ') || fireForce.metadata?.genres?.join(', ') || 'Not provided'}`);
        const tags = fireForce.tags || fireForce.metadata?.tags;
        if (tags && Array.isArray(tags)) {
            const tagNames = tags.map((t: any) => typeof t === 'string' ? t : t.name).filter(Boolean);
            console.log(`  Tags: ${tagNames.slice(0, 5).join(', ')}${tagNames.length > 5 ? '...' : ''}`);
        } else {
            console.log(`  Tags: Not provided`);
        }
        
        // Check for external IDs
        console.log('\n🔗 External IDs:');
        console.log(`  MAL ID: ${fireForce.malId || fireForce.metadata?.malId || fireForce.metadata?.idMal || 'Not provided'}`);
        
        // Display full metadata object for debugging
        console.log('\n📦 Full Metadata Object:');
        console.log('------------------------');
        console.log(JSON.stringify(fireForce.metadata || {}, null, 2));
        
        // Test validation and transformation
        console.log('\n🔄 Testing SearchResultValidator...');
        const validated = SearchResultValidator.validateAndTransform(fireForce, MetadataProvider.ANILIST);
        
        if (validated) {
            console.log('✅ Validation successful');
            console.log('\n📋 Validated Result:');
            console.log(`  Authors: ${validated.authors?.join(', ') || 'Not extracted'}`);
            console.log(`  Artists: ${validated.artists?.join(', ') || 'Not extracted'}`);
            console.log(`  Start Date: ${JSON.stringify(validated.startDate) || 'Not extracted'}`);
            console.log(`  End Date: ${JSON.stringify(validated.endDate) || 'Not extracted'}`);
            console.log(`  Banner: ${validated.bannerImage ? 'Available' : 'Not extracted'}`);
            console.log(`  Volumes: ${validated.volumes || 'Not extracted'}`);
            console.log(`  Chapters: ${validated.chapters || 'Not extracted'}`);
        } else {
            console.log('❌ Validation failed');
        }
        
        // Check raw API response if available
        if (fireForce.rawData || fireForce.providerSpecific) {
            console.log('\n🔍 Raw API Data Available:');
            const raw = fireForce.rawData || fireForce.providerSpecific;
            console.log(`  Has staff data: ${!!raw.staff}`);
            console.log(`  Has characters data: ${!!raw.characters}`);
            console.log(`  Has relations data: ${!!raw.relations}`);
            console.log(`  Has recommendations: ${!!raw.recommendations}`);
            
            if (raw.staff?.edges) {
                console.log(`\n  Staff (${raw.staff.edges.length} entries):`);
                raw.staff.edges.slice(0, 3).forEach((edge: any) => {
                    console.log(`    - ${edge.node?.name?.full || edge.node?.name?.native}: ${edge.role}`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        logger.error('Test failed:', error);
    }
}

// Run the test
testFireForceAniList().catch(console.error);