import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkKaijuChapterTitles() {
  console.log('🔍 Checking Kaiju No. 8 for Chapter Titles\n');
  
  // First, check the main page structure again
  const mainUrl = 'https://kaiju-no-8.fandom.com/wiki/Kaiju_No._8_(manga)';
  const response = await fetch(mainUrl);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📄 Checking main page table structure:\n');
  
  const fandomTable = $('table.fandom-table').first();
  const rows = fandomTable.find('tr');
  
  // Look at first few chapter rows
  let volumeNum = 0;
  rows.slice(1, 10).each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td');
    
    if (i % 2 === 0 && cells.length === 3) {
      volumeNum = parseInt(cells.eq(0).text().trim(), 10);
      console.log(`\nVolume ${volumeNum}:`);
    } else if (i % 2 === 1) {
      console.log('  Chapter row HTML (first 200 chars):');
      const cellHtml = $row.html()?.substring(0, 200);
      console.log(`    ${cellHtml}...`);
      
      // Check the actual links
      const links = $row.find('a[href*="/Chapter_"]');
      console.log(`  Found ${links.length} chapter links:`);
      
      links.slice(0, 3).each((j, link) => {
        const $link = $(link);
        const text = $link.text().trim();
        const href = $link.attr('href');
        const title = $link.attr('title');
        
        console.log(`    Link ${j + 1}:`);
        console.log(`      Text: "${text}"`);
        console.log(`      Href: ${href}`);
        console.log(`      Title attr: ${title || 'none'}`);
      });
    }
  });
  
  // Now let's check a specific chapter page to see if titles are there
  console.log('\n\n📄 Checking individual chapter page:\n');
  
  const chapterUrl = 'https://kaiju-no-8.fandom.com/wiki/Chapter_1';
  console.log(`Fetching: ${chapterUrl}`);
  
  try {
    const chapterResponse = await fetch(chapterUrl);
    const chapterHtml = await chapterResponse.text();
    const $chapter = cheerio.load(chapterHtml);
    
    // Look for title in various places
    const pageTitle = $chapter('h1.page-header__title').text().trim();
    console.log(`Page title: "${pageTitle}"`);
    
    // Check infobox
    const infobox = $chapter('.portable-infobox');
    if (infobox.length > 0) {
      console.log('\nFound infobox:');
      
      const titleRow = infobox.find('.pi-item').filter((_, item) => {
        const label = $chapter(item).find('.pi-data-label').text();
        return label.includes('Title') || label.includes('Name');
      });
      
      titleRow.each((_, row) => {
        const label = $chapter(row).find('.pi-data-label').text().trim();
        const value = $chapter(row).find('.pi-data-value').text().trim();
        console.log(`  ${label}: "${value}"`);
      });
    }
    
    // Check for chapter title in the content
    const contentHeaders = $chapter('h2, h3').filter((_, header) => {
      const text = $chapter(header).text();
      return !text.includes('Contents') && !text.includes('Navigation');
    });
    
    console.log('\nContent headers:');
    contentHeaders.slice(0, 5).each((_, header) => {
      console.log(`  ${header.tagName}: "${$chapter(header).text().trim()}"`);
    });
  } catch (error) {
    console.log(`Error fetching chapter page: ${error.message}`);
  }
}

checkKaijuChapterTitles().catch(console.error);