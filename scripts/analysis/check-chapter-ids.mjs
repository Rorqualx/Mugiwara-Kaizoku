#!/usr/bin/env node

/**
 * Script to check chapter IDs for Fire Force
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkChapterIds() {
  try {
    console.log('=== Checking Fire Force Chapter IDs ===\n');
    
    // Find Fire Force manga
    const fireForce = await prisma.manga.findFirst({
      where: {
        OR: [
          { title: { contains: 'Fire Force' } },
          { title: { contains: 'fire force' } }
        ]
      },
      include: {
        chapters: {
          orderBy: { id: 'asc' },
          take: 10
        }
      }
    });

    if (!fireForce) {
      console.log('❌ Fire Force manga not found');
      return;
    }

    console.log(`Found: ${fireForce.title} (Manga ID: ${fireForce.id})`);
    
    // Get total chapter count
    const totalChapters = await prisma.chapter.count({
      where: { mangaId: fireForce.id }
    });
    
    console.log(`Total chapters: ${totalChapters}\n`);
    
    // Get first 10 chapters
    console.log('First 10 chapters:');
    fireForce.chapters.forEach(ch => {
      console.log(`  ID: ${ch.id}, Index: ${ch.index}, Title: ${ch.title}`);
    });
    
    // Get last 10 chapters
    const lastChapters = await prisma.chapter.findMany({
      where: { mangaId: fireForce.id },
      orderBy: { id: 'desc' },
      take: 10
    });
    
    console.log('\nLast 10 chapters:');
    lastChapters.reverse().forEach(ch => {
      console.log(`  ID: ${ch.id}, Index: ${ch.index}, Title: ${ch.title}`);
    });
    
    // Check if there are any chapters with IDs around 639-642
    const suspectChapters = await prisma.chapter.findMany({
      where: {
        id: {
          gte: 635,
          lte: 645
        }
      }
    });
    
    if (suspectChapters.length > 0) {
      console.log('\n⚠️  Found chapters with IDs around 639-642:');
      suspectChapters.forEach(ch => {
        console.log(`  ID: ${ch.id}, Manga ID: ${ch.mangaId}, Title: ${ch.title}`);
      });
    } else {
      console.log('\n✅ No chapters found with IDs 635-645');
    }
    
    // Check out of sync chapters
    const outOfSyncCount = await prisma.outOfSyncChapter.count({
      where: { mangaId: fireForce.id }
    });
    
    console.log(`\nOut of sync chapters for this manga: ${outOfSyncCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChapterIds();