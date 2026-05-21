import fetch from 'node-fetch';

async function checkUrl(name: string, url: string) {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const finalUrl = response.url;
    const status = response.status;
    
    console.log(`${name}:`);
    console.log(`  Original: ${url}`);
    console.log(`  Final: ${finalUrl}`);
    console.log(`  Status: ${status}`);
    
    if (url !== finalUrl) {
      console.log(`  ⚠️  Redirected!`);
    }
    if (status !== 200) {
      console.log(`  ❌ Not found!`);
    }
    console.log('');
  } catch (error) {
    console.log(`${name}: Error - ${error.message}\n`);
  }
}

async function checkAlternatives() {
  // Check various URL patterns
  const urlsToCheck = [
    { name: 'Dragon Ball (original)', url: 'https://dragonball.fandom.com/wiki/List_of_Dragon_Ball_manga_volumes' },
    { name: 'Dragon Ball (alt 1)', url: 'https://dragonball.fandom.com/wiki/Dragon_Ball_(manga)' },
    { name: 'Dragon Ball (alt 2)', url: 'https://dragonball.fandom.com/wiki/Dragon_Ball_manga' },
    { name: 'Dragon Ball (alt 3)', url: 'https://dragonball.fandom.com/wiki/Chapters_and_Volumes' },
    { name: 'JJK (original)', url: 'https://jujutsukaisen.fandom.com/wiki/Chapters_%26_Volumes' },
    { name: 'JJK (alt)', url: 'https://jujutsukaisen.fandom.com/wiki/Chapters_and_Volumes' },
    { name: 'Fire Force (original)', url: 'https://fire-force.fandom.com/wiki/Chapters_and_Volumes' },
    { name: 'Fire Force (alt)', url: 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)' }
  ];
  
  for (const item of urlsToCheck) {
    await checkUrl(item.name, item.url);
  }
}

checkAlternatives().catch(console.error);