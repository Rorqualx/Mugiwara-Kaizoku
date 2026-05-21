import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function debugGintamaLessonParsing() {
  console.log('🔍 Debugging Gintama Lesson Parsing\n');
  
  const url = 'https://gintama.fandom.com/wiki/Lessons_and_Volumes';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Get first volume table
  const firstTable = $('table.collapsible').first();
  const rows = firstTable.find('tr');
  
  console.log('First volume chapters row:');
  const chaptersRow = rows.eq(2);
  const chaptersCell = chaptersRow.find('td').first();
  const chaptersText = chaptersCell.text();
  
  console.log('Raw text:', chaptersText);
  console.log('\nText length:', chaptersText.length);
  
  // Try to extract individual lines
  console.log('\nLines in the cell:');
  const lines = chaptersText.split('\n').filter(line => line.trim());
  lines.forEach((line, i) => {
    console.log(`Line ${i + 1}: "${line.trim()}"`);
  });
  
  // Test regex patterns
  console.log('\n📋 Testing patterns:');
  
  // Pattern 1: Original pattern
  const pattern1 = /Lesson (\d+):\s*([^(]+?)(?:\s*\([^)]+\))?(?=Lesson \d+:|$)/g;
  const matches1 = [];
  let match;
  while ((match = pattern1.exec(chaptersText)) !== null) {
    matches1.push({ num: match[1], title: match[2].trim() });
  }
  console.log(`Pattern 1 matches: ${matches1.length}`);
  
  // Pattern 2: Line by line approach
  const pattern2 = /Lesson (\d+):\s*(.+?)(?:\s*\([^)]+\))?\s*$/;
  const matches2 = [];
  lines.forEach(line => {
    const match = line.match(pattern2);
    if (match) {
      matches2.push({ num: match[1], title: match[2].trim() });
    }
  });
  console.log(`Pattern 2 matches: ${matches2.length}`);
  matches2.forEach(m => {
    console.log(`  - Lesson ${m.num}: ${m.title}`);
  });
}

debugGintamaLessonParsing().catch(console.error);