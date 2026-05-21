#!/usr/bin/env node

/**
 * Script to fix Fire Force metadata and create chapter records
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAndCreateChapters() {
  try {
    console.log('=== Fixing Fire Force and Creating Chapters ===\n');
    
    // Find all Fire Force manga entries
    const fireForceMangas = await prisma.manga.findMany({
      where: {
        OR: [
          { title: { contains: 'Fire Force' } },
          { title: { contains: 'fire force' } }
        ]
      },
      include: {
        metadata: true,
        chapters: true
      }
    });

    console.log(`Found ${fireForceMangas.length} Fire Force manga entries\n`);

    for (const manga of fireForceMangas) {
      console.log(`Processing: ${manga.title} (ID: ${manga.id})`);
      console.log(`Current chapters in DB: ${manga.chapters.length}`);
      
      // Step 1: Fix metadata if needed
      if (manga.metadata) {
        console.log(`Current metadata: ${manga.metadata.volumes} volumes, ${manga.metadata.chapters} chapters`);
        
        if (manga.metadata.chapters !== 304) {
          console.log(`Fixing metadata...`);
          await prisma.metadata.update({
            where: { id: manga.metadata.id },
            data: {
              volumes: 34,
              chapters: 304
            }
          });
          console.log(`✅ Updated metadata to: 34 volumes, 304 chapters`);
        }
      }
      
      // Step 2: Create chapters if they don't exist
      if (manga.chapters.length === 0) {
        console.log(`\nCreating 304 chapter records...`);
        
        const chapters = [];
        for (let i = 1; i <= 304; i++) {
          chapters.push({
            mangaId: manga.id,
            index: i,
            title: `Chapter ${i}`,
            fileName: `chapter-${i.toString().padStart(3, '0')}.cbz`,
            size: 0,
            downloadStatus: 'PENDING'
          });
        }
        
        // Create in batches
        const batchSize = 50;
        for (let i = 0; i < chapters.length; i += batchSize) {
          const batch = chapters.slice(i, i + batchSize);
          await prisma.chapter.createMany({
            data: batch
          });
          console.log(`✅ Created chapters ${i + 1} to ${Math.min(i + batchSize, chapters.length)}`);
        }
        
        console.log(`✨ Successfully created 304 chapter records!`);
      } else {
        console.log(`✅ Chapters already exist (${manga.chapters.length} chapters)`);
      }
      
      console.log('---\n');
    }
    
    console.log('✨ All Fire Force manga entries have been processed!');
    console.log('\nChapters should now be visible in the Volumes & Chapters section.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAndCreateChapters();