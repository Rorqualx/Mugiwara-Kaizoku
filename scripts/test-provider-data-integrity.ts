#!/usr/bin/env npx tsx

import axios from 'axios';
import { logger } from '../src/utils/logger';

const baseUrl = 'http://localhost:3000/api/trpc';

interface ProviderData {
    provider: string;
    searchResults: any;
    enhancedData: any;
    volumeData: any;
    chapterData: any;
}

async function testProviderDataIntegrity() {
    console.log('='.repeat(80));
    console.log('PROVIDER DATA INTEGRITY TEST - Fire Force');
    console.log('='.repeat(80));
    console.log('\nTesting data flow from each provider to wizard fields...\n');

    const providers = ['fandom', 'comicvine', 'anilist', 'wikipedia'];
    const providerData: Record<string, ProviderData> = {};

    // Step 1: Search all providers
    console.log('STEP 1: SEARCHING ALL PROVIDERS');
    console.log('-'.repeat(40));

    for (const provider of providers) {
        console.log(`\n[${provider.toUpperCase()}] Searching...`);

        try {
            const searchResponse = await axios.get(`${baseUrl}/manga.searchProviderConfirmation`, {
                params: {
                    input: JSON.stringify({
                        title: 'Fire Force',
                        providers: [provider]
                    })
                }
            });

            const results = searchResponse.data?.result?.data?.json?.[provider] || [];
            console.log(`[${provider}] Found ${results.length} results`);

            if (results.length > 0) {
                const firstResult = results[0];
                providerData[provider] = {
                    provider,
                    searchResults: firstResult,
                    enhancedData: null,
                    volumeData: null,
                    chapterData: null
                };

                // Log key fields from search results
                console.log(`[${provider}] Search Result Analysis:`);
                console.log(`  - ID: ${firstResult.id}`);
                console.log(`  - Title: ${firstResult.title}`);
                console.log(`  - Has issueCount: ${!!firstResult.issueCount} (${firstResult.issueCount || 'N/A'})`);
                console.log(`  - Has issues: ${!!firstResult.issues} (${firstResult.issues?.length || 0} items)`);
                console.log(`  - Has volumes: ${!!firstResult.volumes} (${firstResult.volumes || 'N/A'})`);
                console.log(`  - Has chapters: ${!!firstResult.chapters} (${firstResult.chapters || 'N/A'})`);
                console.log(`  - Has metadata: ${!!firstResult.metadata}`);

                if (firstResult.metadata) {
                    console.log(`  - Metadata.issueCount: ${firstResult.metadata.issueCount || 'N/A'}`);
                    console.log(`  - Metadata.volumes: ${firstResult.metadata.volumes || 'N/A'}`);
                    console.log(`  - Metadata.chapters: ${firstResult.metadata.chapters || 'N/A'}`);
                }
            }
        } catch (error: any) {
            console.error(`[${provider}] Search failed:`, error.response?.data || error.message);
        }
    }

    // Step 2: Enhance metadata for each provider
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: ENHANCING METADATA');
    console.log('-'.repeat(40));

    for (const provider of providers) {
        if (!providerData[provider]) continue;

        console.log(`\n[${provider.toUpperCase()}] Enhancing...`);

        try {
            const enhanceResponse = await axios.get(`${baseUrl}/metadata.enhanceWithProviders`, {
                params: {
                    input: JSON.stringify({
                        baseMetadata: providerData[provider].searchResults,
                        providers: [provider]
                    })
                }
            });

            const enhanced = enhanceResponse.data?.result?.data?.json;
            providerData[provider].enhancedData = enhanced;

            console.log(`[${provider}] Enhanced Data Analysis:`);
            console.log(`  - Has ${provider} key: ${!!enhanced?.[provider]}`);
            console.log(`  - Root issueCount: ${enhanced?.issueCount || 'N/A'}`);
            console.log(`  - Root volumes: ${enhanced?.volumes || 'N/A'}`);
            console.log(`  - Root chapters: ${enhanced?.chapters || 'N/A'}`);

            if (enhanced?.[provider]) {
                const providerSpecific = enhanced[provider];
                console.log(`  - ${provider}.issueCount: ${providerSpecific.issueCount || 'N/A'}`);
                console.log(`  - ${provider}.issues: ${providerSpecific.issues?.length || 'N/A'}`);
                console.log(`  - ${provider}.volumes: ${providerSpecific.volumes || 'N/A'}`);
                console.log(`  - ${provider}.volumeDetails: ${providerSpecific.volumeDetails?.length || 'N/A'}`);
                console.log(`  - ${provider}.chapters: ${providerSpecific.chapters || 'N/A'}`);
                console.log(`  - ${provider}.chapterDetails: ${providerSpecific.chapterDetails?.length || 'N/A'}`);
            }

        } catch (error: any) {
            console.error(`[${provider}] Enhancement failed:`, error.response?.data || error.message);
        }
    }

    // Step 3: Test volume/chapter fetching
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: TESTING VOLUME/CHAPTER FETCHING');
    console.log('-'.repeat(40));

    // For ComicVine, test issue fetching
    if (providerData['comicvine']) {
        console.log('\n[COMICVINE] Testing issue fetching...');
        const volumeId = providerData['comicvine'].searchResults.id;

        try {
            const issuesResponse = await axios.get(`${baseUrl}/metadata.fetchComicVineIssues`, {
                params: {
                    input: JSON.stringify({
                        volumeId: String(volumeId)
                    })
                }
            });

            const issues = issuesResponse.data?.result?.data?.json?.issues;
            console.log(`[COMICVINE] Fetched ${issues?.length || 0} issues`);

            if (issues && issues.length > 0) {
                console.log(`  First issue:`);
                console.log(`    - Number: ${issues[0].issue_number || issues[0].issueNumber}`);
                console.log(`    - Name: ${issues[0].name}`);
                console.log(`    - ID: ${issues[0].id}`);
            }
        } catch (error: any) {
            console.error('[COMICVINE] Issue fetch failed:', error.response?.data || error.message);
        }
    }

    // Step 4: Cross-contamination check
    console.log('\n' + '='.repeat(80));
    console.log('STEP 4: CROSS-CONTAMINATION CHECK');
    console.log('-'.repeat(40));

    // Check if any provider is showing data that belongs to another
    for (const provider1 of providers) {
        if (!providerData[provider1]) continue;

        for (const provider2 of providers) {
            if (provider1 === provider2 || !providerData[provider2]) continue;

            const data1 = providerData[provider1].enhancedData || providerData[provider1].searchResults;
            const data2 = providerData[provider2].enhancedData || providerData[provider2].searchResults;

            // Check for identical values that shouldn't be the same
            if (data1.description === data2.description && data1.description) {
                console.warn(`⚠️ CONTAMINATION: ${provider1} and ${provider2} have identical descriptions!`);
            }

            if (data1.volumes === data2.volumes && data1.volumes && provider1 !== 'anilist' && provider2 !== 'anilist') {
                console.warn(`⚠️ CONTAMINATION: ${provider1} and ${provider2} have identical volume counts!`);
            }

            // Check for provider-specific data appearing in wrong provider
            if (data1[provider2]) {
                console.warn(`⚠️ CONTAMINATION: ${provider1} data contains ${provider2} key!`);
            }
        }
    }

    // Step 5: Wizard field mapping simulation
    console.log('\n' + '='.repeat(80));
    console.log('STEP 5: WIZARD FIELD MAPPING SIMULATION');
    console.log('-'.repeat(40));

    for (const provider of providers) {
        if (!providerData[provider]) continue;

        console.log(`\n[${provider.toUpperCase()}] Wizard Fields:`);

        const data = providerData[provider].enhancedData || providerData[provider].searchResults;

        // Simulate getVolumesForSource logic
        let volumeCount = 0;
        let volumeSource = 'unknown';

        if (provider === 'comicvine') {
            if (data.issues?.length > 0) {
                volumeCount = data.issues.length;
                volumeSource = 'issues array';
            } else if (data.issueCount) {
                volumeCount = data.issueCount;
                volumeSource = 'issueCount field';
            } else if (data.metadata?.issueCount) {
                volumeCount = data.metadata.issueCount;
                volumeSource = 'metadata.issueCount';
            }
        } else if (provider === 'fandom') {
            if (data.volumeDetails?.length > 0) {
                volumeCount = data.volumeDetails.length;
                volumeSource = 'volumeDetails array';
            } else if (data.volumes) {
                volumeCount = data.volumes;
                volumeSource = 'volumes field';
            }
        } else if (provider === 'anilist') {
            if (data.volumes) {
                volumeCount = data.volumes;
                volumeSource = 'volumes field';
            }
        } else if (provider === 'wikipedia') {
            if (data.volumeList?.length > 0) {
                volumeCount = data.volumeList.length;
                volumeSource = 'volumeList array';
            }
        }

        console.log(`  - Volume Count: ${volumeCount} (from ${volumeSource})`);
        console.log(`  - Chapter Count: ${data.chapters || data.chapterCount || 'N/A'}`);
        console.log(`  - Title Display: ${data.title}`);
        console.log(`  - Has Cover: ${!!data.cover || !!data.coverImage || !!data.coverUrl}`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('-'.repeat(40));

    const issues: string[] = [];

    // Check for missing volume data
    for (const provider of providers) {
        if (!providerData[provider]) continue;

        const data = providerData[provider].enhancedData || providerData[provider].searchResults;

        if (provider === 'comicvine' && !data.issueCount && !data.issues?.length) {
            issues.push(`ComicVine: Missing issueCount and issues array`);
        }

        if (provider === 'fandom' && !data.volumes && !data.volumeDetails?.length) {
            issues.push(`Fandom: Missing volume data`);
        }
    }

    if (issues.length > 0) {
        console.log('Issues found:');
        issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
        console.log('✅ All providers have appropriate volume data');
    }
}

// Run the test
testProviderDataIntegrity()
    .then(() => {
        console.log('\nTest completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    });