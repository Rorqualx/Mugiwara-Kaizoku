const axios = require('axios');
const { parseFandomVolumeList } = require('./dist/api/metadataProviders/utils/fandomTableParser.js');

async function testFireForceParser() {
  try {
    console.log('Fetching Fire Force volumes page...');
    const response = await axios.get('https://fire-force.fandom.com/wiki/List_of_Volumes');
    
    console.log('Parsing volume data...');
    const volumes = parseFandomVolumeList(response.data, 'https://fire-force.fandom.com/wiki/List_of_Volumes');
    
    console.log(`\nFound ${volumes.length} volumes\n`);
    
    // Count chapters with URLs
    let totalChapters = 0;
    let chaptersWithUrls = 0;
    
    volumes.forEach((vol, index) => {
      if (index < 3) { // Show first 3 volumes for brevity
        console.log(`Volume ${vol.volumeNumber}: ${vol.title}`);
        console.log(`  Chapters: ${vol.chapters.length}`);
        
        vol.chapters.forEach(ch => {
          totalChapters++;
          if (ch.url) {
            chaptersWithUrls++;
            if (chaptersWithUrls <= 5) { // Show first 5 URLs as examples
              console.log(`    Ch ${ch.chapterNumber}: ${ch.title} - URL: ${ch.url}`);
            }
          }
        });
        console.log('');
      } else {
        vol.chapters.forEach(ch => {
          totalChapters++;
          if (ch.url) chaptersWithUrls++;
        });
      }
    });
    
    console.log(`\nSummary:`);
    console.log(`Total volumes: ${volumes.length}`);
    console.log(`Total chapters: ${totalChapters}`);
    console.log(`Chapters with URLs: ${chaptersWithUrls}`);
    console.log(`Chapters without URLs: ${totalChapters - chaptersWithUrls}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFireForceParser();