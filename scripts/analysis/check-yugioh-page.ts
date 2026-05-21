import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkYuGiOhPage() {
  console.log('🔍 Checking Yu-Gi-Oh! Page\n');
  
  const url = 'https://yugioh.fandom.com/wiki/List_of_Yu-Gi-Oh!_volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log(`Response status: ${response.status}`);
  console.log(`HTML length: ${html.length} characters`);
  
  // Check page title
  const title = $('title').text();
  console.log(`\nPage title: ${title}`);
  
  // Check for common elements
  console.log(`\nPage structure:`);
  console.log(`- Tables: ${$('table').length}`);
  console.log(`- Links: ${$('a').length}`);
  console.log(`- Images: ${$('img').length}`);
  console.log(`- H1 headers: ${$('h1').length}`);
  console.log(`- H2 headers: ${$('h2').length}`);
  console.log(`- H3 headers: ${$('h3').length}`);
  console.log(`- Lists: ${$('ul, ol').length}`);
  
  // Check for main content
  const content = $('#content, .mw-content-text, .WikiaMainContent').text().substring(0, 500);
  console.log(`\nMain content preview:\n${content}...`);
  
  // Look for specific patterns
  if (html.includes('redirect')) {
    console.log('\n⚠️  Page might be a redirect');
  }
  
  if (html.includes('404') || html.includes('not found')) {
    console.log('\n⚠️  Page might be 404');
  }
  
  // Check for navigation or volume links
  const links = $('a');
  const volumeLinks = links.filter((_, link) => {
    const text = $(link).text();
    return text.includes('Volume') || text.includes('Chapter') || text.includes('Duel');
  });
  
  console.log(`\n📋 Found ${volumeLinks.length} volume/chapter/duel links`);
  if (volumeLinks.length > 0) {
    console.log('Sample links:');
    volumeLinks.slice(0, 5).each((i, link) => {
      console.log(`  - ${$(link).text().trim()}: ${$(link).attr('href')}`);
    });
  }
}

checkYuGiOhPage().catch(console.error);