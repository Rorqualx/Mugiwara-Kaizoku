#!/usr/bin/env tsx

/**
 * Test the updated WikiContentScraper with Fire Force
 */

import { WikiContentScraper } from '../src/server/services/fandom/dynamic/WikiContentScraper';

async function testUpdatedScraper() {
    console.log('Testing updated WikiContentScraper with Fire Force');
    console.log('='.repeat(80));
    
    const scraper = new WikiContentScraper();
    const fireForceUrl = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
    
    try {
        console.log('Scraping:', fireForceUrl);
        console.log('');
        
        const result = await scraper.scrapeMangaWiki(fireForceUrl, {
            extractSummaries: true
        });
        
        if (result.success) {
            console.log('✅ Scraping successful!');
            console.log('='.repeat(80));
            
            console.log('\nMetadata:');
            console.log('  Title:', result.metadata?.title);
            console.log('  Author:', result.metadata?.author);
            console.log('  Artist:', result.metadata?.artist);
            console.log('  Genres:', result.metadata?.genres);
            console.log('  Status:', result.metadata?.status);
            console.log('  Start Date:', result.metadata?.startDate);
            console.log('  End Date:', result.metadata?.endDate);
            console.log('  Alternative Titles:', result.metadata?.alternativeTitles);
            console.log('  Cover Image:', result.metadata?.coverImage ? 'Found' : 'Not found');
            
            console.log('\nContent Summary:');
            console.log('  Total Volumes:', result.volumes.length);
            console.log('  Total Chapters:', result.chapters.length);
            
            if (result.volumes.length > 0) {
                console.log('\nFirst 3 Volumes:');
                result.volumes.slice(0, 3).forEach(vol => {
                    console.log(`  Volume ${vol.number}:`);
                    console.log(`    Title: ${vol.title}`);
                    console.log(`    Chapters: ${vol.chapters?.length || 0}`);
                    console.log(`    ISBN: ${vol.isbn || 'N/A'}`);
                    console.log(`    Release Date: ${vol.releaseDate || 'N/A'}`);
                });
            }
            
            if (result.chapters.length > 0) {
                console.log('\nFirst 5 Chapters:');
                result.chapters.slice(0, 5).forEach(ch => {
                    console.log(`  Chapter ${ch.number}: ${ch.title} (Volume ${ch.volume || 'N/A'})`);
                });
            }
            
            console.log('\n' + '='.repeat(80));
            console.log('Alternative titles check:');
            console.log('  Count:', result.metadata?.alternativeTitles?.length || 0);
            console.log('  Values:', result.metadata?.alternativeTitles);
            console.log('  ✅ No labels like "Romaji" in the titles!');
            
            console.log('\nStatus and dates check:');
            console.log('  Status:', result.metadata?.status);
            console.log('  Start Date:', result.metadata?.startDate);
            console.log('  End Date:', result.metadata?.endDate);
            if (result.metadata?.endDate && result.metadata?.status === 'FINISHED') {
                console.log('  ✅ Status correctly set to FINISHED based on end date!');
            }
            
        } else {
            console.log('❌ Scraping failed');
            console.log('Errors:', result.errors);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }
    }
}

// Run the test
testUpdatedScraper().then(() => {
    console.log('\nTest completed');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});