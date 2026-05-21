#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMetadata() {
  try {
    console.log('Connecting to database...');
    
    // Check connection
    const count = await prisma.manga.count();
    console.log(`Total manga in database: ${count}`);
    
    // First find all manga to debug
    const allManga = await prisma.manga.findMany({
      include: { metadata: true }
    });
    
    console.log('All manga in database:');
    if (allManga.length === 0) {
      console.log('No manga found in database');
    } else {
      allManga.forEach(m => {
        console.log(`- ID: ${m.id}, Title: "${m.title}", Metadata ID: ${m.metadataId}`);
        if (m.metadata) {
          console.log(`  Metadata - volumes: ${m.metadata.volumes}, chapters: ${m.metadata.chapters}`);
        }
      });
    }
    
    // Find the manga
    const manga = await prisma.manga.findFirst({
      where: { 
        OR: [
          { title: 'Fire Force' },
          { title: { contains: 'Fire Force' } },
          { id: 75 }
        ]
      },
      include: { metadata: true }
    });
    
    if (!manga) {
      console.log('Fire Force manga not found');
      return;
    }
    
    console.log('Found manga:', manga.id, 'with metadata ID:', manga.metadataId);
    
    if (!manga.metadataId) {
      console.log('No metadata associated with this manga');
      return;
    }
    
    // Update the metadata with correct values and lastFetch to prevent re-enrichment
    const result = await prisma.metadata.update({
      where: { id: manga.metadataId },
      data: {
        volumes: 34,
        chapters: 303,
        status: 'COMPLETED',
        cover: 'https://comicvine.gamespot.com/a/uploads/scale_large/6/67663/5522763-01.jpg',
        coverLarge: 'https://comicvine.gamespot.com/a/uploads/scale_large/6/67663/5522763-01.jpg',
        summary: "Fire Force (Japanese: 炎炎ノ消防隊, Hepburn: En'en no Shōbōtai; lit. \"Blazing Fire Brigade\") is a Japanese manga series written and illustrated by Atsushi Ohkubo. It was serialized in Kodansha's shōnen manga magazine Weekly Shōnen Magazine from September 2015 to February 2022, with its chapters collected in 34 tankōbon volumes. In North America, the manga has been licensed for English language release by Kodansha USA.",
        lastFetch: new Date() // Set lastFetch to prevent automatic re-enrichment
      }
    });
    
    console.log('Metadata updated successfully:', result);
    
    // Create chapters if they don't exist
    const chapterCount = await prisma.chapter.count({
      where: { mangaId: manga.id }
    });
    
    if (chapterCount === 0) {
      console.log('No chapters found, creating placeholder chapters...');
      
      // Create 303 chapters distributed across 34 volumes
      const chaptersPerVolume = Math.ceil(303 / 34);
      const chapters = [];
      
      for (let i = 1; i <= 303; i++) {
        const volume = Math.ceil(i / chaptersPerVolume);
        chapters.push({
          mangaId: manga.id,
          title: `Vol.${volume} Chapter ${i}`,
          fileName: `chapter-${i}`,
          index: i - 1,
          size: 0,
          downloadStatus: 'PENDING'
        });
      }
      
      // Create chapters in batches of 50
      for (let i = 0; i < chapters.length; i += 50) {
        const batch = chapters.slice(i, i + 50);
        await prisma.chapter.createMany({
          data: batch
        });
        console.log(`Created chapters ${i + 1} to ${Math.min(i + 50, chapters.length)}`);
      }
      
      console.log(`Created ${chapters.length} placeholder chapters`);
    } else {
      console.log(`Found ${chapterCount} existing chapters`);
    }
  } catch (error) {
    console.error('Error updating metadata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMetadata();