import fetch from 'node-fetch';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';

async function traceFullParsing() {
  try {
    console.log('Testing One Piece volumes page with full tracing...');
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    
    // Add temporary logging by modifying the HTML
    const modifiedHtml = html.replace('<body', '<script>console.log("Parser running")</script><body');
    
    console.log('\\nCalling parseVolumeTables...');
    const volumes = parseVolumeTables(html);
    
    console.log(`\\nResult: Found ${volumes.length} volumes`);
    
    // Check what was found
    if (volumes.length > 0) {
      console.log('\\nFirst volume:');
      const vol1 = volumes[0];
      console.log(`  Number: ${vol1.volumeNumber}`);
      console.log(`  Title: "${vol1.title}"`);
      console.log(`  Japanese Title: "${vol1.japaneseTitle || 'N/A'}"`);
      console.log(`  Chapters: ${vol1.chapters.length}`);
      
      // Check if this is header data
      if (vol1.title === 'Title') {
        console.log('  ⚠️  WARNING: This is header data, not actual volume data!');
      }
      
      // List all volume numbers
      const volumeNumbers = volumes.map(v => v.volumeNumber).sort((a, b) => a - b);
      console.log(`\\nAll volume numbers: ${volumeNumbers.join(', ')}`);
      
      // Check the pattern
      const gaps = [];
      for (let i = 1; i < volumeNumbers.length; i++) {
        const gap = volumeNumbers[i] - volumeNumbers[i-1];
        if (gap !== 1) gaps.push(gap);
      }
      
      if (gaps.length > 0 && gaps.every(g => g === 10)) {
        console.log('\\n⚠️  Pattern detected: Only finding every 10th volume (1, 11, 21, etc.)');
        console.log('This suggests arc-based parsing is being used incorrectly.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

traceFullParsing();