#!/usr/bin/env npx tsx

console.log('Testing ComicVine data flow to identify where summary and chapter count are lost...\n');

// Add console log statements to trace the data
const tracePoints = [
    'getVolumesForSource: ComicVine section - check if description and chapterCount are present',
    'getChaptersForSource: volumesHaveChapterData check - are we preserving volume data?',
    'displayVolumes useMemo: Final volumes - check description and chapterCount',
    'Volume hover card: Check if description is accessible'
];

console.log('Key trace points to check:');
tracePoints.forEach((point, i) => {
    console.log(`${i + 1}. ${point}`);
});

console.log('\nTo debug, add these console.log statements:');
console.log(`
1. In getVolumesForSource (around line 9972):
   console.log('[ComicVine Volume]', {
       volumeNumber: issueNumber,
       description: issue.description || issue.deck,
       chapterCount: issue.chapterCount,
       hasChapters: !!(issue.chapters && issue.chapters.length > 0)
   });

2. In getChaptersForSource (around line 10460):
   console.log('[Volumes with chapters]', {
       volumesHaveChapterData,
       firstVolume: volumes[0],
       firstVolumeChapterCount: volumes[0]?.chapterCount,
       firstVolumeDescription: volumes[0]?.description
   });

3. In displayVolumes computation (around line 10700):
   console.log('[Display Volumes Final]', {
       firstVolume: volumesWithChapters[0],
       hasDescription: !!volumesWithChapters[0]?.description,
       chapterCount: volumesWithChapters[0]?.chapterCount
   });
`);

console.log('\nExpected data flow:');
console.log('1. ComicVine scraping adds volumeSummary → issue.description');
console.log('2. getVolumesForSource preserves description field');
console.log('3. getChaptersForSource preserves volume fields via spread operator');
console.log('4. displayVolumes should have all volume data intact');
console.log('5. Volume hover card should show description');