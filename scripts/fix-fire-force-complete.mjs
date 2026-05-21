#!/usr/bin/env node

/**
 * Script to completely fix Fire Force metadata and remove mock chapters
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFireForce() {
  try {
    console.log('=== Fixing Fire Force Completely ===\n');
    
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
    console.log(`Current chapters: ${fireForce.chapters.length}`);
    
    // Delete all mock chapters
    const mockChapters = fireForce.chapters.filter(ch => ch.title.includes('Mock'));
    if (mockChapters.length > 0) {
      console.log(`\nDeleting ${mockChapters.length} mock chapters...`);
      
      await prisma.chapter.deleteMany({
        where: {
          mangaId: fireForce.id,
          title: { contains: 'Mock' }
        }
      });
      
      console.log('✅ Mock chapters deleted');
    }
    
    // Update metadata with correct values
    if (fireForce.metadata) {
      console.log('\nUpdating metadata with correct values...');
      console.log(`Current: ${fireForce.metadata.volumes} volumes, ${fireForce.metadata.chapters} chapters`);
      
      const updatedMetadata = await prisma.metadata.update({
        where: { id: fireForce.metadata.id },
        data: {
          volumes: 34,  // Correct number of volumes
          chapters: 304  // Correct number of chapters
        }
      });
      
      console.log(`✅ Updated to: ${updatedMetadata.volumes} volumes, ${updatedMetadata.chapters} chapters`);
    }
    
    // Verify the fix
    const verifyManga = await prisma.manga.findUnique({
      where: { id: fireForce.id },
      include: { 
        metadata: true,
        chapters: true
      }
    });
    
    console.log('\n🔍 Final verification:');
    console.log(`- Manga: ${verifyManga?.title}`);
    console.log(`- Metadata Volumes: ${verifyManga?.metadata?.volumes}`);
    console.log(`- Metadata Chapters: ${verifyManga?.metadata?.chapters}`);
    console.log(`- Actual chapters in DB: ${verifyManga?.chapters.length}`);
    
    console.log('\n✅ Fire Force has been fixed!');
    console.log('The metadata now shows the correct 34 volumes and 304 chapters.');
    console.log('The mock chapters have been removed.');
    
  } catch (error) {
    console.error('Error fixing Fire Force:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFireForce();