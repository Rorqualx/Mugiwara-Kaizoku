import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeCaptainTsubasa() {
  console.log('🔍 Analyzing Captain Tsubasa Wiki Structure\n');
  
  const url = 'https://captaintsubasa.fandom.com/wiki/Captain_Tsubasa_(manga)#Manga';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📊 Page Analysis:\n');
  
  // Check for tables
  const allTables = $('table');
  console.log(`Total tables found: ${allTables.length}`);
  
  // Look for volume/chapter related content
  console.log('\n📚 Looking for volume/chapter content:\n');
  
  // Check section headers
  const headers = $('h2, h3').filter((_, el) => {
    const text = $(el).text();
    return text.includes('Volume') || text.includes('Chapter') || text.includes('Manga');
  });
  
  console.log(`Found ${headers.length} relevant headers:`);
  headers.each((i, header) => {
    console.log(`  ${header.tagName}: "${$(header).text().trim()}"`);
  });
  
  // Look for lists of volumes
  console.log('\n📋 Checking for volume lists:\n');
  
  const volumeLists = $('ul, ol').filter((_, list) => {
    const text = $(list).text();
    return text.includes('Volume') && (text.includes('Chapter') || /\d+-\d+/.test(text));
  });
  
  console.log(`Found ${volumeLists.length} potential volume lists`);
  
  if (volumeLists.length > 0) {
    const firstList = volumeLists.first();
    const items = firstList.find('li');
    console.log(`\nFirst list has ${items.length} items`);
    
    // Show first few items
    console.log('\nFirst 3 items:');
    items.slice(0, 3).each((i, item) => {
      const text = $(item).text().trim();
      console.log(`  ${i + 1}. "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    });
  }
  
  // Check if there's a tabber system
  const tabbers = $('.tabber, .wds-tabber');
  console.log(`\n📑 Tabber system: ${tabbers.length > 0 ? 'Yes' : 'No'}`);
  
  if (tabbers.length > 0) {
    console.log('\nTab titles:');
    const tabs = tabbers.find('.wds-tabs__tab-label, .tabbertab');
    tabs.each((i, tab) => {
      console.log(`  - "${$(tab).text().trim()}"`);
    });
  }
  
  // Look for wikia galleries
  const galleries = $('.wikia-gallery, .gallery');
  console.log(`\n🖼️ Galleries found: ${galleries.length}`);
  
  // Check for specific patterns in the HTML
  console.log('\n🔍 Checking for specific patterns:\n');
  
  // Pattern 1: Bullet points with volume info
  const bulletPattern = $('li').filter((_, li) => {
    const text = $(li).text();
    return /Volume \d+:/.test(text) && /Chapters? \d+/.test(text);
  });
  console.log(`Bullet points with "Volume X: ... Chapters Y": ${bulletPattern.length}`);
  
  // Pattern 2: Bold volume headers
  const boldVolumes = $('b, strong').filter((_, el) => {
    const text = $(el).text();
    return /Volume \d+/.test(text);
  });
  console.log(`Bold volume headers: ${boldVolumes.length}`);
  
  // Show a sample of the page structure around volumes
  if (boldVolumes.length > 0) {
    console.log('\nSample volume structure:');
    const firstBold = boldVolumes.first();
    const parent = firstBold.parent();
    console.log(`  Parent element: ${parent.prop('tagName')}`);
    console.log(`  Parent HTML (first 200 chars): ${parent.html()?.substring(0, 200)}...`);
  }
}

analyzeCaptainTsubasa().catch(console.error);