#!/usr/bin/env npx tsx

import { parsePageAdaptive, parseVolumeTables } from '../src/server/services/metadata/utils/fandomTableParser';

async function testUpdatedParser() {
  const url = 'https://fire-force.fandom.com/wiki/List_of_Volumes';

  console.log('Fetching:', url);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const html = await response.text();

  console.log('\n=== TESTING parseVolumeTables ===');
  const volumes = parseVolumeTables(html);

  console.log('\nVolumes found:', volumes.length);

  // Count total chapters
  let totalChapters = 0;
  volumes.forEach((vol, index) => {
    const chapterCount = vol.chapters?.length || 0;
    totalChapters += chapterCount;
    if (index < 3) { // Show first 3 volumes
      console.log(`\nVolume ${vol.number}:`);
      console.log(`  Title: ${vol.title}`);
      console.log(`  Chapters: ${chapterCount}`);
      if (vol.chapters && vol.chapters.length > 0) {
        vol.chapters.slice(0, 3).forEach(ch => {
          console.log(`    Chapter ${ch.number}: ${ch.title}`);
        });
        if (vol.chapters.length > 3) {
          console.log(`    ... and ${vol.chapters.length - 3} more chapters`);
        }
      }
    }
  });

  console.log(`\n=== TOTAL CHAPTERS EXTRACTED: ${totalChapters} ===`);

  console.log('\n=== TESTING parsePageAdaptive ===');
  const adaptiveResult = parsePageAdaptive(html);

  console.log('\nAdaptive parser results:');
  console.log('  Volumes:', adaptiveResult.volumes.length);
  console.log('  Chapters:', adaptiveResult.chapters.length);

  // Count chapters in volumes
  let volumeChapters = 0;
  adaptiveResult.volumes.forEach(vol => {
    volumeChapters += vol.chapters?.length || 0;
  });
  console.log('  Chapters in volumes:', volumeChapters);

  if (totalChapters < 300) {
    console.log('\n⚠️  WARNING: Expected ~305 chapters but only found', totalChapters);
  } else {
    console.log('\n✅ SUCCESS: Found all chapters!');
  }
}

testUpdatedParser().catch(console.error);