#!/usr/bin/env npx tsx

import * as cheerio from 'cheerio';

async function testChapterExtraction() {
  const url = 'https://fire-force.fandom.com/wiki/List_of_Volumes';

  console.log('Fetching:', url);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  console.log('\n=== ANALYZING VOLUME 1 TABLE ===');

  // Find the first volume table
  let volumeTable: any = null;
  $('table').each((i, table) => {
    const text = $(table).text();
    if (text.includes('Volume 1') && text.includes('Fire Force') && !text.includes('Volume 10')) {
      volumeTable = table;
      return false; // break
    }
  });

  if (volumeTable) {
    const $table = $(volumeTable);
    const tableHtml = $table.html() || '';
    const tableText = $table.text();

    console.log('\nTable text contains "Chapters":', tableText.includes('Chapters'));
    console.log('Table text contains "ISBN":', tableText.includes('ISBN'));

    // Look for chapters section
    const chapterSection = tableText.split('Chapters')[1]?.split('ISBN')[0];
    if (chapterSection) {
      console.log('\nChapter section text:');
      console.log(chapterSection.trim());

      // Try the regex from parseVolumeTables
      const chapterMatches = chapterSection.matchAll(/(\d+)(?:\.\s+|\s*[.:]?\s*)([^\n\(]+?)(?:\s*\([^)]+\))?(?:\n|$)/g);
      const chapters = [];
      for (const match of chapterMatches) {
        chapters.push({
          num: match[1],
          title: match[2].trim()
        });
      }
      console.log('\nChapters extracted by regex:', chapters.length);
      chapters.forEach(ch => console.log(`  ${ch.num}. ${ch.title}`));
    }

    // Look for <ul> lists with chapters IN THE TABLE HTML
    console.log('\n=== LOOKING FOR CHAPTER LISTS IN TABLE ===');

    const lists = $table.find('ul');
    console.log('Number of <ul> lists found in table:', lists.length);

    lists.each((i, ul) => {
      console.log(`\nList ${i + 1}:`);
      const items = $(ul).find('li');
      console.log(`  Items: ${items.length}`);

      items.each((j, li) => {
        const text = $(li).text().trim();
        console.log(`    ${j + 1}. ${text}`);
      });
    });

    // Check for chapter links in table
    const chapterLinks = $table.find('a[href*="/wiki/Chapter_"]');
    console.log('\n=== CHAPTER LINKS ===');
    console.log('Chapter links found in table:', chapterLinks.length);

    if (chapterLinks.length > 0) {
      console.log('\nAll chapter links:');
      chapterLinks.each((i, link) => {
        const $link = $(link);
        console.log(`  ${i + 1}. Text: "${$link.text()}" Href: ${$link.attr('href')}`);
      });
    }

    // Check parent TD for lists
    const $td = $table.closest('td');
    if ($td.length) {
      console.log('\n=== CHECKING PARENT TD ===');
      const parentLists = $td.find('ul');
      console.log('Lists in parent TD:', parentLists.length);

      // Check for chapter links in parent
      const parentChapterLinks = $td.find('a[href*="/wiki/Chapter_"]');
      console.log('Chapter links in parent TD:', parentChapterLinks.length);

      if (parentChapterLinks.length > 0) {
        console.log('\nFirst 10 chapter links from parent:');
        parentChapterLinks.slice(0, 10).each((i, link) => {
          const $link = $(link);
          const $li = $link.closest('li');
          const liText = $li.text().trim();
          console.log(`  ${liText}`);
        });
      }
    }
  }
}

testChapterExtraction().catch(console.error);