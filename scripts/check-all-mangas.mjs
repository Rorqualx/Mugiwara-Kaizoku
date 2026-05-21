#!/usr/bin/env node

/**
 * Script to check all mangas and their chapters
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllMangas() {
  try {
    console.log('=== Checking All Mangas ===\n');
    
    // Get all mangas with chapter counts
    const mangas = await prisma.manga.findMany({
      include: {
        _count: {
          select: { chapters: true }
        },
        metadata: {
          select: {
            chapters: true,
            volumes: true
          }
        }
      }
    });
    
    console.log(`Total mangas: ${mangas.length}\n`);
    
    for (const manga of mangas) {
      console.log(`Manga: ${manga.title} (ID: ${manga.id})`);
      console.log(`  - Chapters in DB: ${manga._count.chapters}`);
      console.log(`  - Metadata chapters: ${manga.metadata?.chapters || 'N/A'}`);
      console.log(`  - Metadata volumes: ${manga.metadata?.volumes || 'N/A'}`);
      
      // Check chapter ID range for this manga
      if (manga._count.chapters > 0) {
        const firstChapter = await prisma.chapter.findFirst({
          where: { mangaId: manga.id },
          orderBy: { id: 'asc' }
        });
        
        const lastChapter = await prisma.chapter.findFirst({
          where: { mangaId: manga.id },
          orderBy: { id: 'desc' }
        });
        
        console.log(`  - Chapter ID range: ${firstChapter?.id} - ${lastChapter?.id}`);
      }
      
      console.log('');
    }
    
    // Check which manga owns chapters 639-642
    const suspectChapters = await prisma.chapter.findMany({
      where: {
        id: {
          gte: 639,
          lte: 642
        }
      },
      include: {
        manga: true
      }
    });
    
    if (suspectChapters.length > 0) {
      console.log('Chapters 639-642 belong to:');
      suspectChapters.forEach(ch => {
        console.log(`  - Chapter ID ${ch.id}: ${ch.manga.title} (Manga ID: ${ch.mangaId})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllMangas();