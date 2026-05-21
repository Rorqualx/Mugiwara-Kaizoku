#!/usr/bin/env tsx

/**
 * Script to fix Fire Force manga volume assignments
 * Run with: npx tsx scripts/fix-fire-force-volumes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFireForceVolumes() {
  try {
    console.log('Fixing Fire Force manga volume assignments...\n');
    
    // Find Fire Force manga
    const fireForce = await prisma.manga.findFirst({
      where: {
        title: {
          contains: 'Fire Force'
        }
      },
      include: {
        chapters: {
          orderBy: {
            index: 'asc'
          }
        }
      }
    });
    
    if (!fireForce) {
      console.error('Fire Force manga not found!');
      return;
    }
    
    console.log(`Found manga: ${fireForce.title} with ${fireForce.chapters.length} chapters\n`);
    
    // Get provider metadata
    let volumeDetails: any[] = [];
    if (fireForce.providerMetadata) {
      const metadata = typeof fireForce.providerMetadata === 'string' 
        ? JSON.parse(fireForce.providerMetadata as string)
        : fireForce.providerMetadata;
      
      if (metadata?.FANDOM?.volumeDetails) {
        volumeDetails = metadata.FANDOM.volumeDetails;
        console.log('Found FANDOM volume details:');
        volumeDetails.forEach((vol: any) => {
          console.log(`  Volume ${vol.volumeNumber}: Chapters ${vol.chapterRange}`);
        });
        console.log('');
      }
    }
    
    // Create chapter to volume mapping
    const chapterToVolumeMap = new Map<number, number>();
    
    for (const volume of volumeDetails) {
      if (volume.chapterRange) {
        const rangeMatch = volume.chapterRange.match(/(\d+)-(\d+)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = parseInt(rangeMatch[2], 10);
          const volumeNum = volume.volumeNumber || volume.number || 1;
          
          for (let i = start; i <= end; i++) {
            chapterToVolumeMap.set(i, volumeNum);
          }
        }
      }
    }
    
    // Update chapters with correct volume assignments
    console.log('Updating chapters:');
    const updates = [];
    
    for (const chapter of fireForce.chapters) {
      const chapterIndex = chapter.index || 0;
      let volumeNumber = chapterToVolumeMap.get(chapterIndex);
      
      // Fallback for unmapped chapters
      if (!volumeNumber) {
        if (chapterIndex === 0) {
          volumeNumber = 1; // Chapter 0 goes to Volume 1
        } else {
          volumeNumber = Math.ceil(chapterIndex / 10); // Estimate
        }
      }
      
      if (chapter.volume !== volumeNumber) {
        console.log(`  Chapter ${chapterIndex}: Volume ${chapter.volume || 'null'} -> ${volumeNumber}`);
        updates.push(
          prisma.chapter.update({
            where: { id: chapter.id },
            data: { volume: volumeNumber }
          })
        );
      }
    }
    
    if (updates.length > 0) {
      console.log(`\nUpdating ${updates.length} chapters...`);
      await Promise.all(updates);
      console.log('✓ Volume assignments fixed successfully!');
    } else {
      console.log('\n✓ All chapters already have correct volume assignments!');
    }
    
    // Show summary
    const updatedChapters = await prisma.chapter.findMany({
      where: { mangaId: fireForce.id },
      orderBy: { index: 'asc' }
    });
    
    const volumeMap = new Map<number, number[]>();
    updatedChapters.forEach(ch => {
      const vol = ch.volume || -1;
      if (!volumeMap.has(vol)) {
        volumeMap.set(vol, []);
      }
      volumeMap.get(vol)!.push(ch.index || 0);
    });
    
    console.log('\nFinal volume distribution:');
    Array.from(volumeMap.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([volume, chapters]) => {
        const range = chapters.length > 0 
          ? `${Math.min(...chapters)}-${Math.max(...chapters)}`
          : 'none';
        console.log(`  Volume ${volume}: ${chapters.length} chapters (${range})`);
      });
    
  } catch (error) {
    console.error('Error fixing volumes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFireForceVolumes();