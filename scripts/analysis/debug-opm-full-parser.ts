import fetch from 'node-fetch';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';

async function debugOPMFullParser() {
  console.log('🔍 Debugging OPM with Full Parser\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Volumes';
  const response = await fetch(url);
  const html = await response.text();
  
  // Add a marker to help debug
  console.log('HTML length:', html.length);
  console.log('Contains "Punch":', html.includes('Punch'));
  console.log('Contains "Volume":', html.includes('Volume'));
  
  console.log('\nCalling parseVolumeTables...\n');
  
  const volumes = parseVolumeTables(html);
  
  console.log(`\n📊 Results:`);
  console.log(`Volumes parsed: ${volumes.length}`);
  
  if (volumes.length > 0) {
    console.log('\nFirst volume:');
    console.log(`  Number: ${volumes[0].volumeNumber}`);
    console.log(`  Title: ${volumes[0].title}`);
    console.log(`  Chapters: ${volumes[0].chapters.length}`);
    
    if (volumes[0].chapters.length > 0) {
      console.log(`  First chapter: ${volumes[0].chapters[0].chapterNumber} - ${volumes[0].chapters[0].title}`);
    }
  }
}

debugOPMFullParser().catch(console.error);