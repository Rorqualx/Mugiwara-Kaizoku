#!/usr/bin/env node

/**
 * Script to fix Fire Force metadata to show correct values
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFireForceMetadata() {
  try {
    console.log('=== Fixing Fire Force Metadata ===\n');
    
    // Find all Fire Force manga entries
    const fireForceMangas = await prisma.manga.findMany({
      where: {
        OR: [
          { title: { contains: 'Fire Force' } },
          { title: { contains: 'fire force' } }
        ]
      },
      include: {
        metadata: true
      }
    });

    console.log(`Found ${fireForceMangas.length} Fire Force manga entries\n`);

    for (const manga of fireForceMangas) {
      console.log(`Manga: ${manga.title} (ID: ${manga.id})`);
      
      if (manga.metadata) {
        console.log(`Current metadata:`);
        console.log(`  - Volumes: ${manga.metadata.volumes}`);
        console.log(`  - Chapters: ${manga.metadata.chapters}`);
        
        // Fix incorrect values
        if (manga.metadata.chapters === 879 || manga.metadata.chapters === 2) {
          console.log(`\nUpdating to correct values...`);
          
          await prisma.metadata.update({
            where: { id: manga.metadata.id },
            data: {
              volumes: 34,   // Correct number of volumes
              chapters: 304  // Correct number of chapters
            }
          });
          
          console.log(`✅ Updated to: 34 volumes, 304 chapters`);
        } else if (manga.metadata.volumes === 34 && manga.metadata.chapters === 304) {
          console.log(`✅ Already has correct values`);
        } else {
          console.log(`⚠️  Has unexpected values, updating anyway...`);
          
          await prisma.metadata.update({
            where: { id: manga.metadata.id },
            data: {
              volumes: 34,
              chapters: 304
            }
          });
          
          console.log(`✅ Updated to: 34 volumes, 304 chapters`);
        }
      } else {
        console.log(`❌ No metadata found for this manga`);
      }
      
      console.log('---\n');
    }
    
    console.log('✨ Fire Force metadata has been fixed!');
    console.log('\nNote: The Fandom parser incorrectly counts total chapter references (879)');
    console.log('instead of unique chapters (304). This has been corrected.');
    
  } catch (error) {
    console.error('Error fixing metadata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFireForceMetadata();