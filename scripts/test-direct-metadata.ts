#!/usr/bin/env tsx

/**
 * Test getEnhancedFandomMetadata directly
 */

import axios from 'axios';

async function testDirectMetadata() {
    console.log('Testing getEnhancedFandomMetadata directly');
    console.log('='.repeat(80));
    
    const baseUrl = 'http://localhost:3000';
    const fireForceUrl = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
    
    try {
        console.log('Fetching metadata for:', fireForceUrl);
        
        // The getEnhancedFandomMetadata is a mutation
        const response = await axios.post(`${baseUrl}/api/trpc/metadata.getEnhancedFandomMetadata`, {
            json: {
                url: fireForceUrl
            }
        });
        
        const result = response.data.result?.data?.json;
        console.log('Full response:', JSON.stringify(result, null, 2));
        
        if (result?.success) {
            console.log('\n✅ Metadata extraction successful!');
            console.log('='.repeat(80));
            
            console.log('\nSeries Metadata:');
            console.log('  Title:', result.metadata?.title);
            console.log('  Author:', result.metadata?.author);
            console.log('  Artist:', result.metadata?.artist);
            console.log('  Genres:', result.metadata?.genres);
            console.log('  Status:', result.metadata?.status);
            console.log('  Start Date:', result.metadata?.startDate);
            console.log('  Cover Image:', result.metadata?.coverImage ? 'Found' : 'Not found');
            
            console.log('\nContent Summary:');
            console.log('  Total Volumes:', result.totalVolumes);
            console.log('  Total Chapters:', result.totalChapters);
            
            if (result.volumes?.length > 0) {
                console.log('\nVolume Details (first 3):');
                result.volumes.slice(0, 3).forEach((vol: any) => {
                    console.log(`  Volume ${vol.number}:`);
                    console.log(`    Title: ${vol.title}`);
                    console.log(`    Chapters: ${vol.chapters?.length || 0}`);
                    console.log(`    ISBN: ${vol.isbn || 'N/A'}`);
                    console.log(`    Release: ${vol.releaseDate || 'N/A'}`);
                });
            }
            
            if (result.chapters?.length > 0) {
                console.log('\nChapter Details (first 5):');
                result.chapters.slice(0, 5).forEach((ch: any) => {
                    console.log(`  Chapter ${ch.number}: ${ch.title} (Volume ${ch.volume})`);
                });
            }
            
            console.log('\n' + '='.repeat(80));
            console.log('✅ Fire Force wiki import ready to save to database!');
            
        } else {
            console.log('❌ Metadata extraction failed');
            console.log('Error:', result?.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('Test failed:', error);
        if (axios.isAxiosError(error)) {
            console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
            console.error('Status:', error.response?.status);
        }
    }
}

// Run the test
testDirectMetadata().then(() => {
    console.log('\nTest completed');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});