import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeChainsawManPattern() {
  console.log('🔍 Analyzing Chainsaw Man Pattern\n');
  
  const url = 'https://chainsaw-man.fandom.com/wiki/Chainsaw_Man_(Manga)';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check all tables
  const tables = $('table');
  console.log(`Found ${tables.length} tables total\n`);
  
  // Also check for volume/chapter lists in other formats
  console.log('📋 Looking for volume/chapter references:\n');
  
  // Check headers
  const headers = $('h2, h3');
  headers.each((i, header) => {
    const text = $(header).text().trim();
    if (text.includes('Volume') || text.includes('Chapter') || text.includes('Arc')) {
      console.log(`${header.tagName}: ${text}`);
    }
  });
  
  console.log('\n📋 Checking for lists:');
  const lists = $('ul, ol');
  lists.each((i, list) => {
    const $list = $(list);
    const items = $list.find('li');
    
    // Check if list contains volume/chapter info
    const firstItem = items.first().text();
    if (firstItem.includes('Volume') || firstItem.includes('Chapter')) {
      console.log(`\nFound potential volume/chapter list:`);
      items.slice(0, 5).each((j, item) => {
        console.log(`  - ${$(item).text().trim()}`);
      });
      if (items.length > 5) {
        console.log(`  ... and ${items.length - 5} more items`);
      }
    }
  });
  
  // Check for navboxes
  console.log('\n📋 Checking navboxes:');
  const navboxes = $('.navbox, .mw-collapsible');
  console.log(`Found ${navboxes.length} navboxes`);
  
  // Check links
  console.log('\n📋 Checking for chapter/volume links:');
  const links = $('a');
  const volumeLinks = [];
  const chapterLinks = [];
  
  links.each((i, link) => {
    const href = $(link).attr('href') || '';
    const text = $(link).text().trim();
    
    if (href.includes('Volume_') && !volumeLinks.some(l => l.href === href)) {
      volumeLinks.push({ href, text });
    }
    if (href.includes('Chapter_') && !chapterLinks.some(l => l.href === href)) {
      chapterLinks.push({ href, text });
    }
  });
  
  console.log(`Found ${volumeLinks.length} volume links`);
  console.log(`Found ${chapterLinks.length} chapter links`);
  
  if (volumeLinks.length > 0) {
    console.log('\nSample volume links:');
    volumeLinks.slice(0, 5).forEach(link => {
      console.log(`  - ${link.text}: ${link.href}`);
    });
  }
  
  if (chapterLinks.length > 0) {
    console.log('\nSample chapter links:');
    chapterLinks.slice(0, 5).forEach(link => {
      console.log(`  - ${link.text}: ${link.href}`);
    });
  }
}

analyzeChainsawManPattern().catch(console.error);