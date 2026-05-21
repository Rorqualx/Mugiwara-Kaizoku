import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Add console logging to trace execution
async function traceExecution() {
  try {
    const response = await fetch('https://onepiece.fandom.com/wiki/Chapters_and_Volumes/Volumes');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const volumes: any[] = [];
    const processedVolumes = new Set<number>();
    
    console.log('Starting table processing...\\n');
    
    $('table').each((i, table) => {
      const tableText = $(table).text();
      
      // Skip really short tables
      if (i > 20) return; // Only check first 20 for debugging
      
      // Check each pattern
      if (/\(Volume\s+\d+\)/i.test(tableText)) {
        console.log(`Table ${i}: Matched Fire Force pattern`);
      } else if (tableText.includes('Chapters list:') && /Volume\s+\d+/i.test(tableText)) {
        console.log(`Table ${i}: Matched Attack on Titan pattern`);
      } else if (tableText.includes('Chapters List:')) {
        console.log(`Table ${i}: Matched Demon Slayer pattern`);
      } else if ((tableText.includes('Chapters:') || tableText.includes('Chapters list:') || 
                  tableText.includes('Chapter list:') || tableText.includes('Chapter List:')) &&
                 tableText.includes('ISBN')) {
        console.log(`Table ${i}: Matched Generic pattern`);
      } else {
        const firstCell = $(table).find('tr').first().find('td, th').first();
        if (firstCell.length > 0) {
          const cellText = firstCell.text().trim();
          if (/^Volume\s+\d+$/.test(cellText)) {
            console.log(`Table ${i}: Matched One Piece pattern! Cell text: "${cellText}"`);
            
            // Check if this volume was already processed
            const volumeMatch = cellText.match(/Volume\s+(\d+)/);
            if (volumeMatch) {
              const volumeNumber = parseInt(volumeMatch[1]);
              if (processedVolumes.has(volumeNumber)) {
                console.log(`  -> Volume ${volumeNumber} already processed, skipping`);
              } else {
                console.log(`  -> Processing volume ${volumeNumber}`);
                processedVolumes.add(volumeNumber);
                volumes.push({ volumeNumber, title: 'test' });
              }
            }
          }
        }
      }
    });
    
    console.log(`\\nTotal volumes found: ${volumes.length}`);
    console.log('Processed volumes:', Array.from(processedVolumes).sort((a, b) => a - b).slice(0, 20));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

traceExecution();