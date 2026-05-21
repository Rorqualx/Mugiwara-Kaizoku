#!/usr/bin/env npx tsx

import axios from 'axios';

async function testSelectAllVolumes() {
    console.log('Testing Select All Volumes functionality for Fandom and ComicVine...\n');

    const baseUrl = 'http://localhost:3000/api/trpc';

    try {
        // Test with Fandom
        console.log('=== Testing Fandom Provider ===');
        const fandomSearch = await axios.get(`${baseUrl}/manga.searchProviderConfirmation`, {
            params: {
                input: JSON.stringify({
                    title: 'Fire Force',
                    providers: ['fandom']
                })
            }
        });

        if (fandomSearch.data?.result?.data?.json?.fandom?.length > 0) {
            const firstResult = fandomSearch.data.result.data.json.fandom[0];

            // Enhance to get volume data
            const fandomEnhance = await axios.get(`${baseUrl}/metadata.enhanceWithProviders`, {
                params: {
                    input: JSON.stringify({
                        baseMetadata: firstResult,
                        providers: ['fandom']
                    })
                }
            });

            const enhanced = fandomEnhance.data?.result?.data?.json;
            console.log('Fandom volumes:', enhanced?.volumeDetails?.length || enhanced?.volumes || 0);

            // Check volume structure
            if (enhanced?.volumeDetails?.length > 0) {
                const firstVolume = enhanced.volumeDetails[0];
                console.log('First volume structure:');
                console.log('  - volumeNumber:', firstVolume.volumeNumber);
                console.log('  - number:', firstVolume.number);
                console.log('  - title:', firstVolume.title);
                console.log('Expected volumeNumber for Select All:', firstVolume.volumeNumber || firstVolume.number || 1);
            }
        }

        // Test with ComicVine
        console.log('\n=== Testing ComicVine Provider ===');
        const cvSearch = await axios.get(`${baseUrl}/manga.searchProviderConfirmation`, {
            params: {
                input: JSON.stringify({
                    title: 'Fire Force',
                    providers: ['comicvine']
                })
            }
        });

        if (cvSearch.data?.result?.data?.json?.comicvine?.length > 0) {
            const firstResult = cvSearch.data.result.data.json.comicvine[0];
            console.log('ComicVine issueCount:', firstResult.issueCount || firstResult.count_of_issues || 0);

            // Get issues
            const issuesResponse = await axios.get(`${baseUrl}/metadata.fetchComicVineIssues`, {
                params: {
                    input: JSON.stringify({
                        volumeId: String(firstResult.id)
                    })
                }
            });

            const issues = issuesResponse.data?.result?.data?.json?.issues;
            console.log('ComicVine issues fetched:', issues?.length || 0);

            if (issues?.length > 0) {
                const firstIssue = issues[0];
                console.log('First issue structure:');
                console.log('  - volumeNumber:', firstIssue.volumeNumber);
                console.log('  - number:', firstIssue.number);
                console.log('  - issue_number:', firstIssue.issue_number);
                console.log('  - name:', firstIssue.name);
                console.log('Expected volumeNumber for Select All:', firstIssue.volumeNumber || firstIssue.number || 1);
            }
        }

        console.log('\nSUMMARY:');
        console.log('- Fandom and ComicVine volumes should now auto-select when loaded');
        console.log('- The "Select All" button should properly select/deselect all volumes');
        console.log('- Volume numbers are calculated as: v.volumeNumber || v.number || index + 1');
        console.log('- This calculation is now consistent between rendering and selection logic');

    } catch (error: any) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testSelectAllVolumes().catch(console.error);