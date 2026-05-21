#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVolumeDisplay() {
  try {
    console.log('=== Testing Volume Display for Fire Force ===\n');
    
    // Find Fire Force manga with chapters
    const fireForce = await prisma.manga.findFirst({
      where: {
        OR: [
          { title: { contains: 'Fire Force' } },
          { title: { contains: 'fire force' } }
        ]
      },
      include: {
        metadata: true,
        chapters: {
          take: 50,  // Get first 50 chapters
          orderBy: { index: 'asc' }
        }
      }
    });
    
    if (!fireForce) {
      console.log('❌ Fire Force manga not found');
      return;
    }
    
    console.log(`Found: ${fireForce.title} (ID: ${fireForce.id})`);
    console.log(`Metadata: ${fireForce.metadata?.volumes} volumes, ${fireForce.metadata?.chapters} chapters\n`);
    
    // Group chapters by volume based on filename pattern
    const volumeMap = new Map();
    
    fireForce.chapters.forEach(chapter => {
      let volumeNumber = -1; // Default for unassigned
      
      // Extract volume from filename
      if (chapter.fileName) {
        const volumeMatch = chapter.fileName.match(/v(\d+)/i);
        if (volumeMatch && volumeMatch[1]) {
          volumeNumber = parseInt(volumeMatch[1], 10);
        }
      }
      
      if (!volumeMap.has(volumeNumber)) {
        volumeMap.set(volumeNumber, []);
      }
      volumeMap.get(volumeNumber).push(chapter);
    });
    
    // Display volume grouping
    console.log('📚 Volume Grouping:');
    console.log('==================');
    
    // Sort volumes (put -1 at the end)
    const sortedVolumes = Array.from(volumeMap.keys()).sort((a, b) => {
      if (a === -1) return 1;
      if (b === -1) return -1;
      return a - b;
    });
    
    sortedVolumes.forEach(volume => {
      const chapters = volumeMap.get(volume);
      console.log(`\n${volume === -1 ? 'Unassigned Chapters' : `Volume ${volume}`}:`);
      console.log(`  Total chapters: ${chapters.length}`);
      console.log('  Sample chapters:');
      chapters.slice(0, 3).forEach(ch => {
        console.log(`    - ${ch.title} (${ch.fileName})`);
      });
      if (chapters.length > 3) {
        console.log(`    ... and ${chapters.length - 3} more`);
      }
    });
    
    console.log('\n✅ Volume display test complete!');
    console.log('\nTo verify in the UI:');
    console.log('1. Navigate to http://localhost:3000');
    console.log('2. Go to the Fire Force manga page');
    console.log('3. Check if chapters are grouped by volume');
    console.log('4. Verify volumes can be expanded/collapsed');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testVolumeDisplay();