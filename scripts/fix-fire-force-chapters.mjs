#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFireForceChapters() {
  try {
    console.log('=== Fixing Fire Force Chapters ===\n');
    
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
    console.log(`  Current chapters: ${fireForce._count.chapters}`);
    console.log(`  Metadata chapters: ${fireForce.metadata?.chapters || 'N/A'}`);
    console.log(`  Metadata volumes: ${fireForce.metadata?.volumes || 'N/A'}`);
    
    if (fireForce._count.chapters > 0) {
      console.log('⚠️  Chapters already exist. Delete them first if you want to recreate.');
      return;
    }
    
    if (!fireForce.metadata?.chapters) {
      console.log('❌ No chapter count in metadata');
      return;
    }
    
    const chapterCount = fireForce.metadata.chapters;
    const volumeCount = fireForce.metadata.volumes || 1;
    const chaptersPerVolume = Math.ceil(chapterCount / volumeCount);
    
    console.log(`\n📚 Creating ${chapterCount} chapters across ${volumeCount} volumes...`);
    console.log(`   (~${chaptersPerVolume} chapters per volume)`);
    
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
    
    // Verify
    const finalCount = await prisma.chapter.count({
      where: { mangaId: fireForce.id }
    });
    console.log(`📊 Final chapter count: ${finalCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFireForceChapters();