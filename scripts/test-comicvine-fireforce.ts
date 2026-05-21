#!/usr/bin/env npx tsx

import axios from 'axios';

async function testComicVineFireForce() {
    console.log('Testing ComicVine API for Fire Force (Kodansha Comics USA)...\n');

    const baseUrl = 'http://localhost:3000/api/trpc';

    // The ComicVine ID for Fire Force (Kodansha Comics USA) is 95557
    const volumeId = '95557';

    try {
        // 1. First fetch the issues for this volume
        console.log('1. Fetching ComicVine issues for volume ID:', volumeId);

        const issuesResponse = await axios.post(`${baseUrl}/metadata.fetchComicVineIssues`,
            {
                json: {
                    volumeId: volumeId
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Response status:', issuesResponse.status);
        
        // Log the structure
        console.log('Response structure:', {
            hasResult: !!issuesResponse.data?.result,
            hasData: !!issuesResponse.data?.result?.data,
            hasJson: !!issuesResponse.data?.result?.data?.json,
            jsonType: typeof issuesResponse.data?.result?.data?.json
        });

        const responseData = issuesResponse.data?.result?.data?.json;
        console.log('\nFull response data:', JSON.stringify(responseData, null, 2).substring(0, 1000));
        
        // Handle different response formats
        const issues = Array.isArray(responseData) ? responseData :
                      responseData?.issues ? responseData.issues :
                      responseData?.data ? responseData.data : [];

        if (issues && issues.length > 0) {
            console.log(`\n✅ Found ${issues.length} issues for Fire Force`);

            // Show first 5 issues
            console.log('\n📚 First 5 issues:');
            issues.slice(0, 5).forEach((issue: any, idx: number) => {
                console.log(`  Issue ${idx + 1}:`);
                console.log(`    ID: ${issue.id}`);
                console.log(`    Name: ${issue.name || 'No name'}`);
                console.log(`    Issue Number: ${issue.issue_number}`);
                console.log(`    URL: ${issue.site_detail_url || 'No URL'}`);
                console.log(`    Has Cover: ${!!(issue.image?.medium_url || issue.image?.small_url)}`);
            });

            // 2. Now try to scrape chapters from the first few volumes
            console.log('\n\n2. Testing chapter scraping for first 3 volumes...\n');

            // Build URLs for the first 3 volumes
            const volumeUrls = issues.slice(0, 3).map((issue: any) => {
                if (issue.site_detail_url) {
                    return issue.site_detail_url;
                } else if (issue.id) {
                    return `https://comicvine.gamespot.com/fire-force-${issue.issue_number}/4000-${issue.id}/`;
                }
                return null;
            }).filter(Boolean);

            console.log('Volume URLs to scrape:');
            volumeUrls.forEach((url: string) => console.log(`  - ${url}`));

            if (volumeUrls.length > 0) {
                console.log('\n3. Scraping chapters from ComicVine volumes...');

                const scrapeResponse = await axios.post(`${baseUrl}/metadata.scrapeComicVineChapters`,
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

                if (scrapeResponse.data?.result?.data?.json) {
                    const result = scrapeResponse.data.result.data.json;
                    console.log(`\n✅ Scraping result: Success=${result.success}`);

                    if (result.volumes && result.volumes.length > 0) {
                        console.log(`\n📖 Scraped ${result.volumes.length} volumes with chapters:`);

                        result.volumes.forEach((vol: any, idx: number) => {
                            if (vol) {
                                console.log(`\n  Volume ${vol.volumeNumber || idx + 1}:`);
                                console.log(`    Title: ${vol.volumeTitle || 'No title'}`);
                                console.log(`    Has Summary: ${!!vol.volumeSummary}`);
                                console.log(`    Chapter Count: ${vol.chapters ? vol.chapters.length : 0}`);

                                if (vol.chapters && vol.chapters.length > 0) {
                                    console.log('    First 3 chapters:');
                                    vol.chapters.slice(0, 3).forEach((ch: any) => {
                                        console.log(`      - Chapter ${ch.chapterNumber}: "${ch.title}"`);
                                    });
                                }
                            } else {
                                console.log(`\n  Volume ${idx + 1}: Failed to scrape`);
                            }
                        });
                    } else {
                        console.log('❌ No volumes returned from scraping');
                    }
                } else {
                    console.log('❌ No data returned from scraping endpoint');
                }
            }
        } else {
            console.log('❌ No issues found in ComicVine response');
        }

    } catch (error: any) {
        console.error('\n❌ Error during testing:', error.response?.data || error.message);
        if (error.response?.data) {
            console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testComicVineFireForce().catch(console.error);
