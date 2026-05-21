import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeCaptainTsubasaVolumes() {
  console.log('🔍 Analyzing Captain Tsubasa Volumes Page\n');
  
  // Try the volumes category page
  const url = 'https://captaintsubasa.fandom.com/wiki/Category:Captain_Tsubasa_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📊 Category Page Analysis:\n');
  
  // Check for category listings
  const categoryItems = $('.category-page__member');
  console.log(`Category items found: ${categoryItems.length}`);
  
  if (categoryItems.length > 0) {
    console.log('\nFirst 5 items:');
    categoryItems.slice(0, 5).each((i, item) => {
      const link = $(item).find('a');
      console.log(`  ${i + 1}. "${link.text().trim()}" -> ${link.attr('href')}`);
    });
  }
  
  // Check if there's a main series page
  console.log('\n\n📚 Checking main manga page structure:\n');
  
  const mainUrl = 'https://captaintsubasa.fandom.com/wiki/Captain_Tsubasa_(manga)';
  const mainResponse = await fetch(mainUrl);
  const mainHtml = await mainResponse.text();
  const $main = cheerio.load(mainHtml);
  
  // Look for volume information in various formats
  const patterns = [
    { selector: 'h2', name: 'Headers' },
    { selector: 'h3', name: 'Subheaders' },
    { selector: '.mw-headline', name: 'MW Headlines' },
    { selector: '.wikitable', name: 'Wiki Tables' },
    { selector: '.article-table', name: 'Article Tables' },
    { selector: 'table', name: 'All Tables' }
  ];
  
  patterns.forEach(({ selector, name }) => {
    const elements = $main(selector);
    console.log(`${name}: ${elements.length}`);
    
    if (elements.length > 0 && elements.length < 10) {
      elements.each((i, el) => {
        const text = $main(el).text().trim().substring(0, 100);
        console.log(`  - "${text}${text.length >= 100 ? '...' : ''}"`);
      });
    }
  });
  
  // Look for any text containing volume information
  console.log('\n📝 Searching for volume text patterns:\n');
  
  const volumeTexts = $main('*').filter((_, el) => {
    const text = $main(el).text();
    return /Volume \d+/.test(text) && text.length < 500;
  });
  
  console.log(`Elements containing "Volume X": ${volumeTexts.length}`);
  
  // Check for lists
  const lists = $main('ul, ol').filter((_, list) => {
    const text = $main(list).text();
    return text.includes('Chapter') || text.includes('Volume');
  });
  
  console.log(`\nLists mentioning chapters/volumes: ${lists.length}`);
  
  if (lists.length > 0) {
    console.log('\nFirst list structure:');
    const firstList = lists.first();
    const items = firstList.find('li');
    console.log(`  Items: ${items.length}`);
    items.slice(0, 3).each((i, item) => {
      console.log(`  ${i + 1}. "${$main(item).text().trim().substring(0, 80)}..."`);
    });
  }
  
  // Check for a volumes section
  const volumeSections = $main('[id*="Volume"], [id*="volume"], .mw-headline').filter((_, el) => {
    return /volume/i.test($main(el).text());
  });
  
  console.log(`\nVolume-related sections: ${volumeSections.length}`);
  volumeSections.each((i, section) => {
    console.log(`  ${i + 1}. ID: ${$main(section).attr('id')}, Text: "${$main(section).text().trim()}"`);
  });
}

analyzeCaptainTsubasaVolumes().catch(console.error);