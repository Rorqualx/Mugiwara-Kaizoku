import fetch from 'node-fetch';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';

async function debugParsedVolumes() {
  try {
    console.log('Testing One Piece volumes page...');
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    
    console.log('Parsing volume tables...');
    const volumes = parseVolumeTables(html);
    
    console.log(`\\nFound ${volumes.length} volumes`);
    
    // Debug what was parsed
    volumes.forEach((vol, i) => {
      console.log(`\\nVolume at index ${i}:`);
      console.log(`  Number: ${vol.volumeNumber}`);
      console.log(`  Title: "${vol.title}"`);
      console.log(`  Japanese Title: "${vol.japaneseTitle || 'N/A'}"`);
      console.log(`  Chapters: ${vol.chapters.length}`);
      
      if (vol.volumeNumber === 1 && vol.title === 'Title') {
        console.log('  ⚠️  This looks like header data was parsed as volume data!');
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugParsedVolumes();