import fetch from 'node-fetch';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser.js';

async function testImprovedParser() {
  try {
    console.log('Fetching Fire Force volumes page...');
    const response = await fetch('https://fire-force.fandom.com/wiki/List_of_Volumes');
    const html = await response.text();
    
    console.log('Parsing volume tables with improved parser...');
    const volumes = parseVolumeTables(html);
    
    console.log(`\nFound ${volumes.length} volumes`);
    
    // Count total chapters
    let totalChapters = 0;
    const chapterSet = new Set();
    
    volumes.forEach(volume => {
      console.log(`\nVolume ${volume.volumeNumber}: ${volume.title}`);
      console.log(`  Chapters: ${volume.chapters.length}`);
      console.log(`  Cover Character: ${volume.coverCharacter || 'N/A'}`);
      console.log(`  ISBN (EN): ${volume.isbn || 'N/A'}`);
      console.log(`  ISBN (JP): ${volume.japaneseIsbn || 'N/A'}`);
      console.log(`  Release Date (EN): ${volume.englishReleaseDate || 'N/A'}`);
      console.log(`  Release Date (JP): ${volume.japaneseReleaseDate || 'N/A'}`);
      console.log(`  Page Count: ${volume.pageCount || 'N/A'}`);
      
      if (volume.chapters.length > 0) {
        console.log('  First few chapters:');
        volume.chapters.slice(0, 3).forEach(ch => {
          console.log(`    Chapter ${ch.chapterNumber}: ${ch.title}`);
          if (ch.japaneseTitle) {
            console.log(`      Japanese: ${ch.japaneseTitle}`);
          }
        });
      }
      
      // Track unique chapters
      volume.chapters.forEach(ch => {
        chapterSet.add(ch.chapterNumber);
      });
      
      totalChapters += volume.chapters.length;
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total volumes: ${volumes.length}`);
    console.log(`Total chapters (with duplicates): ${totalChapters}`);
    console.log(`Unique chapters: ${chapterSet.size}`);
    console.log(`Expected: 304 chapters`);
    
    // Check if we're getting the correct number
    if (chapterSet.size === 304) {
      console.log('\n✅ SUCCESS: Parser is now extracting the correct number of chapters!');
    } else if (chapterSet.size < 304) {
      console.log(`\n⚠️  WARNING: Missing ${304 - chapterSet.size} chapters`);
    } else {
      console.log(`\n❌ ERROR: Still extracting too many chapters (${chapterSet.size - 304} extra)`);
    }
    
    // Show chapter number range
    const chapterNumbers = Array.from(chapterSet).map(num => parseInt(num)).sort((a, b) => a - b);
    console.log(`\nChapter range: ${chapterNumbers[0]} - ${chapterNumbers[chapterNumbers.length - 1]}`);
    
    // Check for gaps
    const expectedChapters = Array.from({length: 304}, (_, i) => i);
    const missingChapters = expectedChapters.filter(num => !chapterNumbers.includes(num));
    if (missingChapters.length > 0) {
      console.log(`\nMissing chapters: ${missingChapters.join(', ')}`);
    }
    
  } catch (error) {
    console.error('Error testing parser:', error);
  }
}

testImprovedParser();