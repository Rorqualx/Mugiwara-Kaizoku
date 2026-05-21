import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugDetection() {
  console.log('Fetching Hunter x Hunter page...');
  const response = await fetch('https://hunterxhunter.fandom.com/wiki/List_of_Volumes_and_Chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const firstTable = $('table').first();
  
  console.log('\n=== Checking Detection Criteria ===\n');
  
  // Check class
  const tableClass = firstTable.attr('class') || '';
  console.log(`Table class: "${tableClass}"`);
  console.log(`Has wikitable class: ${tableClass.includes('wikitable')}`);
  
  // Check headers
  const headers = firstTable.find('th');
  console.log(`\nHeaders found: ${headers.length}`);
  headers.each((i, header) => {
    const text = $(header).text().trim();
    console.log(`  Header ${i}: "${text}"`);
  });
  
  // Check for lists
  const lists = firstTable.find('ul, ol');
  console.log(`\nLists (ul/ol) found: ${lists.length}`);
  
  // Check for text chapters
  const tableText = firstTable.text();
  const textChapters = tableText.match(/\d{3}\.\s+\w+/);
  console.log(`Text chapters found: ${textChapters ? 'Yes' : 'No'}`);
  if (textChapters) {
    console.log(`  First match: "${textChapters[0]}"`);
  }
  
  // Check header text for volume/release
  let hasVolumeHeader = false;
  let hasReleaseHeader = false;
  headers.each((_, header) => {
    const headerText = $(header).text().toLowerCase();
    if (headerText.includes('volume')) hasVolumeHeader = true;
    if (headerText.includes('release')) hasReleaseHeader = true;
  });
  
  console.log(`\nHas volume header: ${hasVolumeHeader}`);
  console.log(`Has release header: ${hasReleaseHeader}`);
  
  // Final detection result
  const isWikitable = tableClass.includes('wikitable') || tableClass.includes('volumes');
  const hasChapterLists = lists.length > 0;
  const hasTextChapters2 = tableText.match(/\d{3}\.\s+\w+/) !== null;
  
  console.log('\n=== Detection Results ===');
  console.log(`Is wikitable: ${isWikitable}`);
  console.log(`Has chapter lists: ${hasChapterLists}`);
  console.log(`Has text chapters: ${hasTextChapters2}`);
  console.log(`Should detect: ${(isWikitable || (hasVolumeHeader && hasReleaseHeader)) && (hasChapterLists || hasTextChapters2)}`);
}

debugDetection().catch(console.error);