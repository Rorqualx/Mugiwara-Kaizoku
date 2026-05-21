import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeOnePunchMan() {
  console.log('🔍 Analyzing One Punch Man Wiki Structure\n');
  
  const url = 'https://onepunchman.fandom.com/wiki/Chapters';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📊 Initial Page Analysis:\n');
  
  // Check basic page structure
  const tables = $('table');
  const lists = $('ul, ol');
  const headers = $('h2, h3');
  
  console.log(`Tables: ${tables.length}`);
  console.log(`Lists: ${lists.length}`);
  console.log(`Headers: ${headers.length}`);
  
  // Look for volume/chapter information anywhere
  const volumeElements = $('*').filter((_, el) => {
    const text = $(el).text();
    return /Volume \d+/.test(text) && text.length < 200;
  });
  
  console.log(`\nElements mentioning "Volume X": ${volumeElements.length}`);
  
  // Check for tabs or tabber
  console.log('\n📑 Tab System Check:\n');
  
  const tabberElements = [
    '.tabber',
    '.tabbertab', 
    '.wds-tabber',
    '.wds-tabs',
    '.article-tabs',
    '.WikiaArticleTabs',
    '.tabview',
    '[role="tablist"]'
  ];
  
  tabberElements.forEach(selector => {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`✓ Found ${selector}: ${elements.length} elements`);
      
      // Try to get tab labels
      const tabs = elements.find('[role="tab"], .wds-tabs__tab, .tabbertab, a');
      if (tabs.length > 0) {
        console.log(`  Tabs found: ${tabs.length}`);
        tabs.slice(0, 5).each((i, tab) => {
          const text = $(tab).text().trim();
          if (text) {
            console.log(`    ${i + 1}. "${text}"`);
          }
        });
      }
    }
  });
  
  // Check for galleries
  const galleries = $('.wikia-gallery, .gallery');
  console.log(`\nGalleries: ${galleries.length}`);
  
  // Check for specific One Punch Man patterns
  console.log('\n🔍 One Punch Man Specific Patterns:\n');
  
  // Look for chapter boxes or cards
  const chapterBoxes = $('.chapter-box, .article-thumb, .lightbox-caption, .wikia-gallery-item');
  console.log(`Chapter boxes/cards: ${chapterBoxes.length}`);
  
  if (chapterBoxes.length > 0) {
    console.log('\nFirst few chapter boxes:');
    chapterBoxes.slice(0, 3).each((i, box) => {
      const $box = $(box);
      const text = $box.text().trim();
      const link = $box.find('a').first();
      
      console.log(`  ${i + 1}. Text: "${text.substring(0, 50)}..."`);
      if (link.length > 0) {
        console.log(`     Link: ${link.attr('href')}`);
      }
    });
  }
  
  // Check for any categorized sections
  const categories = $('.category, .categories, .page-header__categories');
  console.log(`\nCategory elements: ${categories.length}`);
  
  // Look for a different URL pattern
  console.log('\n📄 Checking alternative URLs:\n');
  
  const altUrls = [
    'https://onepunchman.fandom.com/wiki/Volumes',
    'https://onepunchman.fandom.com/wiki/Manga',
    'https://onepunchman.fandom.com/wiki/List_of_Chapters'
  ];
  
  for (const altUrl of altUrls) {
    try {
      const altResponse = await fetch(altUrl);
      console.log(`${altUrl}: ${altResponse.status}`);
      
      if (altResponse.status === 200) {
        const altHtml = await altResponse.text();
        const $alt = cheerio.load(altHtml);
        
        const altTables = $alt('table');
        const altVolumes = $alt('*').filter((_, el) => {
          const text = $alt(el).text();
          return /Volume \d+/.test(text) && text.length < 100;
        });
        
        console.log(`  Tables: ${altTables.length}, Volume mentions: ${altVolumes.length}`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
  
  // Final check: Look for any JavaScript-rendered content indicators
  console.log('\n🔧 Dynamic Content Indicators:\n');
  
  const scripts = $('script');
  const dynamicContainers = $('[data-source], [data-ref], .lazy-load');
  
  console.log(`Scripts: ${scripts.length}`);
  console.log(`Dynamic containers: ${dynamicContainers.length}`);
  
  // Check if content might be loaded via AJAX
  const ajaxIndicators = html.includes('ajax') || html.includes('fetch') || html.includes('async');
  console.log(`AJAX indicators in HTML: ${ajaxIndicators}`);
}

analyzeOnePunchMan().catch(console.error);