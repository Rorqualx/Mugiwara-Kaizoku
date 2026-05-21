#!/usr/bin/env npx tsx

import { SearchResultValidator } from '../src/server/services/search/providers/SearchResultValidator.js';

// Test the complete ComicVine flow
async function testComicVineFlow() {
  console.log('\n=== Testing Complete ComicVine Flow ===\n');

  // 1. Create a mock ComicVine search result like what the API returns
  const mockSearchResult = {
    id: 'comicvine_95557',
    sourceId: '95557',
    volumeId: 95557,
    comicvineId: '95557',
    resource_id: '95557',
    name: 'Fire Force',  // ComicVine uses 'name' not 'title'
    description: 'Fire Force is a manga series by Atsushi Ōkubo.',
    image: {
      original_url: 'https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/7123456-01.jpg'
    },
    site_detail_url: 'https://comicvine.gamespot.com/fire-force/4050-95557/',
    api_detail_url: 'https://comicvine.gamespot.com/api/volume/4050-95557/',
    publisher: {
      name: 'Kodansha Comics USA'
    },
    start_year: '2015',
    // The key fields that come from the API
    count_of_issues: 34,  // This is what ComicVine returns for volume count
    issuesCount: 34,  // Sometimes also in this field
    provider: 'COMICVINE',
    issues: [] // Typically empty for large series
  };

  console.log('1. Mock ComicVine Search Result:');
  console.log('   - count_of_issues:', mockSearchResult.count_of_issues);
  console.log('   - issues array:', mockSearchResult.issues.length);

  // 2. Validate through SearchResultValidator
  const validatedResult = SearchResultValidator.validateAndTransform(mockSearchResult, 'COMICVINE');

  if (!validatedResult) {
    console.error('❌ SearchResultValidator returned null!');
    return;
  }

  console.log('\n2. After SearchResultValidator:');
  console.log('   - issuesCount:', validatedResult.issuesCount);
  console.log('   - metadata.volumes:', validatedResult.metadata?.volumes);
  console.log('   - metadata.chapters:', validatedResult.metadata?.chapters);
  console.log('   - metadata.volumeData length:', validatedResult.metadata?.volumeData?.length || 0);
  console.log('   - metadata.volumeData[0]:', validatedResult.metadata?.volumeData?.[0]);

  // 3. Simulate what sourceManagementService.fetchComicvineMetadata would do
  const volumeCount = validatedResult.metadata?.volumes || validatedResult.issuesCount || 0;
  let volumeData = [];

  if (validatedResult.metadata?.volumeData && validatedResult.metadata.volumeData.length > 0) {
    console.log('\n3. Using volumeData from SearchResultValidator');
    volumeData = validatedResult.metadata.volumeData;
  } else if (volumeCount > 0) {
    console.log('\n3. Generating volumeData from count (fallback)');
    volumeData = Array.from({ length: volumeCount }, (_, i) => ({
      volumeNumber: i + 1,
      title: `Volume ${i + 1}`,
      issueNumber: String(i + 1),
      coverImageUrl: undefined,
      chapterCount: 9,
      chapters: [],
      status: 'pending_scrape'
    }));
  }

  console.log('   - Final volumeData length:', volumeData.length);
  console.log('   - First volume:', volumeData[0]);
  console.log('   - Last volume:', volumeData[volumeData.length - 1]);

  // 4. Simulate what getVolumesForSource would return
  const metadata = {
    id: validatedResult.id,
    title: validatedResult.title,
    volumes: validatedResult.metadata?.volumes || validatedResult.issuesCount,
    chapters: validatedResult.metadata?.chapters || 0,
    volumeData: volumeData
  };

  console.log('\n4. Metadata for getVolumesForSource:');
  console.log('   - Has volumeData:', !!metadata.volumeData);
  console.log('   - volumeData length:', metadata.volumeData?.length || 0);
  console.log('   - volumes count:', metadata.volumes);
  console.log('   - chapters count:', metadata.chapters);

  // 5. Simulate getVolumesForSource logic
  let volumesForUI = [];
  if (metadata.volumeData && Array.isArray(metadata.volumeData) && metadata.volumeData.length > 0) {
    volumesForUI = metadata.volumeData;
    console.log('\n5. getVolumesForSource would return volumeData');
  } else {
    console.log('\n5. getVolumesForSource would return empty array');
  }

  console.log('   - UI would receive', volumesForUI.length, 'volumes');

  // 6. Test results
  console.log('\n=== Test Results ===');
  const tests = [
    {
      name: 'SearchResultValidator generates volumeData',
      pass: validatedResult.metadata?.volumeData && validatedResult.metadata.volumeData.length === 34,
      expected: 34,
      actual: validatedResult.metadata?.volumeData?.length || 0
    },
    {
      name: 'Each volume has chapterCount > 0',
      pass: validatedResult.metadata?.volumeData?.every((v: any) => v.chapterCount > 0),
      expected: true,
      actual: validatedResult.metadata?.volumeData?.every((v: any) => v.chapterCount > 0) || false
    },
    {
      name: 'Volumes estimated at 34',
      pass: validatedResult.metadata?.volumes === 34,
      expected: 34,
      actual: validatedResult.metadata?.volumes
    },
    {
      name: 'Chapters estimated at 306 (34 * 9)',
      pass: validatedResult.metadata?.chapters === 306,
      expected: 306,
      actual: validatedResult.metadata?.chapters
    },
    {
      name: 'UI receives volumeData',
      pass: volumesForUI.length === 34,
      expected: 34,
      actual: volumesForUI.length
    }
  ];

  tests.forEach(test => {
    const symbol = test.pass ? '✅' : '❌';
    console.log(`${symbol} ${test.name}`);
    if (!test.pass) {
      console.log(`   Expected: ${test.expected}, Actual: ${test.actual}`);
    }
  });

  const allPassed = tests.every(t => t.pass);
  console.log('\n' + (allPassed ? '🎉 All tests passed!' : '❌ Some tests failed'));
}

// Run the test
testComicVineFlow().catch(console.error);