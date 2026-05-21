import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function analyzeStoryArcsPage() {
  console.log('🔍 Analyzing Kaiju No. 8 Story Arcs Page\n');
  
  const url = 'https://kaiju-no-8.fandom.com/wiki/Story_Arcs';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('📊 Page Structure:\n');
  
  // Look for arc sections
  const arcHeaders = $('h2').filter((_, h2) => {
    const text = $(h2).text();
    return text.includes('Arc') && !text.includes('Contents');
  });
  
  console.log(`Found ${arcHeaders.length} arc sections\n`);
  
  // Analyze each arc
  arcHeaders.slice(0, 3).each((i, header) => {
    const $header = $(header);
    const arcName = $header.text().trim();
    console.log(`\n📚 ${arcName}`);
    
    // Look for content after this header
    let $current = $header.next();
    let foundTable = false;
    let foundList = false;
    
    while ($current.length && !$current.is('h2')) {
      if ($current.is('table')) {
        foundTable = true;
        const rows = $current.find('tr');
        console.log(`  Found table with ${rows.length} rows`);
        
        // Check table structure
        const headers = rows.first().find('th').map((_, th) => $(th).text().trim()).get();
        console.log(`  Table headers: ${headers.join(', ')}`);
        
        // Sample first data row
        if (rows.length > 1) {
          const firstDataRow = rows.eq(1);
          const cells = firstDataRow.find('td');
          console.log(`  First row cells: ${cells.length}`);
          
          cells.each((j, cell) => {
            const text = $(cell).text().trim().substring(0, 50);
            console.log(`    Cell ${j}: "${text}..."`);
            
            // Check for links
            const links = $(cell).find('a');
            if (links.length > 0) {
              console.log(`      Has ${links.length} links`);
            }
          });
        }
      }
      
      if ($current.is('ul')) {
        foundList = true;
        const items = $current.find('li');
        console.log(`  Found list with ${items.length} items`);
        
        // Sample first few items
        items.slice(0, 2).each((j, item) => {
          const text = $(item).text().trim();
          console.log(`    - ${text.substring(0, 60)}...`);
          
          // Check for chapter links
          const chapterLinks = $(item).find('a[href*="Chapter"]');
          if (chapterLinks.length > 0) {
            console.log(`      Has ${chapterLinks.length} chapter links`);
          }
        });
      }
      
      $current = $current.next();
    }
    
    if (!foundTable && !foundList) {
      console.log('  No table or list found for this arc');
    }
  });
  
  // Check for a comprehensive chapter table
  console.log('\n\n📋 Looking for comprehensive chapter tables:\n');
  
  const allTables = $('table');
  allTables.each((i, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    // Look for tables with chapter information
    const headerText = rows.first().text().toLowerCase();
    if (headerText.includes('chapter') || headerText.includes('title')) {
      console.log(`Table ${i + 1}: ${rows.length} rows`);
      console.log(`  Headers: ${rows.first().text().trim().substring(0, 100)}...`);
      
      // Check if it has chapter data
      if (rows.length > 5) {
        const sampleRow = rows.eq(2);
        const cells = sampleRow.find('td');
        console.log(`  Sample row (${cells.length} cells):`);
        cells.each((j, cell) => {
          const text = $(cell).text().trim();
          console.log(`    Cell ${j}: "${text.substring(0, 40)}..."`);
        });
      }
    }
  });
}

async function checkAniListScraping() {
  console.log('\n\n🔍 Checking AniList Scraping\n');
  
  const anilistId = 153288;
  const query = `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        id
        title {
          romaji
          english
          native
        }
        status
        format
        chapters
        volumes
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        description
        genres
        coverImage {
          large
          medium
        }
        synonyms
        averageScore
        popularity
        staff {
          edges {
            role
            node {
              name {
                full
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { id: anilistId }
      })
    });
    
    const data = await response.json();
    
    if (data.data && data.data.Media) {
      const manga = data.data.Media;
      console.log('✅ AniList Data Retrieved:\n');
      console.log(`Title (Romaji): ${manga.title.romaji}`);
      console.log(`Title (English): ${manga.title.english || 'N/A'}`);
      console.log(`Title (Native): ${manga.title.native}`);
      console.log(`Status: ${manga.status}`);
      console.log(`Format: ${manga.format}`);
      console.log(`Chapters: ${manga.chapters || 'Ongoing'}`);
      console.log(`Volumes: ${manga.volumes || 'Ongoing'}`);
      console.log(`Start Date: ${manga.startDate.year}-${manga.startDate.month}-${manga.startDate.day}`);
      console.log(`Average Score: ${manga.averageScore}/100`);
      console.log(`Popularity: ${manga.popularity}`);
      console.log(`Genres: ${manga.genres.join(', ')}`);
      
      console.log('\nStaff:');
      manga.staff.edges.forEach(edge => {
        console.log(`  ${edge.role}: ${edge.node.name.full}`);
      });
      
      console.log('\nDescription (first 200 chars):');
      console.log(`  ${manga.description.substring(0, 200)}...`);
      
      console.log('\n⚠️  Note: AniList provides series-level metadata, not individual chapter titles');
    } else {
      console.log('❌ Failed to retrieve AniList data');
    }
  } catch (error) {
    console.log(`❌ Error fetching AniList data: ${error.message}`);
  }
}

async function main() {
  await analyzeStoryArcsPage();
  await checkAniListScraping();
  
  console.log('\n\n📝 RECOMMENDATIONS:\n');
  console.log('1. Some manga wikis organize detailed chapter info in Story Arcs pages');
  console.log('2. The Story Arcs page often contains:');
  console.log('   - Chapter titles with proper names (not just "Chapter X")');
  console.log('   - Arc groupings and boundaries');
  console.log('   - Additional metadata like chapter summaries');
  console.log('\n3. For Kaiju No. 8 specifically:');
  console.log('   - Main page: Has volume/chapter structure but no titles');
  console.log('   - Story Arcs page: May have more detailed chapter information');
  console.log('   - Individual chapter pages: Have full titles and metadata');
  console.log('\n4. AniList provides:');
  console.log('   - Series-level metadata (volumes, chapters, genres, staff)');
  console.log('   - Does NOT provide individual chapter titles');
  console.log('   - Good for enriching series metadata, not chapter details');
}

main().catch(console.error);