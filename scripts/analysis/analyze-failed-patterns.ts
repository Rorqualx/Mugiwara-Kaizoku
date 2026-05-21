import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

interface FailedManga {
  name: string;
  url: string;
  category: string;
}

// Extract failed manga from previous test results
const failedManga: FailedManga[] = [
  // Shonen Battle
  { name: 'Fullmetal Alchemist', url: 'https://fma.fandom.com/wiki/Chapters_and_Volumes', category: 'Shonen Battle' },
  { name: "JoJo's Bizarre Adventure", url: 'https://jojo.fandom.com/wiki/List_of_JoJo\'s_Bizarre_Adventure_chapters', category: 'Shonen Battle' },
  { name: 'Yu-Gi-Oh!', url: 'https://yugioh.fandom.com/wiki/Yu-Gi-Oh!_(manga)', category: 'Shonen Battle' },
  { name: 'Black Clover', url: 'https://blackclover.fandom.com/wiki/List_of_Chapters_and_Volumes', category: 'Shonen Battle' },
  { name: 'Dr. Stone', url: 'https://dr-stone.fandom.com/wiki/Chapters_and_Volumes', category: 'Shonen Battle' },
  
  // Classic
  { name: 'Astro Boy', url: 'https://astroboy.fandom.com/wiki/List_of_Astro_Boy_Volumes_and_Chapters', category: 'Classic' },
  { name: 'Black Jack', url: 'https://manga.fandom.com/wiki/List_of_Black_Jack_chapters', category: 'Classic' },
  { name: 'Doraemon', url: 'https://doraemon.fandom.com/wiki/List_of_Doraemon_Manga_(Volumes_and_Chapters)', category: 'Classic' },
  
  // Sports
  { name: "Kuroko's Basketball", url: 'https://kurokonobasuke.fandom.com/wiki/List_of_Volumes', category: 'Sports' },
  { name: 'Prince of Tennis', url: 'https://princeoftennis.fandom.com/wiki/List_of_The_Prince_of_Tennis_Chapters', category: 'Sports' },
  
  // Shoujo (all failed)
  { name: 'Fruits Basket', url: 'https://fruitsbasket.fandom.com/wiki/Category:Fruits_Basket_Chapters', category: 'Shoujo' },
  { name: 'Vampire Knight', url: 'https://vampireknight.fandom.com/wiki/Chapter_Summaries', category: 'Shoujo' },
  
  // Comedy
  { name: 'Mob Psycho 100', url: 'https://mob-psycho-100.fandom.com/wiki/Chapters', category: 'Comedy' },
  { name: 'Gintama', url: 'https://gintama.fandom.com/wiki/Lessons_and_Volumes', category: 'Comedy' }
];

async function analyzeFailedManga(manga: FailedManga) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Analyzing: ${manga.name} (${manga.category})`);
  console.log(`URL: ${manga.url}`);
  console.log('='.repeat(80));
  
  try {
    const response = await fetch(manga.url);
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status}`);
      return;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Basic page structure
    console.log('\n📄 Page Structure:');
    console.log(`- Total tables: ${$('table').length}`);
    console.log(`- Wikitables: ${$('table.wikitable').length}`);
    console.log(`- Article tables: ${$('table.article-table').length}`);
    console.log(`- Navbox tables: ${$('.navbox').length}`);
    console.log(`- H2 headers: ${$('h2').length}`);
    console.log(`- Tabber divs: ${$('.tabber, .tabbertab').length}`);
    
    // Look for volume/chapter patterns
    const pageText = $('body').text();
    console.log('\n📚 Content Indicators:');
    console.log(`- "Volume" mentions: ${(pageText.match(/Volume/gi) || []).length}`);
    console.log(`- "Chapter" mentions: ${(pageText.match(/Chapter/gi) || []).length}`);
    console.log(`- "Part" mentions: ${(pageText.match(/Part\s+\d+/gi) || []).length}`);
    console.log(`- "Arc" mentions: ${(pageText.match(/Arc/gi) || []).length}`);
    
    // Analyze tables
    console.log('\n📊 Table Analysis:');
    let foundVolumeTable = false;
    
    $('table').each((i, table) => {
      if (i >= 5) return; // Limit to first 5 tables
      
      const $table = $(table);
      const rows = $table.find('tr').length;
      const text = $table.text();
      const classes = $table.attr('class') || 'none';
      
      // Skip navigation boxes
      if (classes.includes('navbox')) return;
      
      console.log(`\nTable ${i + 1}:`);
      console.log(`  Rows: ${rows}`);
      console.log(`  Classes: ${classes}`);
      
      // Check headers
      const headers = $table.find('tr').first().find('th, td').map((_, el) => $(el).text().trim()).get();
      if (headers.length > 0) {
        console.log(`  Headers: ${headers.slice(0, 5).join(' | ')}${headers.length > 5 ? '...' : ''}`);
      }
      
      // Check for volume/chapter content
      if (/Volume|Chapter|Part/i.test(text)) {
        foundVolumeTable = true;
        console.log('  ✓ Contains volume/chapter references');
        
        // Sample first data row
        const firstDataRow = $table.find('tr').eq(1);
        const cells = firstDataRow.find('td');
        console.log(`  First data row (${cells.length} cells):`);
        cells.slice(0, 3).each((j, cell) => {
          const cellText = $(cell).text().trim().substring(0, 50);
          console.log(`    Cell ${j + 1}: "${cellText}${cellText.length >= 50 ? '...' : ''}"`);
        });
      }
    });
    
    if (!foundVolumeTable) {
      console.log('\n⚠️  No obvious volume/chapter tables found');
    }
    
    // Special structures
    console.log('\n🎯 Special Structures:');
    
    // Check for tabbed interface
    if ($('.tabber, .tabbertab').length > 0) {
      console.log('- Tabbed interface detected');
      $('.tabbertab').each((i, tab) => {
        if (i >= 3) return;
        const title = $(tab).attr('title') || $(tab).find('.tabbertab-title').text() || 'Unknown';
        console.log(`  Tab ${i + 1}: ${title}`);
      });
    }
    
    // Check for expandable/collapsible sections
    const collapsibles = $('.mw-collapsible, .collapsible').length;
    if (collapsibles > 0) {
      console.log(`- ${collapsibles} collapsible sections found`);
    }
    
    // Check for lists instead of tables
    const lists = $('ul, ol').filter((_, list) => {
      const text = $(list).text();
      return /Chapter|Volume/i.test(text);
    });
    if (lists.length > 0) {
      console.log(`- ${lists.length} lists with volume/chapter info found`);
    }
    
    // Category pages
    if (manga.url.includes('Category:')) {
      console.log('- This is a category page, not a standard list');
      const categoryLinks = $('.category-page__member-link').length;
      console.log(`  ${categoryLinks} category member links found`);
    }
    
    // Look for alternative structures
    const galleries = $('.wikia-gallery, .gallery').length;
    if (galleries > 0) {
      console.log(`- ${galleries} gallery sections found`);
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function analyzePriorityManga() {
  console.log('🎯 Analyzing High-Priority Failed Manga Patterns\n');
  
  // Focus on popular series first
  const priorityManga = [
    failedManga.find(m => m.name === 'Dr. Stone')!,
    failedManga.find(m => m.name === 'Black Clover')!,
    failedManga.find(m => m.name === "JoJo's Bizarre Adventure")!,
    failedManga.find(m => m.name === 'Fullmetal Alchemist')!,
    failedManga.find(m => m.name === 'Mob Psycho 100')!
  ].filter(Boolean);
  
  for (const manga of priorityManga) {
    await analyzeFailedManga(manga);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 Pattern Summary');
  console.log('='.repeat(80));
  console.log('\nCommon patterns in failed manga:');
  console.log('1. Tabbed interfaces (Dr. Stone, etc.)');
  console.log('2. Category pages instead of list pages (Fruits Basket)');
  console.log('3. Part-based organization (JoJo)');
  console.log('4. Collapsible sections');
  console.log('5. Gallery-based layouts');
  console.log('6. Lists instead of tables');
}

// Run analysis
analyzePriorityManga().catch(console.error);