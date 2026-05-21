import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function findDemonSlayerUrl() {
  // Try different possible URLs
  const urls = [
    'https://kimetsu-no-yaiba.fandom.com/wiki/List_of_Volumes',
    'https://kimetsu-no-yaiba.fandom.com/wiki/Volumes',
    'https://kimetsu-no-yaiba.fandom.com/wiki/Chapters_and_Volumes',
    'https://kimetsu-no-yaiba.fandom.com/wiki/Kimetsu_no_Yaiba_Wiki'
  ];
  
  for (const url of urls) {
    console.log(`\nTrying: ${url}`);
    try {
      const response = await fetch(url);
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        const title = $('title').text();
        const hasVolume = html.includes('Volume');
        const hasChapter = html.includes('Chapter');
        const tableCount = $('table').length;
        
        console.log(`  Status: ${response.status}`);
        console.log(`  Title: ${title}`);
        console.log(`  Contains "Volume": ${hasVolume}`);
        console.log(`  Contains "Chapter": ${hasChapter}`);
        console.log(`  Table count: ${tableCount}`);
        
        // Look for links to volume pages
        const volumeLinks = $('a').filter((_, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text();
          return (href.includes('volume') || href.includes('Volume')) && 
                 (text.includes('Volume') || text.includes('volume'));
        });
        
        if (volumeLinks.length > 0) {
          console.log(`  Volume links found: ${volumeLinks.length}`);
          volumeLinks.slice(0, 3).each((i, link) => {
            console.log(`    - ${$(link).text().trim()}: ${$(link).attr('href')}`);
          });
        }
      } else {
        console.log(`  Status: ${response.status} - Not Found`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
  
  // Try searching the wiki
  console.log('\n\nSearching wiki for volume pages...');
  const searchUrl = 'https://kimetsu-no-yaiba.fandom.com/api/v1/Search/List?query=volume&limit=10';
  try {
    const response = await fetch(searchUrl);
    if (response.ok) {
      const data = await response.json();
      console.log('Search results:');
      data.items?.forEach((item: any) => {
        if (item.title.toLowerCase().includes('volume')) {
          console.log(`- ${item.title}: ${item.url}`);
        }
      });
    }
  } catch (error) {
    console.log('Search error:', error.message);
  }
}

findDemonSlayerUrl().catch(console.error);