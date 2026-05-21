#!/usr/bin/env npx tsx

/**
 * Fire Force Import Analysis Script
 * Tests data consistency and completeness across different source configurations
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const API_BASE_URL = 'http://localhost:3000/api/trpc';

interface ProviderResult {
  id: string;
  title: string;
  cover?: string;
  coverImage?: string;
  description?: string;
  status?: string;
  alternativeTitles?: string[];
  score?: number;
  popularity?: number;
  startDate?: any;
  endDate?: any;
  genres?: string[];
  volumes?: number;
  chapters?: number;
  bannerImage?: string;
  averageScore?: number;
  format?: string;
  isAdult?: boolean;
  meanScore?: number;
  trending?: number;
  comicvineId?: number;
  issueCount?: number;
  volumeList?: any[];
  chapterList?: any[];
  [key: string]: any;
}

async function searchProvider(title: string, providers: string[]): Promise<Record<string, ProviderResult[]>> {
  try {
    const params = new URLSearchParams({
      batch: '1',
      input: JSON.stringify({
        "0": {
          json: {
            title,
            providers
          }
        }
      })
    });

    const response = await axios.get(`${API_BASE_URL}/manga.searchProviderConfirmation?${params}`);

    if (response.data?.[0]?.result?.data?.json) {
      return response.data[0].result.data.json;
    }
    return {};
  } catch (error: any) {
    console.error(`Error searching providers: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
    }
    return {};
  }
}

async function testFireForceImport() {
  console.log('🔥 Fire Force Import Analysis\n');
  console.log('='.repeat(80));

  const providers = ['anilist', 'fandom', 'comicvine'];
  const searchTitle = 'Fire Force';

  // Step 1: Search all providers to get baseline data
  console.log('\n📊 Step 1: Searching all providers for Fire Force...\n');
  const allProvidersSearch = await searchProvider(searchTitle, providers);

  for (const [provider, items] of Object.entries(allProvidersSearch)) {
    console.log(`${provider}: Found ${items.length} results`);
    if (items.length > 0 && items[0]) {
      const item = items[0];
      console.log(`  - Top result: ${item.title}`);
      console.log(`  - Has cover: ${!!(item.cover || item.coverImage)}`);
      console.log(`  - Has description: ${!!item.description}`);
      console.log(`  - Has volumes: ${item.volumes !== undefined ? item.volumes : 'undefined'}`);
      console.log(`  - Has chapters: ${item.chapters !== undefined ? item.chapters : 'undefined'}`);
      
      // Show all available fields
      const fields = Object.keys(item).filter(k => item[k] !== undefined && item[k] !== null);
      console.log(`  - Available fields: ${fields.join(', ')}`);
    }
  }

  // Step 2: Test each provider individually
  console.log('\n📊 Step 2: Testing each provider individually...\n');

  for (const provider of providers) {
    console.log(`\n🔍 Testing ${provider.toUpperCase()} alone:`);
    console.log('-'.repeat(40));

    const singleProviderSearch = await searchProvider(searchTitle, [provider]);
    const results = singleProviderSearch[provider];

    if (results && results.length > 0) {
      const item = results[0];
      const fields = Object.keys(item).filter(k => item[k] !== undefined && item[k] !== null);
      console.log(`  Found ${results.length} results`);
      console.log(`  Fields returned: ${fields.join(', ')}`);
      
      // Check specific fields
      if (provider === 'anilist') {
        console.log(`  - averageScore: ${item.averageScore}`);
        console.log(`  - meanScore: ${item.meanScore}`);
        console.log(`  - trending: ${item.trending}`);
        console.log(`  - format: ${item.format}`);
        console.log(`  - bannerImage: ${item.bannerImage ? 'present' : 'missing'}`);
      } else if (provider === 'comicvine') {
        console.log(`  - comicvineId: ${item.comicvineId}`);
        console.log(`  - issueCount: ${item.issueCount}`);
        console.log(`  - volumeList: ${item.volumeList ? `${item.volumeList.length} volumes` : 'missing'}`);
      } else if (provider === 'fandom') {
        console.log(`  - volumes: ${item.volumes}`);
        console.log(`  - chapters: ${item.chapters}`);
        console.log(`  - chapterList: ${item.chapterList ? `${item.chapterList.length} chapters` : 'missing'}`);
      }
    } else {
      console.log('  No results returned');
    }
  }

  // Step 3: Compare data completeness
  console.log('\n📊 Step 3: Data Completeness Comparison\n');
  console.log('='.repeat(80));

  // Compare what each provider returns when searched alone vs together
  for (const provider of providers) {
    const alone = await searchProvider(searchTitle, [provider]);
    const together = await searchProvider(searchTitle, providers);

    const aloneResult = alone[provider]?.[0];
    const togetherResult = together[provider]?.[0];

    if (aloneResult && togetherResult) {
      const aloneFields = Object.keys(aloneResult).filter(k => aloneResult[k] !== undefined);
      const togetherFields = Object.keys(togetherResult).filter(k => togetherResult[k] !== undefined);

      const missingWhenTogether = aloneFields.filter(f => !togetherFields.includes(f));
      const extraWhenTogether = togetherFields.filter(f => !aloneFields.includes(f));

      console.log(`\n${provider.toUpperCase()}:`);
      console.log(`  Fields when alone: ${aloneFields.length}`);
      console.log(`  Fields when with others: ${togetherFields.length}`);

      if (missingWhenTogether.length > 0) {
        console.log(`  ❌ Missing when searched with others: ${missingWhenTogether.join(', ')}`);
      }
      if (extraWhenTogether.length > 0) {
        console.log(`  ➕ Extra when searched with others: ${extraWhenTogether.join(', ')}`);
      }
      if (missingWhenTogether.length === 0 && extraWhenTogether.length === 0) {
        console.log(`  ✅ Consistent data in both scenarios`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Analysis complete!');
}

// Run the test
testFireForceImport()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
