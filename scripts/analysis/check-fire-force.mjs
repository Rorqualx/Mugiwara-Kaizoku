#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFireForce() {
  try {
    console.log('=== Checking Fire Force Manga ===\n');
    
    const mangas = await prisma.manga.findMany({
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
    
    console.log(`Found ${mangas.length} manga(s) matching "Fire Force"\n`);
    
    for (const manga of mangas) {
      console.log(`Manga: ${manga.title} (ID: ${manga.id})`);
      console.log(`  Source: ${manga.source}`);
      console.log(`  Chapters in DB: ${manga._count.chapters}`);
      console.log(`  Metadata chapters: ${manga.metadata?.chapters || 'N/A'}`);
      console.log(`  Metadata volumes: ${manga.metadata?.volumes || 'N/A'}`);
      console.log(`  Created at: ${manga.createdAt}`);
      console.log(`  Updated at: ${manga.updatedAt}`);
      
      // Check if metadata was properly created
      if (!manga.metadata) {
        console.log('  ⚠️  No metadata found for this manga!');
      }
      
      // Check for any existing chapters
      if (manga._count.chapters > 0) {
        const sampleChapters = await prisma.chapter.findMany({
          where: { mangaId: manga.id },
          take: 5,
          orderBy: { index: 'asc' }
        });
        console.log(`\n  First few chapters:`);
        sampleChapters.forEach(ch => {
          console.log(`    - Chapter ${ch.index}: ${ch.title}`);
        });
      }
      
      console.log('');
    }
    
    // Check if enrichChapterMetadataFromFandom was called
    console.log('Checking recent logs or tasks...');
    const recentTasks = await prisma.task.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`\nRecent tasks (last hour):`);
    recentTasks.forEach(task => {
      console.log(`  - ${task.type} (${task.status}) - ${task.createdAt}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFireForce();