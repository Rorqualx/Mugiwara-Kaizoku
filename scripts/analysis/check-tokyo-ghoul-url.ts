import fetch from 'node-fetch';

async function checkTokyoGhoulUrl() {
  console.log('🔍 Checking Tokyo Ghoul URLs\n');
  
  const urls = [
    'https://tokyoghoul.fandom.com/wiki/Chapters',
    'https://tokyoghoul.fandom.com/wiki/List_of_Chapters',
    'https://tokyoghoul.fandom.com/wiki/List_of_Volumes',
    'https://tokyoghoul.fandom.com/wiki/Volumes_and_Chapters',
    'https://tokyoghoul.fandom.com/wiki/Tokyo_Ghoul_Chapters',
    'https://tokyoghoul.fandom.com/wiki/Tokyo_Ghoul/Chapters_and_Volumes'
  ];
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      console.log(`${url}: ${response.status} ${response.statusText}`);
      if (response.status === 200) {
        console.log('  ✅ This URL works!');
      }
    } catch (error) {
      console.log(`${url}: ERROR - ${(error as Error).message}`);
    }
  }
}

checkTokyoGhoulUrl().catch(console.error);