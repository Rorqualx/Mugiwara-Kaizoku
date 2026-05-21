import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugChapters() {
  const response = await fetch('https://attackontitan.fandom.com/wiki/List_of_Attack_on_Titan_chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Look at first table's chapter row
  const firstTable = $('table').first();
  const rows = firstTable.find('tr');
  const chapterRow = rows.eq(3);
  const chapterCell = chapterRow.find('td').first();
  
  console.log('Chapter cell analysis:');
  console.log(`Full text: "${chapterCell.text()}"\n`);
  
  // Split by newlines
  const lines = chapterCell.text().split('\n').filter(line => line.trim());
  console.log(`Lines (${lines.length}):`);
  lines.forEach((line, i) => {
    console.log(`  ${i}: "${line.trim()}"`);
  });
  
  // Check for links
  const links = chapterCell.find('a');
  console.log(`\nFound ${links.length} links:`);
  links.each((i, link) => {
    const $link = $(link);
    console.log(`  ${i}: "${$link.text()}" -> ${$link.attr('href')}`);
  });
}

debugChapters().catch(console.error);