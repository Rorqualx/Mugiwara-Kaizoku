#!/usr/bin/env npx tsx

import axios from 'axios';

async function testComicVineChapterScraping() {
    console.log('Testing ComicVine chapter scraping functionality...\n');

    const baseUrl = 'http://localhost:3000/api/trpc';

    // Test with Fire Force series page (4050 prefix) as returned by the API
    const volumeUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';

    try {
        console.log('1. Testing single volume scraping with scrapeComicVineVolume endpoint...');
        console.log(`   URL: ${volumeUrl}\n`);

        const response = await axios.post(`${baseUrl}/metadata.scrapeComicVineVolume`,
            {
                json: {
                    volumeUrl: volumeUrl
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Response status:', response.status);

        if (response.data?.result?.data?.json) {
            const result = response.data.result.data.json;
            console.log('\n✅ Scraping successful!');
            console.log(`   Success: ${result.success}`);

            if (result.volumeDetails && result.volumeDetails.length > 0) {
                const volume = result.volumeDetails[0];
                console.log(`\n📚 Volume ${volume.volumeNumber}: "${volume.title}"`);
                console.log(`   Summary: ${volume.summary ? volume.summary.substring(0, 100) + '...' : 'No summary'}`);
                console.log(`   Total chapters: ${volume.chapters ? volume.chapters.length : 0}`);

                if (volume.chapters && volume.chapters.length > 0) {
                    console.log('\n📖 Chapter details:');
                    volume.chapters.slice(0, 5).forEach((ch: any) => {
                        console.log(`   - Chapter ${ch.chapterNumber}: "${ch.title}"`);
                    });

                    if (volume.chapters.length > 5) {
                        console.log(`   ... and ${volume.chapters.length - 5} more chapters`);
                    }
                } else {
                    console.log('\n❌ No chapters found in the scraped data');
                }
            }
        } else {
            console.log('❌ No data returned from scraping endpoint');
            console.log('Full response:', JSON.stringify(response.data, null, 2));
        }

        // Test batch scraping endpoint
        console.log('\n\n2. Testing batch volume scraping with scrapeComicVineChapters endpoint...');
        const volumeUrls = [
            'https://comicvine.gamespot.com/fire-force-1-fire-walk-with-me/4000-557264/',
            'https://comicvine.gamespot.com/fire-force-2-hero-or-devil/4000-580664/'
        ];

        console.log(`   URLs: ${volumeUrls.join(', ')}\n`);

        const batchResponse = await axios.post(`${baseUrl}/metadata.scrapeComicVineChapters`,
            {
                json: {
                    volumeUrls: volumeUrls
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Batch scraping successful!');

        // Debug: Show the entire response structure
        console.log('Response structure:', JSON.stringify(Object.keys(batchResponse.data), null, 2));

        if (batchResponse.data?.result?.data?.json) {
            const result = batchResponse.data.result.data.json;
            console.log(`   Success: ${result.success || result.status}`);
            console.log('   Result keys:', Object.keys(result));

            // Check for volumes in result.data
            const volumeData = result.data || result;

            if (volumeData.volumes && volumeData.volumes.length > 0) {
                console.log(`   Scraped ${volumeData.volumes.length} volumes`);

                volumeData.volumes.forEach((vol: any) => {
                    if (vol) {
                        console.log(`\n📚 Volume ${vol.volumeNumber}: "${vol.volumeTitle}"`);
                        console.log(`   Chapters: ${vol.chapters ? vol.chapters.length : 0}`);
                        console.log(`   Has summary: ${!!vol.volumeSummary}`);
                    } else {
                        console.log('\n❌ One volume failed to scrape (returned null)');
                    }
                });
            } else {
                console.log('❌ No volumes returned from batch scraping');
            }
        } else {
            console.log('❌ No data returned from batch scraping endpoint');
        }

    } catch (error: any) {
        console.error('Error during testing:', error.response?.data || error.message);
        if (error.response?.data) {
            console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testComicVineChapterScraping().catch(console.error);