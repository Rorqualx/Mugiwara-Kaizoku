import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';

async function debugBleachAccuracy() {
  console.log('🔍 Debugging Bleach Parser Accuracy Issue\n');
  
  const response = await fetch('https://bleach.fandom.com/wiki/Chapters');
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📄 Page Analysis:');
  console.log(`- Total tables: ${$('table').length}`);
  console.log(`- Tables with class "wikitable": ${$('table.wikitable').length}`);
  console.log(`- Tables with class "article-table": ${$('table.article-table').length}`);
  
  // Test parser
  console.log('\n🧪 Parser Results:');
  const volumes = parseVolumeTables(html);
  console.log(`Volumes found: ${volumes.length}`);
  const totalChapters = volumes.reduce((sum, vol) => sum + vol.chapters.length, 0);
  console.log(`Total chapters: ${totalChapters}`);
  
  // Check for Chapter 000 issues
  const chapter000s = volumes.flatMap(vol => 
    vol.chapters.filter(ch => ch.chapterNumber === '000')
  );
  console.log(`\n⚠️  Chapter 000 entries: ${chapter000s.length}`);
  
  if (chapter000s.length > 0) {
    console.log('\nFirst 5 Chapter 000 entries:');
    chapter000s.slice(0, 5).forEach((ch, i) => {
      console.log(`  ${i + 1}. Title: "${ch.title}"`);
      console.log(`     Volume: ${ch.volumeNumber || 'N/A'}`);
    });
  }
  
  // Analyze first few volumes
  console.log('\n📚 Volume Analysis:');
  volumes.slice(0, 3).forEach(vol => {
    console.log(`\nVolume ${vol.volumeNumber}:`);
    console.log(`  Title: ${vol.title}`);
    console.log(`  Chapters: ${vol.chapters.length}`);
    console.log(`  Sample chapters:`);
    vol.chapters.slice(0, 3).forEach(ch => {
      console.log(`    [${ch.chapterNumber}] ${ch.title}`);
    });
  });
  
  // Check actual Bleach stats
  console.log('\n📊 Expected Bleach Stats:');
  console.log('- Total volumes: 74');
  console.log('- Total chapters: 686');
  console.log(`- Accuracy: ${((totalChapters / 686) * 100).toFixed(1)}%`);
  
  // Look for specific patterns in tables
  console.log('\n🔍 Table Pattern Analysis:');
  
  // Check first few tables
  $('table').slice(0, 5).each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    const text = $table.text();
    
    console.log(`\nTable ${i + 1}:`);
    console.log(`  Rows: ${rows}`);
    console.log(`  Classes: ${$table.attr('class') || 'none'}`);
    
    // Check if it's a chapter list
    if (text.includes('Chapter') || /\d{3}/.test(text)) {
      console.log('  ✓ Contains chapter references');
      
      // Check for specific patterns
      const hasChapterList = text.includes('Chapters list:');
      const hasColons = (text.match(/:/g) || []).length;
      const hasNumbers = (text.match(/\d{3}/g) || []).length;
      
      console.log(`  - "Chapters list:" found: ${hasChapterList}`);
      console.log(`  - Colons found: ${hasColons}`);
      console.log(`  - 3-digit numbers found: ${hasNumbers}`);
      
      // Sample first 200 chars
      console.log(`  - Text preview: "${text.substring(0, 200).replace(/\s+/g, ' ')}..."`);
    }
  });
  
  // Look for navigation elements that might be parsed as chapters
  const navboxes = $('.navbox').length;
  console.log(`\n📦 Navigation boxes found: ${navboxes}`);
  
  // Check for the special-chapters pattern
  console.log('\n🎯 Pattern Detection:');
  console.log('The parser is using "special-chapters" pattern for Bleach');
  console.log('This pattern might be incorrectly parsing navigation or header text as chapters');
}

debugBleachAccuracy().catch(console.error);