#!/usr/bin/env node

/**
 * Script to find where mock chapters are being created
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function findMockChapterSource() {
  try {
    console.log('=== Finding Mock Chapter Source ===\n');
    
    // Get all chapters with "Mock" in the title
    const mockChapters = await prisma.chapter.findMany({
      where: {
        title: { contains: 'Mock' }
      },
      include: {
        manga: {
          include: {
            metadata: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${mockChapters.length} mock chapters:\n`);
    
    for (const chapter of mockChapters) {
      console.log(`Chapter: "${chapter.title}" (ID: ${chapter.id})`);
      console.log(`  Manga: ${chapter.manga.title} (ID: ${chapter.mangaId})`);
      console.log(`  File: ${chapter.fileName}`);
      console.log(`  Index: ${chapter.index}`);
      console.log(`  Created: ${chapter.createdAt}`);
      console.log(`  Manga Created: ${chapter.manga.createdAt}`);
      console.log(`  Time diff: ${Math.round((chapter.createdAt.getTime() - chapter.manga.createdAt.getTime()) / 1000 / 60)} minutes\n`);
    }
    
    // Check if there's a pattern in metadata
    const mangasWithMockChapters = [...new Set(mockChapters.map(ch => ch.mangaId))];
    console.log('\nMangas with mock chapters:');
    
    for (const mangaId of mangasWithMockChapters) {
      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        include: {
          metadata: true,
          chapters: {
            orderBy: { index: 'asc' }
          }
        }
      });
      
      if (manga) {
        console.log(`\n${manga.title}:`);
        console.log(`  Total chapters: ${manga.chapters.length}`);
        console.log(`  Mock chapters: ${manga.chapters.filter(ch => ch.title.includes('Mock')).length}`);
        if (manga.metadata) {
          console.log(`  Metadata volumes: ${manga.metadata.volumes}`);
          console.log(`  Metadata chapters: ${manga.metadata.chapters}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findMockChapterSource();