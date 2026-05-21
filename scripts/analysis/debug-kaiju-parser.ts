import fetch from 'node-fetch';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';

async function debugKaijuParser() {
  console.log('🔍 Debugging Kaiju No. 8 Parser Output\n');
  
  const url = 'https://kaiju-no-8.fandom.com/wiki/Kaiju_No._8_(manga)';
  const response = await fetch(url);
  const html = await response.text();
  
  const volumes = parseVolumeTables(html);
  
  console.log(`Total volumes: ${volumes.length}`);
  const totalChapters = volumes.reduce((sum, vol) => sum + vol.chapters.length, 0);
  console.log(`Total chapters: ${totalChapters}\n`);
  
  // Show detailed info for each volume
  console.log('📚 Volume Details:\n');
  volumes.forEach(vol => {
    console.log(`Volume ${vol.volumeNumber}: ${vol.title}`);
    console.log(`  Release Date: ${vol.englishReleaseDate || 'N/A'}`);
    console.log(`  Chapters: ${vol.chapters.length}`);
    
    // Show first and last chapter details
    if (vol.chapters.length > 0) {
      const first = vol.chapters[0];
      const last = vol.chapters[vol.chapters.length - 1];
      
      console.log(`  First Chapter:`);
      console.log(`    Number: ${first.chapterNumber}`);
      console.log(`    Title: ${first.title}`);
      console.log(`    Volume: ${first.volumeNumber}`);
      
      if (vol.chapters.length > 1) {
        console.log(`  Last Chapter:`);
        console.log(`    Number: ${last.chapterNumber}`);
        console.log(`    Title: ${last.title}`);
        console.log(`    Volume: ${last.volumeNumber}`);
      }
      
      // Check if all chapters have the same title
      const uniqueTitles = new Set(vol.chapters.map(ch => ch.title));
      if (uniqueTitles.size === 1) {
        console.log(`  ⚠️  All chapters have the same title: "${vol.chapters[0].title}"`);
      }
    }
    
    console.log('');
  });
  
  // Check for generic chapter patterns
  console.log('🔍 Checking for Generic Chapter Data:\n');
  
  let genericChapters = 0;
  let chaptersWithTitles = 0;
  
  volumes.forEach(vol => {
    vol.chapters.forEach(ch => {
      if (ch.title === `Chapter ${parseInt(ch.chapterNumber, 10)}`) {
        genericChapters++;
      } else {
        chaptersWithTitles++;
      }
    });
  });
  
  console.log(`Generic chapters (just "Chapter X"): ${genericChapters}`);
  console.log(`Chapters with actual titles: ${chaptersWithTitles}`);
  
  if (genericChapters === totalChapters) {
    console.log('\n⚠️  WARNING: All chapters have generic titles!');
    console.log('This suggests the parser is not extracting actual chapter titles.');
  }
}

debugKaijuParser().catch(console.error);