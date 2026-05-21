// Script to generate gallery-based pattern for Black Clover style wikis

const galleryPatternCode = `
/**
 * Detects gallery-based volume layouts (like Black Clover)
 * - Uses wikia-gallery or gallery class
 * - Volume info in gallery item captions
 * - Format: "Volume X Chapters Y-Z"
 */
function detectGalleryBasedLayout($: cheerio.CheerioAPI): boolean {
  const galleries = $('.wikia-gallery, .gallery');
  
  if (galleries.length > 0) {
    // Check if gallery items contain volume info
    const items = galleries.find('.wikia-gallery-item, .gallerybox');
    let volumeCount = 0;
    
    items.each((_, item) => {
      const caption = $(item).find('.lightbox-caption, .gallerytext').text();
      if (/Volume\\s+\\d+/i.test(caption)) {
        volumeCount++;
      }
    });
    
    // If we have multiple volumes in gallery format, this is the pattern
    return volumeCount >= 3;
  }
  
  return false;
}

/**
 * Parses gallery-based volume layouts
 */
function parseGalleryBasedLayout($: cheerio.CheerioAPI): VolumeInfo[] {
  const volumes: VolumeInfo[] = [];
  const galleries = $('.wikia-gallery, .gallery');
  
  galleries.each((_, gallery) => {
    const items = $(gallery).find('.wikia-gallery-item, .gallerybox');
    
    items.each((_, item) => {
      const $item = $(item);
      const caption = $item.find('.lightbox-caption, .gallerytext').text().trim();
      
      // Parse volume info from caption
      // Pattern: "Volume X Chapters Y-Z" or "Volume X"
      const volumeMatch = caption.match(/Volume\\s+(\\d+\\.?\\d*)/i);
      if (!volumeMatch) return;
      
      const volumeNumber = parseFloat(volumeMatch[1]);
      const volumeInfo: VolumeInfo = {
        volumeNumber: Math.floor(volumeNumber),
        title: \`Volume \${volumeNumber}\`,
        chapters: []
      };
      
      // Extract chapter range if present
      const chapterRangeMatch = caption.match(/Chapters?\\s+(\\d+)\\s*[-–]\\s*(\\d+)/i);
      if (chapterRangeMatch) {
        const startChapter = parseInt(chapterRangeMatch[1], 10);
        const endChapter = parseInt(chapterRangeMatch[2], 10);
        
        // Create chapter entries for the range
        for (let i = startChapter; i <= endChapter; i++) {
          volumeInfo.chapters.push({
            chapterNumber: i.toString().padStart(3, '0'),
            title: \`Chapter \${i}\`,
            volumeNumber: volumeInfo.volumeNumber
          });
        }
      }
      
      // Extract single chapter if present
      const singleChapterMatch = caption.match(/Chapter\\s+(\\d+)(?!\\s*[-–])/i);
      if (singleChapterMatch && !chapterRangeMatch) {
        const chapterNum = parseInt(singleChapterMatch[1], 10);
        volumeInfo.chapters.push({
          chapterNumber: chapterNum.toString().padStart(3, '0'),
          title: \`Chapter \${chapterNum}\`,
          volumeNumber: volumeInfo.volumeNumber
        });
      }
      
      // Look for chapter list in the page
      // Sometimes chapters are listed separately after the gallery
      const volumeHeader = $(\`h2:contains("Volume \${volumeNumber}"), h3:contains("Volume \${volumeNumber}")\`).first();
      if (volumeHeader.length > 0 && volumeInfo.chapters.length === 0) {
        const chapterList = volumeHeader.nextAll('ul, ol').first();
        if (chapterList.length > 0) {
          chapterList.find('li').each((_, li) => {
            const liText = $(li).text().trim();
            const chapterMatch = liText.match(/Chapter\\s+(\\d+):?\\s*(.*)$/i);
            
            if (chapterMatch) {
              const chapterNumber = chapterMatch[1].padStart(3, '0');
              const title = chapterMatch[2].trim() || \`Chapter \${chapterMatch[1]}\`;
              
              volumeInfo.chapters.push({
                chapterNumber,
                title,
                volumeNumber: volumeInfo.volumeNumber
              });
            }
          });
        }
      }
      
      if (volumeInfo.chapters.length > 0) {
        volumes.push(volumeInfo);
      }
    });
  });
  
  // Sort volumes by number
  volumes.sort((a, b) => a.volumeNumber - b.volumeNumber);
  
  return volumes;
}`;

console.log('Add this to the patterns array in parseVolumeTables:\n');
console.log(`    {
      name: 'gallery-based',
      detect: detectGalleryBasedLayout,
      parse: parseGalleryBasedLayout
    },`);

console.log('\n\nAdd this to the top level (outside parseVolumeTables):\n');
console.log(galleryPatternCode);

console.log('\n\n📍 Location Guide:');
console.log('1. Add the pattern object to the patterns array (after bleach-style)');
console.log('2. Add the detection and parsing functions at the top level of the file');
console.log('3. The gallery pattern should work for Black Clover and similar wikis');