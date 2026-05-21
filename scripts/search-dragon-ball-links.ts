import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function searchForVolumeLinks() {
  const url = 'https://dragonball.fandom.com/wiki/Dragon_Ball_(manga)';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('Searching for volume-related links...\n');
  
  // Look for links containing "volume" or "chapter"
  const volumeLinks = $('a').filter((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text();
    return href.includes('volume') || href.includes('Volume') || 
           href.includes('chapter') || href.includes('Chapter') ||
           text.includes('Volume') || text.includes('Chapter');
  });
  
  console.log(`Found ${volumeLinks.length} volume/chapter related links\n`);
  
  // Show first 10
  volumeLinks.slice(0, 10).each((i, link) => {
    const $link = $(link);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();
    console.log(`${i + 1}. "${text}"`);
    console.log(`   href: ${href}`);
  });
  
  // Look for "List of" links
  console.log('\n\nSearching for "List of" links...');
  const listLinks = $('a').filter((_, el) => {
    const text = $(el).text();
    return text.includes('List of');
  });
  
  listLinks.each((i, link) => {
    const $link = $(link);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();
    console.log(`- "${text}"`);
    console.log(`  href: ${href}`);
  });
}

searchForVolumeLinks().catch(console.error);