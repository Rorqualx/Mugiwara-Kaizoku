#!/usr/bin/env npx tsx

import axios from 'axios';

async function testComicVineSeriesScraping() {
    console.log('Testing ComicVine series scraping functionality...\n');

    const baseUrl = 'http://localhost:3000/api/trpc';

    // Test with Fire Force series page (4050 prefix)
    const seriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';

    try {
        console.log('1. Testing series volume URL extraction...');
        console.log(`   Series URL: ${seriesUrl}\n`);

        // First, get all volume URLs from the series page
        const volumeUrlsResponse = await axios.post(`${baseUrl}/metadata.scrapeComicVineVolumeUrls`,
            {
                json: {
                    seriesUrl: seriesUrl
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Response status:', volumeUrlsResponse.status);

        if (volumeUrlsResponse.data?.result?.data?.json) {
            const result = volumeUrlsResponse.data.result.data.json;
            const volumeUrls = result.volumeUrls || (result.data?.volumeUrls);

            if (volumeUrls && volumeUrls.length > 0) {
                console.log(`\n✅ Found ${volumeUrls.length} volume URLs from series page!`);

                // Display first 5 volumes
                console.log('\nFirst 5 volumes found:');
                volumeUrls.slice(0, 5).forEach((vol: any) => {
                    console.log(`   Volume ${vol.volumeNumber}: ${vol.url}`);
                });

                if (volumeUrls.length > 5) {
                    console.log(`   ... and ${volumeUrls.length - 5} more volumes`);
                }

                // Test scraping the first 2 volumes for chapters
                if (volumeUrls.length >= 2) {
                    console.log('\n\n2. Testing chapter scraping from first 2 volumes...');

                    const testUrls = volumeUrls.slice(0, 2).map((v: any) => v.url);
                    console.log(`   Testing URLs: ${testUrls.join(', ')}\n`);

                    const chaptersResponse = await axios.post(`${baseUrl}/metadata.scrapeComicVineChapters`,
                        {
                            json: {
                                volumeUrls: testUrls
                            }
                        },
                        {
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (chaptersResponse.data?.result?.data?.json) {
                        const chapterResult = chaptersResponse.data.result.data.json;
                        console.log('✅ Chapter scraping complete!');

                        if (chapterResult.volumes && chapterResult.volumes.length > 0) {
                            console.log(`   Scraped ${chapterResult.volumes.length} volumes`);

                            chapterResult.volumes.forEach((vol: any) => {
                                if (vol) {
                                    console.log(`\n📚 Volume ${vol.volumeNumber}: "${vol.volumeTitle}"`);
                                    console.log(`   Total chapters: ${vol.chapters ? vol.chapters.length : 0}`);

                                    if (vol.chapters && vol.chapters.length > 0) {
                                        console.log('   First 3 chapters:');
                                        vol.chapters.slice(0, 3).forEach((ch: any) => {
                                            console.log(`     - Chapter ${ch.number}: "${ch.title}"`);
                                        });
                                    } else {
                                        console.log('   ❌ No chapters found for this volume');
                                    }
                                }
                            });
                        } else {
                            console.log('❌ No volumes returned from chapter scraping');
                        }
                    } else {
                        console.log('❌ No data returned from chapter scraping endpoint');
                    }
                }
            } else {
                console.log('❌ No volume URLs found on series page');
                console.log('Full response:', JSON.stringify(result, null, 2));
            }
        } else {
            console.log('❌ No data returned from volume URLs endpoint');
            console.log('Full response:', JSON.stringify(volumeUrlsResponse.data, null, 2));
        }

    } catch (error: any) {
        console.error('Error during testing:', error.response?.data || error.message);
        if (error.response?.data) {
            console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testComicVineSeriesScraping().catch(console.error);