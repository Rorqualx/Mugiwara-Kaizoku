#!/usr/bin/env npx tsx

import { createSuccessResult, isSuccess, isError } from '../src/utils/async-result';

// Mock the comicvine service
const mockComicvineService = {
  initialize: async () => {},
  getCompleteVolumeInfo: async (id: number) => {
    console.log(`\n📡 Fetching ComicVine volume info for ID: ${id}`);

    // Simulate Fire Force response (ID: 95557)
    if (id === 95557) {
      return {
        id: 95557,
        name: "Fire Force",
        deck: "Fire Force is a manga series by Atsushi Ōkubo.",
        description: "<p>Fire Force is a manga series written and illustrated by Atsushi Ōkubo.</p>",
        image: {
          original_url: "https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/7123456-01.jpg",
          medium_url: "https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/7123456-01.jpg"
        },
        publisher: { name: "Kodansha Comics USA" },
        start_year: "2015",
        count_of_issues: 34,
        site_detail_url: "https://comicvine.gamespot.com/fire-force/4050-95557/",
        // Note: issues array is empty or limited - ComicVine doesn't always return all issues
        issues: [] // Empty for series with many issues
      };
    }

    return null;
  },
  getVolumeIssues: async (volumeId: number, offset: number, limit: number) => {
    console.log(`\n📚 Fetching issues for volume ${volumeId} (offset: ${offset}, limit: ${limit})`);
    // This would normally fetch all issues, but often fails or is rate limited
    throw new Error('Rate limited or incomplete data');
  }
};

async function testComicVineTRPC() {
  console.log('\n=== Testing ComicVine TRPC Endpoint Response ===\n');

  // Simulate what the TRPC endpoint does
  const itemId = "95557";
  const numericId = parseInt(itemId, 10);

  console.log(`Testing with Fire Force ID: ${numericId}`);

  try {
    // Initialize the service (mock)
    await mockComicvineService.initialize();

    // Fetch complete volume details
    const volume = await mockComicvineService.getCompleteVolumeInfo(numericId);

    if (!volume) {
      console.log('❌ Volume not found');
      return;
    }

    console.log('\nRaw Volume Data from ComicVine:');
    console.log('--------------------------------');
    console.log(`name: ${volume.name}`);
    console.log(`count_of_issues: ${volume.count_of_issues}`);
    console.log(`site_detail_url: ${volume.site_detail_url}`);
    console.log(`issues array length: ${volume.issues?.length || 0}`);
    console.log(`has issues data: ${(volume.issues && volume.issues.length > 0) ? 'YES' : 'NO'}`);

    // Try to fetch all issues (this often fails)
    let allIssues = volume.issues || [];

    if (volume.count_of_issues && volume.count_of_issues > (allIssues?.length || 0)) {
      console.log(`\n⚠️ Need to fetch ${volume.count_of_issues} issues (currently have ${allIssues.length})`);
      try {
        allIssues = await mockComicvineService.getVolumeIssues(numericId, 0, volume.count_of_issues);
        console.log(`✅ Successfully fetched ${allIssues.length} issues`);
      } catch (error: any) {
        console.log(`❌ Failed to fetch complete issues list: ${error.message}`);
        console.log('   Using empty issues array from volume response');
        allIssues = volume.issues || [];
      }
    }

    // Now simulate what sourceManagementService does with this data
    console.log('\n\n🔍 How sourceManagementService processes this:');
    console.log('-----------------------------------------------');

    const data = {
      ...volume,
      issues: allIssues,
      issueCount: volume.count_of_issues // TRPC endpoint maps count_of_issues to issueCount
    };

    const volumeCount = data.issueCount || 0;

    let volumeData: any[] = [];

    console.log(`\nChecking conditions:`);
    console.log(`- data.issues exists: ${!!data.issues}`);
    console.log(`- data.issues.length: ${data.issues?.length || 0}`);
    console.log(`- volumeCount: ${volumeCount}`);

    if (data.issues && data.issues.length > 0) {
      console.log('\n✅ Path 1: Using actual issue data from API');
      volumeData = data.issues.map((issue: any, index: number) => ({
        volumeNumber: index + 1,
        title: issue.name || `Issue #${issue.issue_number}`,
        status: 'has_api_data'
      }));
    } else if (volumeCount > 0) {
      console.log('\n✅ Path 2: Generating placeholder volumes from count');
      volumeData = Array.from({ length: volumeCount }, (_, i) => ({
        volumeNumber: i + 1,
        title: `Volume ${i + 1}`,
        status: 'pending_scrape'
      }));
    } else {
      console.log('\n❌ Path 3: No volume data generated!');
    }

    console.log(`\nGenerated volumeData array:`);
    console.log(`- Length: ${volumeData.length}`);
    if (volumeData.length > 0) {
      console.log(`- First volume:`, volumeData[0]);
      console.log(`- Last volume:`, volumeData[volumeData.length - 1]);
    }

    console.log('\n\n📊 Final Result:');
    console.log('----------------');
    console.log(`Title: ${data.name}`);
    console.log(`Volumes: ${volumeCount}`);
    console.log(`volumeData array length: ${volumeData.length}`);
    console.log(`Site URL: ${data.site_detail_url}`);

    console.log('\n✅ Test Results:');
    console.log('-----------------');
    const tests = [
      {
        name: 'TRPC returns issueCount field',
        pass: 'issueCount' in data,
        value: data.issueCount
      },
      {
        name: 'Issues array is empty (typical for large series)',
        pass: !data.issues || data.issues.length === 0,
        value: data.issues?.length || 0
      },
      {
        name: 'volumeData generated from count',
        pass: volumeData.length === 34,
        value: volumeData.length
      }
    ];

    tests.forEach(test => {
      console.log(`${test.pass ? '✅' : '❌'} ${test.name}: ${test.value}`);
    });

    console.log('\n🎯 Key Finding:');
    console.log('The ComicVine API typically returns an empty issues array for large series.');
    console.log('The sourceManagementService SHOULD fall into Path 2 and generate 34 placeholder volumes.');
    console.log(`Actually generated: ${volumeData.length} volumes`);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testComicVineTRPC();