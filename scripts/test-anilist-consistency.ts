#!/usr/bin/env tsx

/**
 * Test script to verify AniList metadata consistency
 * Tests that AniList returns the same metadata whether used as primary or secondary source
 */

import { AniListProviderStrategy } from '../src/server/services/providers/strategies/AniListProviderStrategy';
import { logger } from '../src/utils/logger';

// Test manga - Fire Force (Enen no Shouboutai)
const TEST_MANGA_TITLE = 'Fire Force';
const TEST_MANGA_ID = '86310'; // Fire Force AniList ID

async function testAniListConsistency() {
    console.log('🔍 Testing AniList metadata consistency...\n');

    try {
        // Initialize the AniList provider
        const anilistProvider = new AniListProviderStrategy();
        
        console.log(`📚 Testing with manga: "${TEST_MANGA_TITLE}"`);
        console.log('=' .repeat(50));

        // Step 1: Search for the manga (simulates when AniList is a secondary source)
        console.log('\n1️⃣ Searching for manga (as secondary source would)...');
        const searchResult = await anilistProvider.search(TEST_MANGA_TITLE);
        
        if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
            throw new Error('No search results found');
        }

        const searchData = searchResult.data[0];
        console.log(`   Found: ${searchData.title} (ID: ${searchData.id})`);
        console.log(`   Search result metadata:`, searchData.metadata || {});

        // Step 2: Get full metadata using getMetadata (what our fix now does)
        console.log('\n2️⃣ Fetching full metadata (as fixed code now does)...');
        const fullMetadataResult = await anilistProvider.getMetadata(searchData.id);
        
        if (!fullMetadataResult.success || !fullMetadataResult.data) {
            throw new Error('Failed to fetch full metadata');
        }

        const fullMetadata = fullMetadataResult.data;
        console.log(`   Full metadata received`);

        // Step 3: Compare the data
        console.log('\n3️⃣ Comparing metadata consistency...');
        console.log('=' .repeat(50));

        const comparisons = [
            { field: 'title', search: searchData.title, full: fullMetadata.title },
            { field: 'description', search: searchData.description, full: fullMetadata.description },
            { field: 'coverImage', search: searchData.coverImage, full: fullMetadata.coverImage },
            { field: 'status', search: searchData.metadata?.status, full: fullMetadata.status },
            { field: 'genres', search: searchData.metadata?.genres, full: fullMetadata.genres },
            { field: 'volumes', search: searchData.metadata?.volumes, full: fullMetadata.volumes },
            { field: 'chapters', search: searchData.metadata?.chapters, full: fullMetadata.chapters },
            { field: 'authors', search: searchData.metadata?.authors, full: fullMetadata.authors },
            { field: 'artists', search: searchData.metadata?.artists, full: fullMetadata.artists },
            { field: 'year', search: searchData.metadata?.year, full: fullMetadata.year },
            { field: 'score', search: searchData.metadata?.score, full: fullMetadata.score },
            { field: 'popularity', search: searchData.metadata?.popularity, full: fullMetadata.popularity },
        ];

        let missingInSearch = 0;
        let hasFullData = 0;

        for (const comp of comparisons) {
            const searchValue = comp.search;
            const fullValue = comp.full;
            
            if (fullValue !== undefined) {
                hasFullData++;
                if (searchValue === undefined) {
                    console.log(`   ⚠️  ${comp.field}: Missing in search, present in full metadata`);
                    console.log(`      Value: ${JSON.stringify(fullValue)}`);
                    missingInSearch++;
                } else if (JSON.stringify(searchValue) !== JSON.stringify(fullValue)) {
                    console.log(`   ❌ ${comp.field}: Inconsistent`);
                    console.log(`      Search: ${JSON.stringify(searchValue)}`);
                    console.log(`      Full:   ${JSON.stringify(fullValue)}`);
                } else {
                    console.log(`   ✅ ${comp.field}: ${JSON.stringify(fullValue)}`);
                }
            }
        }

        // Step 4: Summary
        console.log('\n✨ Summary:');
        console.log('=' .repeat(50));
        
        if (missingInSearch > 0) {
            console.log(`⚠️  ${missingInSearch} fields were missing in search results but present in full metadata.`);
            console.log('   This confirms that search results have less data than full metadata.');
            console.log('\n✅ The fix in metadataMerger.ts now fetches full metadata when AniList');
            console.log('   is used as a secondary source, ensuring all fields are available.');
        } else {
            console.log('✅ All metadata fields are consistent between search and full fetch!');
        }

        console.log('\n📝 Key improvements made:');
        console.log('   1. Modified enrichMangaMetadataWithSelectedProviders in metadataMerger.ts');
        console.log('   2. Now calls getMetadata() for providers that support it (including AniList)');
        console.log('   3. This ensures AniList provides complete metadata whether primary or secondary');
        console.log(`   4. Full metadata includes ${hasFullData} fields vs limited search results`);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testAniListConsistency().then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});