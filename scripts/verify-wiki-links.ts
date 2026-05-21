import fetch from 'node-fetch';

const links = [
  { name: 'Dr. Stone', url: 'https://dr-stone.fandom.com/wiki/Chapters_and_Volumes' },
  { name: 'Black Clover', url: 'https://blackclover.fandom.com/wiki/List_of_Chapters_and_Volumes' },
  { name: "JoJo's Bizarre Adventure", url: "https://jojo.fandom.com/wiki/List_of_JoJo's_Bizarre_Adventure_chapters" },
  { name: 'Fullmetal Alchemist', url: 'https://fma.fandom.com/wiki/Chapters_and_Volumes' }
];

async function verifyLink(name: string, url: string) {
  try {
    console.log(`Checking ${name}...`);
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 5000
    });
    
    if (response.ok) {
      console.log(`✅ ${name}: ${response.status} - Working`);
    } else {
      console.log(`❌ ${name}: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ ${name}: Error - ${error.message}`);
  }
}

async function verifyAllLinks() {
  console.log('🔗 Verifying Wiki Links\n');
  
  for (const link of links) {
    await verifyLink(link.name, link.url);
  }
  
  console.log('\nDone!');
}

verifyAllLinks().catch(console.error);