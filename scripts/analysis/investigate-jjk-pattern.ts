import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateJJK() {
  const url = 'https://jujutsukaisen.fandom.com/wiki/Chapters_%26_Volumes';
  console.log('Investigating Jujutsu Kaisen page structure...\n');
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look for any kind of volume/chapter structure
  console.log('=== Page Analysis ===');
  
  // Check for tables
  const tables = $('table');
  console.log(`Tables: ${tables.length}`);
  
  // Check for divs with volume info
  const volumeDivs = $('div').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s+\d+/i.test(text);
  });
  console.log(`Divs with "Volume X": ${volumeDivs.length}`);
  
  // Check for navigation structures
  const navboxes = $('.navbox, .mw-collapsible, .toccolours');
  console.log(`Navigation boxes: ${navboxes.length}`);
  
  // Check for tabber (tabbed content)
  const tabbers = $('.tabber, .tabs-container, .wds-tabs');
  console.log(`Tabbed content: ${tabbers.length}`);
  
  // Check for gallery structures
  const galleries = $('.wikia-gallery, .gallery');
  console.log(`Galleries: ${galleries.length}`);
  
  // Check main content area
  const mainContent = $('.mw-parser-output');
  if (mainContent.length > 0) {
    console.log('\n=== Main Content Structure ===');
    
    // Check immediate children
    const children = mainContent.children();
    console.log(`Direct children: ${children.length}`);
    
    // Analyze first few elements
    children.slice(0, 10).each((i, el) => {
      const $el = $(el);
      const tagName = el.tagName.toLowerCase();
      const className = $el.attr('class') || 'none';
      const text = $el.text().trim().substring(0, 50);
      
      console.log(`${i}. <${tagName}> class="${className}"`);
      if (text) {
        console.log(`   "${text}${text.length >= 50 ? '...' : ''}"`);
      }
    });
  }
  
  // Look for specific volume patterns
  console.log('\n=== Searching for Volume Patterns ===');
  const volumeHeaders = $('h2, h3, h4').filter((_, el) => {
    return /Volume\s+\d+/i.test($(el).text());
  });
  
  console.log(`Volume headers found: ${volumeHeaders.length}`);
  if (volumeHeaders.length > 0) {
    volumeHeaders.slice(0, 3).each((i, header) => {
      console.log(`- ${$(header).text().trim()}`);
    });
  }
}

investigateJJK().catch(console.error);