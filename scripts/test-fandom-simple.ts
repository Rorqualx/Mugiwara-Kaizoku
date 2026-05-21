#!/usr/bin/env tsx
/**
 * Simple test for Fandom integration - Fire Force
 */

import { FandomService } from '../src/server/services/fandom/FandomService';

async function testFireForce() {
  console.log('Testing Fire Force Fandom...\n');

  const service = new FandomService('fire-force');

  try {
    console.log('Step 1: Basic search without details...');
    const basicResults = await service.search('Fire Force', {
      limit: 1,
      type: 'manga'
    });

    console.log(`Found ${basicResults.length} results\n`);

    if (basicResults.length > 0) {
      const result = basicResults[0];
      console.log('Basic result:');
      console.log(`- Title: ${result.title}`);
      console.log(`- Type: ${result.type}`);
      console.log(`- URL: ${result.url}`);
      console.log(`- Has metadata: ${!!result.metadata}`);
      if (result.metadata) {
        console.log(`- Volumes: ${result.metadata.volumes}`);
        console.log(`- Chapters: ${result.metadata.chapters}`);
      }
    }

    console.log('\nStep 2: Search with details...');
    const detailedResults = await service.search('Fire Force', {
      limit: 1,
      type: 'manga',
      includeDetails: true
    });

    console.log(`Found ${detailedResults.length} detailed results\n`);

    if (detailedResults.length > 0) {
      const result = detailedResults[0];
      console.log('Detailed result:');
      console.log(`- Title: ${result.title}`);
      console.log(`- Type: ${result.type}`);
      console.log(`- URL: ${result.url}`);
      console.log(`- Has metadata: ${!!result.metadata}`);
      if (result.metadata) {
        console.log('\nMetadata:');
        console.log(`- Volumes: ${result.metadata.volumes}`);
        console.log(`- Chapters: ${result.metadata.chapters}`);
        console.log(`- Author: ${result.metadata.author}`);
        console.log(`- Status: ${result.metadata.status}`);
        console.log(`- Publisher: ${result.metadata.publisher}`);

        const expectedVolumes = 34;
        if (result.metadata.volumes === expectedVolumes) {
          console.log(`\n✅ Volume count is correct: ${result.metadata.volumes}`);
        } else {
          console.log(`\n❌ Volume count incorrect: Expected ${expectedVolumes}, got ${result.metadata.volumes}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    service.destroy();
  }
}

testFireForce();