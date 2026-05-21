import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugPageStructure(name: string, url: string) {
  console.log(`\nDebugging ${name}...`);
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Check for tables
  const tables = $('table');
  console.log(`  Tables found: ${tables.length}`);
  
  // Check for navigation boxes
  const navboxes = $('.navbox, .mw-collapsible, .toccolours');
  console.log(`  Navigation boxes: ${navboxes.length}`);
  
  // Check for volume/chapter patterns in text
  const bodyText = $('body').text();
  const hasVolumeText = /Volume\s+\d+/i.test(bodyText);
  const hasChapterText = /Chapter\s+\d+/i.test(bodyText);
  
  console.log(`  Has "Volume X" text: ${hasVolumeText}`);
  console.log(`  Has "Chapter X" text: ${hasChapterText}`);
  
  // Check for specific structures
  const articleTables = $('.article-table');
  const wikitables = $('.wikitable');
  const volumeTables = $('table[class*="volume"], table[class*="Volume"]');
  
  console.log(`  Article tables: ${articleTables.length}`);
  console.log(`  Wikitables: ${wikitables.length}`);
  console.log(`  Volume tables: ${volumeTables.length}`);
  
  // Sample first table if exists
  if (tables.length > 0) {
    const firstTable = tables.first();
    const className = firstTable.attr('class') || 'none';
    console.log(`  First table class: ${className}`);
  }
}

// Test a few problematic ones
const testPages = [
  { name: 'Dragon Ball', url: 'https://dragonball.fandom.com/wiki/List_of_Dragon_Ball_manga_volumes' },
  { name: 'Jujutsu Kaisen', url: 'https://jujutsukaisen.fandom.com/wiki/Chapters_%26_Volumes' },
  { name: 'Fire Force', url: 'https://fire-force.fandom.com/wiki/Chapters_and_Volumes' },
  { name: 'Black Clover', url: 'https://blackclover.fandom.com/wiki/Chapters_and_Volumes' }
];

async function debugAll() {
  for (const page of testPages) {
    await debugPageStructure(page.name, page.url);
  }
}

debugAll().catch(console.error);