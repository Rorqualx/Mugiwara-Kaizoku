import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function investigateJJKThoroughly() {
  const url = 'https://jujutsukaisen.fandom.com/wiki/Chapters_%26_Volumes';
  console.log('Thoroughly investigating JJK page...\n');
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('=== Page Structure ===');
  
  // Check if the page is mostly empty
  const bodyText = $('body').text().trim();
  console.log(`Body text length: ${bodyText.length}`);
  
  // Check main content area
  const mainContent = $('.mw-parser-output, #mw-content-text, .page-content');
  console.log(`Main content areas: ${mainContent.length}`);
  
  if (mainContent.length > 0) {
    const contentText = mainContent.text().trim();
    console.log(`Main content text length: ${contentText.length}`);
    
    // Show first 500 chars
    console.log(`\nFirst 500 chars of content:`);
    console.log(contentText.substring(0, 500));
  }
  
  // Check for any elements at all
  const allElements = $('*').length;
  console.log(`\nTotal elements on page: ${allElements}`);
  
  // Check for specific wiki elements
  const wikiElements = {
    paragraphs: $('p').length,
    divs: $('div').length,
    tables: $('table').length,
    lists: $('ul, ol').length,
    headings: $('h1, h2, h3, h4, h5, h6').length,
    links: $('a').length,
    images: $('img').length
  };
  
  console.log('\nElement counts:');
  Object.entries(wikiElements).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  // Check if it's a redirect or special page
  const isRedirect = html.includes('redirectMsg') || html.includes('mw-redirect');
  const isSpecial = html.includes('special:') || html.includes('Special:');
  
  console.log(`\nPage type:`);
  console.log(`  Is redirect: ${isRedirect}`);
  console.log(`  Is special page: ${isSpecial}`);
  
  // Check for navigation to other pages
  const navLinks = $('a').filter((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text();
    return (text.includes('Volume') || text.includes('Chapter')) && href.includes('/wiki/');
  });
  
  console.log(`\nNavigation links with Volume/Chapter: ${navLinks.length}`);
  if (navLinks.length > 0) {
    console.log('First few links:');
    navLinks.slice(0, 5).each((i, link) => {
      const $link = $(link);
      console.log(`  "${$link.text().trim()}" -> ${$link.attr('href')}`);
    });
  }
}

investigateJJKThoroughly().catch(console.error);