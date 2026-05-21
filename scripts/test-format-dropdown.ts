#!/usr/bin/env npx tsx

import axios from 'axios';

async function testFormatDropdown() {
    console.log('Testing format field data from providers...\n');

    const baseUrl = 'http://localhost:3000/api/trpc';

    try {
        // Search Fire Force with Fandom
        console.log('=== Testing Fandom Provider ===');
        const fandomSearch = await axios.post(`${baseUrl}/metadata.searchProviders`, {
            json: {
                query: 'Fire Force',
                providers: ['fandom']
            }
        });

        if (fandomSearch.data?.result?.data?.json?.fandom?.results?.length > 0) {
            const firstResult = fandomSearch.data.result.data.json.fandom.results[0];
            console.log('Fandom search result format:', firstResult.format || 'Not found');

            // Enhance the result
            const fandomEnhance = await axios.post(`${baseUrl}/metadata.enhanceWithProviders`, {
                json: {
                    baseMetadata: firstResult,
                    providers: ['fandom']
                }
            });

            const enhanced = fandomEnhance.data?.result?.data?.json;
            console.log('Fandom enhanced format:', enhanced?.format || 'Not found');
            console.log('Fandom publication.format:', enhanced?.publication?.format || 'Not found');
            console.log('Fandom metadata.format:', enhanced?.metadata?.format || 'Not found');
            console.log('Fandom providerSpecific.format:', enhanced?.providerSpecific?.format || 'Not found');
        }

        // Search with AniList
        console.log('\n=== Testing AniList Provider ===');
        const anilistSearch = await axios.post(`${baseUrl}/metadata.searchProviders`, {
            json: {
                query: 'Fire Force',
                providers: ['anilist']
            }
        });

        if (anilistSearch.data?.result?.data?.json?.anilist?.results?.length > 0) {
            const firstResult = anilistSearch.data.result.data.json.anilist.results[0];
            console.log('AniList search result format:', firstResult.format || 'Not found');

            // Enhance the result
            const anilistEnhance = await axios.post(`${baseUrl}/metadata.enhanceWithProviders`, {
                json: {
                    baseMetadata: firstResult,
                    providers: ['anilist']
                }
            });

            const enhanced = anilistEnhance.data?.result?.data?.json;
            console.log('AniList enhanced format:', enhanced?.format || 'Not found');
            console.log('AniList root format:', enhanced?.anilist?.format || 'Not found');
        }

        // Search with Wikipedia
        console.log('\n=== Testing Wikipedia Provider ===');
        const wikiSearch = await axios.post(`${baseUrl}/metadata.searchProviders`, {
            json: {
                query: 'Fire Force',
                providers: ['wikipedia']
            }
        });

        if (wikiSearch.data?.result?.data?.json?.wikipedia?.results?.length > 0) {
            const firstResult = wikiSearch.data.result.data.json.wikipedia.results[0];
            console.log('Wikipedia search result format:', firstResult.format || 'Not found');
        }

        // Search with ComicVine
        console.log('\n=== Testing ComicVine Provider ===');
        const cvSearch = await axios.post(`${baseUrl}/metadata.searchProviders`, {
            json: {
                query: 'Fire Force',
                providers: ['comicvine']
            }
        });

        if (cvSearch.data?.result?.data?.json?.comicvine?.results?.length > 0) {
            const firstResult = cvSearch.data.result.data.json.comicvine.results[0];
            console.log('ComicVine search result format:', firstResult.format || 'Not found');
        }

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testFormatDropdown().catch(console.error);