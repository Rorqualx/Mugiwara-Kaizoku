/**
 * Test Complete Pack Detection Improvements
 *
 * Verifies that the enhanced complete pack detection correctly identifies
 * volume ranges, chapter ranges, and explicit keywords.
 */

import { ProwlarrMangaSearch } from '../src/server/services/prowlarr/mangaSearch';

// Test titles from real Fire Force search results
const TEST_TITLES = [
  // Should be detected as complete packs:
  {
    title: 'Fire Force v01-30 (2016-2021) (Digital SD) (KG Manga)',
    expected: true,
    reason: 'Volume range v01-30'
  },
  {
    title: '炎炎ノ消防隊 {Enen no Shouboutai, Fire Force} v01-30 (2016-2021) (Digital SD) (KG Manga)',
    expected: true,
    reason: 'Volume range v01-30'
  },
  {
    title: 'Fire Force Complete Collection (Digital)',
    expected: true,
    reason: 'Keyword: Complete'
  },
  {
    title: 'Fire Force Full Series Vol 1-30',
    expected: true,
    reason: 'Keyword: Full + volume range'
  },
  {
    title: 'Fire Force Chapters 1-300 (Complete)',
    expected: true,
    reason: 'Large chapter range (300) + Complete keyword'
  },

  // Should NOT be detected as complete packs:
  {
    title: 'Fire Force v14-17 (2019) (Digital) (FG-Manga)',
    expected: false,
    reason: 'Small volume range (only 4 volumes)'
  },
  {
    title: 'Fire Force Chapter 235',
    expected: false,
    reason: 'Single chapter'
  },
  {
    title: 'Fire Force Vol 22',
    expected: false,
    reason: 'Single volume'
  },
  {
    title: 'Fire Force 1-10',
    expected: false,
    reason: 'Small chapter range (only 10 chapters)'
  }
];

function testCompletePackDetection() {
  console.log('\n' + '='.repeat(100));
  console.log('COMPLETE PACK DETECTION TEST');
  console.log('='.repeat(100) + '\n');

  const prowlarrSearch = new ProwlarrMangaSearch();
  let passed = 0;
  let failed = 0;

  TEST_TITLES.forEach((test, index) => {
    const result = prowlarrSearch.isCompletePack(test.title);
    const success = result === test.expected;

    if (success) {
      console.log(`✅ Test ${index + 1} PASSED`);
      passed++;
    } else {
      console.log(`❌ Test ${index + 1} FAILED`);
      failed++;
    }

    console.log(`   Title: ${test.title}`);
    console.log(`   Expected: ${test.expected} (${test.reason})`);
    console.log(`   Got: ${result}`);
    console.log('');
  });

  console.log('='.repeat(100));
  console.log('RESULTS');
  console.log('='.repeat(100));
  console.log(`Total Tests: ${TEST_TITLES.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / TEST_TITLES.length) * 100).toFixed(1)}%`);
  console.log('');

  if (failed === 0) {
    console.log('🎉 All tests passed! Complete pack detection is working correctly.');
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Review detection logic.`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

testCompletePackDetection();
