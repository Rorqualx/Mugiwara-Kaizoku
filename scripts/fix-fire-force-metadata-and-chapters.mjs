#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFireForceMetadata() {
  try {
    console.log('=== Fixing Fire Force Metadata ===\n');
    
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
        _count: { select: { chapters: true } }
      }
    });
    
    if (!fireForce) {
      console.log('❌ Fire Force manga not found');
      return;
    }
    
    console.log(`Found: ${fireForce.title} (ID: ${fireForce.id})`);
    console.log(`  Current metadata chapters: ${fireForce.metadata?.chapters || 'N/A'}`);
    console.log(`  Current metadata volumes: ${fireForce.metadata?.volumes || 'N/A'}`);
    console.log(`  Actual chapters in DB: ${fireForce._count.chapters}`);
    
    // Update metadata to correct values
    if (fireForce.metadataId && fireForce.metadata) {
      console.log('\n📊 Updating metadata to correct values...');
      
      await prisma.metadata.update({
        where: { id: fireForce.metadataId },
        data: {
          chapters: 304,  // Correct chapter count
          volumes: 34     // Correct volume count
        }
      });
      
      console.log('✅ Metadata updated: 304 chapters, 34 volumes');
    }
    
    // If no chapters exist, create them
    if (fireForce._count.chapters === 0) {
      console.log('\n📚 Creating 304 chapters...');
      
      const volumeCount = 34;
      const chapterCount = 304;
      const chaptersPerVolume = Math.ceil(chapterCount / volumeCount);
      
      const batchSize = 50;
      const chapters = [];
      
      for (let i = 1; i <= chapterCount; i++) {
        // Calculate which volume this chapter belongs to
        const volume = Math.ceil(i / chaptersPerVolume);
        
        chapters.push({
          mangaId: fireForce.id,
          fileName: `v${volume.toString().padStart(2, '0')}-c${i.toString().padStart(3, '0')}.cbz`,
          index: i,
          title: `Vol.${volume} Chapter ${i}`,
          size: 0,
          downloadStatus: 'PENDING'
        });
        
        // Create chapters in batches
        if (chapters.length === batchSize || i === chapterCount) {
          await prisma.chapter.createMany({
            data: chapters
          });
          console.log(`✅ Created chapters ${i - chapters.length + 1} to ${i}`);
          chapters.length = 0;
        }
      }
      
      console.log(`\n✅ Successfully created ${chapterCount} chapters!`);
    } else {
      console.log('\n⚠️  Chapters already exist, skipping creation');
    }
    
    // Verify final state
    const finalManga = await prisma.manga.findUnique({
      where: { id: fireForce.id },
      include: {
        metadata: true,
        _count: { select: { chapters: true } }
      }
    });
    
    console.log('\n📊 Final state:');
    console.log(`  Metadata chapters: ${finalManga?.metadata?.chapters}`);
    console.log(`  Metadata volumes: ${finalManga?.metadata?.volumes}`);
    console.log(`  Actual chapters in DB: ${finalManga?._count.chapters}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFireForceMetadata();