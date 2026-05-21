import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function checkChainsawManVolumesPage() {
  console.log('🔍 Checking Chainsaw Man Volumes Page\n');
  
  // Try different possible URLs
  const urls = [
    'https://chainsaw-man.fandom.com/wiki/Volumes',
    'https://chainsaw-man.fandom.com/wiki/Chapters',
    'https://chainsaw-man.fandom.com/wiki/List_of_Volumes',
    'https://chainsaw-man.fandom.com/wiki/List_of_Chapters',
    'https://chainsaw-man.fandom.com/wiki/Chapters_and_Volumes'
  ];
  
  for (const url of urls) {
    console.log(`\nTrying: ${url}`);
    try {
      const response = await fetch(url);
      
      if (response.status === 200) {
        console.log('✅ Page exists!');
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Quick check for volume/chapter content
        const pageTitle = $('h1').first().text();
        const tableCount = $('table').length;
        const hasVolume = html.includes('Volume');
        const hasChapter = html.includes('Chapter');
        
        console.log(`  Title: ${pageTitle}`);
        console.log(`  Tables: ${tableCount}`);
        console.log(`  Has "Volume": ${hasVolume}`);
        console.log(`  Has "Chapter": ${hasChapter}`);
      } else {
        console.log(`❌ Page not found (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

checkChainsawManVolumesPage().catch(console.error);