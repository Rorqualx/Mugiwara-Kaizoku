#!/usr/bin/env node

/**
 * Script to create chapter records for Fire Force based on metadata
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createFireForceChapters() {
  try {
    console.log('=== Creating Fire Force Chapter Records ===\n');
    
    // Find Fire Force manga
    const fireForce = await prisma.manga.findFirst({
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

    if (!fireForce) {
      console.log('❌ Fire Force manga not found');
      return;
    }

    console.log(`Found: ${fireForce.title} (ID: ${fireForce.id})`);
    console.log(`Metadata: ${fireForce.metadata?.volumes} volumes, ${fireForce.metadata?.chapters} chapters`);
    console.log(`Current chapters in DB: ${fireForce.chapters.length}\n`);

    if (!fireForce.metadata || !fireForce.metadata.chapters) {
      console.log('❌ No metadata found or chapter count is missing');
      return;
    }

    const totalChapters = fireForce.metadata.chapters;
    
    // Check if we already have chapters
    if (fireForce.chapters.length > 0) {
      console.log(`⚠️  Already have ${fireForce.chapters.length} chapters in database`);
      const confirm = await new Promise((resolve) => {
        console.log('Delete existing chapters and recreate? (y/n): ');
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim().toLowerCase() === 'y');
        });
      });
      
      if (!confirm) {
        console.log('Cancelled');
        return;
      }
      
      // Delete existing chapters
      await prisma.chapter.deleteMany({
        where: { mangaId: fireForce.id }
      });
      console.log('✅ Deleted existing chapters\n');
    }

    console.log(`Creating ${totalChapters} chapter records...`);
    
    // Create chapters in batches to avoid overwhelming the database
    const batchSize = 50;
    const chapters = [];
    
    for (let i = 1; i <= totalChapters; i++) {
      chapters.push({
        mangaId: fireForce.id,
        index: i,
        title: `Chapter ${i}`,
        fileName: `chapter-${i.toString().padStart(3, '0')}.cbz`, // Standard naming
        size: 0, // Will be updated when downloaded
        downloadStatus: 'PENDING'
      });
      
      if (chapters.length === batchSize || i === totalChapters) {
        await prisma.chapter.createMany({
          data: chapters
        });
        console.log(`✅ Created chapters ${i - chapters.length + 1} to ${i}`);
        chapters.length = 0; // Clear array for next batch
      }
    }
    
    // Verify creation
    const finalCount = await prisma.chapter.count({
      where: { mangaId: fireForce.id }
    });
    
    console.log(`\n✨ Successfully created ${finalCount} chapter records!`);
    console.log('\nChapters are now visible in the manga page.');
    console.log('Users can perform actions like:');
    console.log('- Download individual chapters or volumes');
    console.log('- Mark chapters as read/unread');
    console.log('- View chapter details');
    
  } catch (error) {
    console.error('Error creating chapters:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createFireForceChapters();