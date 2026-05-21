import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { parseVolumeTables } from '../src/api/metadataProviders/utils/fandomTableParser';

interface FailedCase {
  name: string;
  url: string;
  pattern?: string;
}

const failedCases: FailedCase[] = [
  // Different table structures
  { name: 'Astro Boy', url: 'https://astroboy.fandom.com/wiki/List_of_Astro_Boy_Volumes_and_Chapters', pattern: 'sequential-volume-tables' },
  { name: 'Black Jack', url: 'https://manga.fandom.com/wiki/List_of_Black_Jack_chapters', pattern: 'single-large-table' },
  { name: 'Doraemon', url: 'https://doraemon.fandom.com/wiki/List_of_Doraemon_Manga_(Volumes_and_Chapters)', pattern: 'chapter-only-tables' },
  { name: 'Fairy Tail', url: 'https://fairytail.fandom.com/wiki/Volumes_and_Chapters', pattern: 'arc-based-structure' },
  { name: 'JoJo', url: 'https://jojo.fandom.com/wiki/List_of_JoJo\'s_Bizarre_Adventure_chapters', pattern: 'part-based-structure' },
  { name: 'Black Clover', url: 'https://blackclover.fandom.com/wiki/List_of_Chapters_and_Volumes', pattern: 'navigation-box' },
  { name: 'Dr. Stone', url: 'https://dr-stone.fandom.com/wiki/Chapters_and_Volumes', pattern: 'tabbed-interface' }
];

async function investigateFailedPattern(failedCase: FailedCase) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Investigating: ${failedCase.name}`);
  console.log(`URL: ${failedCase.url}`);
  console.log(`Expected pattern: ${failedCase.pattern || 'Unknown'}`);
  console.log('='.repeat(80));
  
  try {
    const response = await fetch(failedCase.url);
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status}`);
      return;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Page structure analysis
    console.log('\n📄 Page Structure:');
    console.log(`- Total tables: ${$('table').length}`);
    console.log(`- Wikitables: ${$('table.wikitable').length}`);
    console.log(`- Article tables: ${$('table.article-table').length}`);
    console.log(`- H2 headers: ${$('h2').length}`);
    console.log(`- H3 headers: ${$('h3').length}`);
    console.log(`- Tabber divs: ${$('.tabber, .tabbertab').length}`);
    console.log(`- Navigation boxes: ${$('.navbox').length}`);
    
    // Volume/Chapter patterns
    console.log('\n📚 Content Patterns:');
    const patterns = [
      { name: 'Volume X:', regex: /Volume\s+\d+:/gi },
      { name: 'Volume X (no colon)', regex: /Volume\s+\d+(?!:)/gi },
      { name: '(Volume X)', regex: /\(Volume\s+\d+\)/gi },
      { name: 'Vol. X', regex: /Vol\.\s*\d+/gi },
      { name: 'Chapter X:', regex: /Chapter\s+\d+:/gi },
      { name: 'Chapter list', regex: /Chapter.?list/gi },
      { name: 'Japanese volume (第X巻)', regex: /第\d+巻/g }
    ];
    
    patterns.forEach(({ name, regex }) => {
      const matches = html.match(regex);
      if (matches) {
        console.log(`- ${name}: ${matches.length} occurrences`);
      }
    });
    
    // Table analysis
    console.log('\n📊 Table Analysis (first 5):');
    $('table').slice(0, 5).each((i, table) => {
      const $table = $(table);
      const rows = $table.find('tr').length;
      const cols = $table.find('tr').first().find('td, th').length;
      const classes = $table.attr('class') || 'none';
      const id = $table.attr('id') || 'none';
      const firstCellText = $table.find('td, th').first().text().trim();
      
      console.log(`\nTable ${i + 1}:`);
      console.log(`  - Size: ${rows} rows × ${cols} cols`);
      console.log(`  - Classes: ${classes}`);
      console.log(`  - ID: ${id}`);
      console.log(`  - First cell: "${firstCellText.substring(0, 50)}${firstCellText.length > 50 ? '...' : ''}"`);
      
      // Check for volume patterns in this table
      const tableText = $table.text();
      if (/Volume\s+\d+/i.test(tableText)) {
        console.log(`  - ✓ Contains volume references`);
      }
      if (/Chapter\s+\d+/i.test(tableText) || /\d+\.\s+"[^"]+"/i.test(tableText)) {
        console.log(`  - ✓ Contains chapter listings`);
      }
    });
    
    // Special structures
    console.log('\n🎯 Special Structures:');
    
    // Check for tabbed interface
    if ($('.tabber, .tabbertab').length > 0) {
      console.log('- Found tabbed interface');
      $('.tabbertab').each((i, tab) => {
        const $tab = $(tab);
        const title = $tab.attr('title') || $tab.find('.tabbertab-title').text() || 'Unknown';
        console.log(`  Tab ${i + 1}: ${title}`);
      });
    }
    
    // Check for arc-based organization
    const arcHeaders = $('h2, h3').filter((_, el) => {
      const text = $(el).text();
      return /arc|saga|part/i.test(text) && !/navigation/i.test(text);
    });
    if (arcHeaders.length > 0) {
      console.log(`- Found ${arcHeaders.length} arc/saga headers`);
      arcHeaders.slice(0, 3).each((_, el) => {
        console.log(`  • ${$(el).text().trim()}`);
      });
    }
    
    // Check for navigation boxes
    if ($('.navbox').length > 0) {
      console.log(`- Found ${$('.navbox').length} navigation boxes`);
    }
    
    // Test current parser
    console.log('\n🧪 Current Parser Test:');
    const volumes = parseVolumeTables(html);
    console.log(`- Volumes found: ${volumes.length}`);
    if (volumes.length > 0) {
      const totalChapters = volumes.reduce((sum, vol) => sum + vol.chapters.length, 0);
      console.log(`- Total chapters: ${totalChapters}`);
      console.log(`- First volume: ${volumes[0].title} (${volumes[0].chapters.length} chapters)`);
    }
    
    // Suggest pattern type
    console.log('\n💡 Suggested Pattern Type:');
    if ($('.tabber, .tabbertab').length > 0) {
      console.log('- Tabbed interface pattern needed');
    } else if ($('table').length > 20 && $('table').filter((_, t) => $(t).find('tr').length < 10).length > 15) {
      console.log('- Sequential small tables pattern (like Astro Boy)');
    } else if (arcHeaders.length > 5) {
      console.log('- Arc-based organization pattern needed');
    } else if ($('table.wikitable').length === 1 && $('table.wikitable').find('tr').length > 50) {
      console.log('- Single large table pattern needed');
    } else if ($('.navbox').length > 0 && $('table').not('.navbox').length === 0) {
      console.log('- Navigation box only pattern needed');
    } else {
      console.log('- Custom pattern needed - no clear structure detected');
    }
    
    // Sample content for pattern development
    console.log('\n📝 Sample Content:');
    
    // Find a table with volume/chapter info
    const sampleTable = $('table').filter((_, table) => {
      const text = $(table).text();
      return /Volume|Chapter/i.test(text) && $(table).find('tr').length > 2;
    }).first();
    
    if (sampleTable.length > 0) {
      console.log('Sample table HTML structure:');
      const sampleRows = sampleTable.find('tr').slice(0, 3);
      sampleRows.each((i, row) => {
        const cells = $(row).find('td, th');
        console.log(`  Row ${i + 1}: ${cells.length} cells`);
        cells.each((j, cell) => {
          const text = $(cell).text().trim().substring(0, 30);
          console.log(`    Cell ${j + 1}: "${text}${text.length >= 30 ? '...' : ''}"`);
        });
      });
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function runInvestigation() {
  console.log('🔍 Failed Pattern Investigation');
  console.log('Analyzing why certain Fandom wikis fail to parse...\n');
  
  for (const failedCase of failedCases) {
    await investigateFailedPattern(failedCase);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 Investigation Summary');
  console.log('='.repeat(80));
  console.log('\nCommon failure patterns identified:');
  console.log('1. Sequential small tables (Astro Boy) - Each volume is a separate small table');
  console.log('2. Single large table (Black Jack) - All volumes in one big table');
  console.log('3. Chapter-only tables (Doraemon) - No volume grouping');
  console.log('4. Arc-based structure (Fairy Tail) - Organized by story arcs');
  console.log('5. Part-based structure (JoJo) - Organized by parts/series');
  console.log('6. Navigation box only (Black Clover) - Uses navbox instead of tables');
  console.log('7. Tabbed interface (Dr. Stone) - Content in tabs');
  
  console.log('\n✅ Investigation complete!');
}

// Run the investigation
runInvestigation().catch(console.error);