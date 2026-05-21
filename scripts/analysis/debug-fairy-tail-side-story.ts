import fetch from 'node-fetch';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';

async function debugFairyTailSideStory() {
  console.log('🔍 Debugging Fairy Tail Side Story Issue\n');
  
  const response = await fetch('https://fairytail.fandom.com/wiki/Volumes_and_Chapters');
  const html = await response.text();
  
  const volumes = parseVolumeTables(html);
  
  if (volumes.length > 0) {
    const firstVolume = volumes[0];
    console.log(`First Volume chapters (${firstVolume.chapters.length} total):`);
    
    firstVolume.chapters.forEach((chapter, idx) => {
      console.log(`\n${idx + 1}. Chapter: ${chapter.chapterNumber}`);
      console.log(`   Title: ${chapter.title}`);
      console.log(`   Japanese: ${chapter.japaneseTitle || 'N/A'}`);
    });
    
    // Count side stories
    const sideStories = firstVolume.chapters.filter(ch => ch.chapterNumber === 'SS');
    console.log(`\n⚠️  Found ${sideStories.length} side stories`);
    
    if (sideStories.length > 1) {
      console.log('\nSide story details:');
      sideStories.forEach((ss, idx) => {
        console.log(`  ${idx + 1}. ${ss.title} | Japanese: ${ss.japaneseTitle || 'N/A'}`);
      });
    }
  }
}

debugFairyTailSideStory().catch(console.error);