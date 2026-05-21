#!/usr/bin/env ts-node

import axios from 'axios';

async function debugOnePiece() {
  const apiBase = 'https://en.wikipedia.org/w/api.php';
  
  // Try the main redirect page
  console.log('Checking redirect page...');
  const url1 = apiBase + '?action=query&titles=List%20of%20One%20Piece%20chapters&format=json';
  const r1 = await axios.get(url1);
  const pages1 = r1.data.query?.pages;
  const pageId1 = Object.keys(pages1)[0];
  console.log('  Page ID:', pageId1, '(negative means not found)');
  
  // Try the actual page (with 's')  
  console.log('\nChecking actual page (Lists)...');
  const url2 = apiBase + '?action=query&titles=Lists%20of%20One%20Piece%20chapters&format=json';
  const r2 = await axios.get(url2);
  const pages2 = r2.data.query?.pages;
  const pageId2 = Object.keys(pages2)[0];
  console.log('  Page ID:', pageId2, '(negative means not found)');
  
  // Get first sub-page directly
  console.log('\nChecking first sub-page directly...');
  const url3 = apiBase + '?action=query&titles=List%20of%20One%20Piece%20chapters%20(1%E2%80%93186)&format=json';
  const r3 = await axios.get(url3);
  const pages3 = r3.data.query?.pages;
  const pageId3 = Object.keys(pages3)[0];
  console.log('  Page ID:', pageId3, '(negative means not found)');
  
  if (pageId3 !== '-1') {
    // Get content
    const contentUrl = apiBase + '?action=parse&pageid=' + pageId3 + '&prop=text&format=json';
    const contentR = await axios.get(contentUrl);
    const html = contentR.data.parse.text['*'];
    
    // Try to find chapter patterns
    const pattern1 = /"([^"]+)"/g;
    const matches = [...html.matchAll(pattern1)];
    console.log('\n  Found', matches.length, 'quoted strings');
    
    // Filter for chapter-like titles
    const chapters = matches.filter(m => {
      const title = m[1];
      // Skip non-chapter content
      if (title.includes('http') || title.includes('wiki') || title.includes('cite') || title.includes('mw-')) {
        return false;
      }
      if (title.length < 3 || title.length > 100) {
        return false;
      }
      return true;
    });
    
    console.log('  Filtered to', chapters.length, 'potential chapter titles');
    
    if (chapters.length > 0) {
      console.log('\n  First 5:');
      chapters.slice(0, 5).forEach(ch => {
        console.log('    "' + ch[1] + '"');
      });
    }
  }
}

debugOnePiece().catch(console.error);