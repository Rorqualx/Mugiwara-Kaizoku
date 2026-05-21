#!/usr/bin/env node

/**
 * Script to patch the metadata enrichment to create chapters based on metadata count
 */

import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src/server/services/metadataMerger.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Find the section where it says "No chapter information found on Fandom"
const searchText = `      logger.info(\`No chapter information found on Fandom for \${manga.title}\`);
      return false;`;

const replacementText = `      logger.info(\`No chapter information found on Fandom for \${manga.title}\`);
      
      // If we have no Fandom data but metadata has chapter count, create placeholder chapters
      if (manga.metadata && manga.metadata.chapters && manga.metadata.chapters > 0 && (!manga.chapters || manga.chapters.length === 0)) {
        logger.info(\`Creating \${manga.metadata.chapters} placeholder chapters based on metadata count\`);
        
        const batchSize = 50;
        const chapters = [];
        
        for (let i = 1; i <= manga.metadata.chapters; i++) {
          chapters.push({
            mangaId: manga.id,
            fileName: \`chapter-\${i.toString().padStart(3, '0')}.cbz\`,
            index: i,
            title: \`Chapter \${i}\`,
            size: 0,
            downloadStatus: PrismaChapterStatus.PENDING
          });
          
          if (chapters.length === batchSize || i === manga.metadata.chapters) {
            await prisma.chapter.createMany({
              data: chapters as any
            });
            logger.debug(\`Created chapters \${i - chapters.length + 1} to \${i}\`);
            chapters.length = 0;
          }
        }
        
        logger.info(\`Successfully created \${manga.metadata.chapters} placeholder chapters for \${manga.title}\`);
        return true;
      }
      
      return false;`;

if (content.includes(searchText)) {
  content = content.replace(searchText, replacementText);
  fs.writeFileSync(filePath, content);
  console.log('✅ Successfully patched metadataMerger.ts to create chapters based on metadata count');
} else {
  console.log('❌ Could not find the target text to patch');
  console.log('Looking for:', searchText);
}