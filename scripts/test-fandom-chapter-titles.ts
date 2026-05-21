#!/usr/bin/env npx tsx

import axios from 'axios';

async function testFandomChapterTitles() {
    console.log('Testing Fandom chapter title extraction fix...\n');

    const baseUrl = 'http://localhost:3000/api/trpc';
    const volumesUrl = 'https://fire-force.fandom.com/wiki/List_of_Volumes';

    try {
        console.log('1. Parsing Fandom volumes page...');
        const parseResult = await axios.post(`${baseUrl}/metadata.parseFandomUrl`,
            {
                json: {
                    url: volumesUrl
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Response:', JSON.stringify(parseResult.data, null, 2).substring(0, 500));

        if (parseResult.data?.result?.data?.json) {
            const data = parseResult.data.result.data.json;

            console.log(`\n✅ Found ${data.volumes} volumes with ${data.chapters} chapters`);

            if (data.volumeDetails && data.volumeDetails.length > 0) {
                console.log('\n2. Checking chapter titles in first 3 volumes:');

                data.volumeDetails.slice(0, 3).forEach((volume: any) => {
                    console.log(`\n📚 Volume ${volume.volumeNumber}: "${volume.title}"`);
                    console.log(`   Chapters: ${volume.chapterCount}`);

                    if (volume.chapters && volume.chapters.length > 0) {
                        // Show first 3 chapters
                        volume.chapters.slice(0, 3).forEach((chapter: any) => {
                            const hasProperTitle = chapter.title && !chapter.title.match(/^Chapter \d+$/);
                            const icon = hasProperTitle ? '✅' : '❌';
                            console.log(`   ${icon} Chapter ${chapter.chapterNumber}: "${chapter.title}"`);
                        });

                        if (volume.chapters.length > 3) {
                            console.log(`   ... and ${volume.chapters.length - 3} more chapters`);
                        }
                    }
                });

                // Check if any chapters have proper titles
                let totalChapters = 0;
                let chaptersWithTitles = 0;

                data.volumeDetails.forEach((volume: any) => {
                    if (volume.chapters) {
                        volume.chapters.forEach((chapter: any) => {
                            totalChapters++;
                            if (chapter.title && !chapter.title.match(/^Chapter \d+$/)) {
                                chaptersWithTitles++;
                            }
                        });
                    }
                });

                console.log('\n3. Summary:');
                console.log(`   Total chapters: ${totalChapters}`);
                console.log(`   Chapters with proper titles: ${chaptersWithTitles}`);
                console.log(`   Chapters with generic titles: ${totalChapters - chaptersWithTitles}`);

                if (chaptersWithTitles > 0) {
                    console.log('\n✅ SUCCESS: Fandom chapters now have proper titles!');
                } else {
                    console.log('\n❌ ISSUE: Chapters still showing generic titles');
                }
            }
        } else {
            console.log('❌ No data returned from parseFandomUrl');
        }

    } catch (error: any) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testFandomChapterTitles().catch(console.error);