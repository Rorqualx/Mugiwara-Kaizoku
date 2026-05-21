import fetch from 'node-fetch';

async function findCorrectUrls() {
  console.log('Finding correct URLs for failed manga...\n');
  
  const failedManga = [
    { name: 'Tokyo Ghoul', base: 'https://tokyoghoul.fandom.com', patterns: ['/wiki/Chapters', '/wiki/Chapters_and_Volumes', '/wiki/List_of_Tokyo_Ghoul_chapters', '/wiki/Tokyo_Ghoul_(manga)'] },
    { name: 'Chainsaw Man', base: 'https://chainsaw-man.fandom.com', patterns: ['/wiki/Chapters', '/wiki/Chapters_and_Volumes', '/wiki/List_of_Chapters', '/wiki/Chainsaw_Man_(manga)'] },
    { name: 'Fire Force', base: 'https://fire-force.fandom.com', patterns: ['/wiki/Chapters_and_Volumes', '/wiki/Chapters', '/wiki/Fire_Force_(manga)', '/wiki/List_of_Fire_Force_chapters'] },
    { name: 'Haikyuu!!', base: 'https://haikyuu.fandom.com', patterns: ['/wiki/Volumes_%26_Chapters', '/wiki/Chapters_and_Volumes', '/wiki/List_of_Haikyu!!_chapters', '/wiki/Haikyu!!'] },
    { name: 'Black Clover', base: 'https://blackclover.fandom.com', patterns: ['/wiki/Chapters_and_Volumes', '/wiki/Chapters', '/wiki/Black_Clover_(manga)', '/wiki/List_of_Black_Clover_chapters'] },
    { name: 'Fairy Tail', base: 'https://fairytail.fandom.com', patterns: ['/wiki/Chapters_and_Volumes', '/wiki/Chapters', '/wiki/Fairy_Tail_(Manga)', '/wiki/List_of_Fairy_Tail_Chapters'] },
  ];
  
  for (const manga of failedManga) {
    console.log(`\n${manga.name}:`);
    let found = false;
    
    for (const pattern of manga.patterns) {
      const url = manga.base + pattern;
      try {
        const response = await fetch(url, { redirect: 'follow' });
        if (response.status === 200) {
          console.log(`  ✅ Found: ${url}`);
          found = true;
          break;
        } else {
          console.log(`  ❌ ${response.status}: ${pattern}`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${pattern}`);
      }
    }
    
    if (!found) {
      // Try main page
      try {
        const mainUrl = manga.base + '/wiki/Main_Page';
        const response = await fetch(mainUrl);
        if (response.status === 200) {
          console.log(`  ℹ️  Main page exists: ${mainUrl}`);
          console.log(`     Search for volume/chapter links on main page`);
        }
      } catch (error) {
        console.log(`  ❌ Wiki might not exist`);
      }
    }
  }
}

findCorrectUrls().catch(console.error);