/**
 * Test script to verify metadata is being saved correctly
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testMetadataSave() {
  try {
    // Get the most recently added manga
    const recentManga = await prisma.manga.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        metadata: true,
        chapters: true
      }
    });

    if (!recentManga) {
      console.log('No manga found in database');
      return;
    }

    console.log('\n=== Most Recent Manga ===');
    console.log(`Title: ${recentManga.title}`);
    console.log(`Source: ${recentManga.source}`);
    console.log(`Created: ${recentManga.createdAt}`);
    
    if (recentManga.metadata) {
      console.log('\n=== Metadata ===');
      console.log(`Cover: ${recentManga.metadata.cover ? 'Yes' : 'No'}`);
      console.log(`Summary: ${recentManga.metadata.summary ? recentManga.metadata.summary.substring(0, 100) + '...' : 'None'}`);
      console.log(`Status: ${recentManga.metadata.status}`);
      console.log(`Volumes: ${recentManga.metadata.volumes || 'Not set'}`);
      console.log(`Chapters: ${recentManga.metadata.chapters || 'Not set'}`);
      console.log(`Genres: ${recentManga.metadata.genres.join(', ') || 'None'}`);
      console.log(`Authors: ${recentManga.metadata.authors.join(', ') || 'None'}`);
      console.log(`Alternative Titles: ${recentManga.metadata.synonyms.join(', ') || 'None'}`);
      console.log(`External URLs: ${recentManga.metadata.urls.length} URLs`);
    } else {
      console.log('\n⚠️  No metadata found for this manga');
    }

    console.log(`\n=== Actual Chapters ===`);
    console.log(`Chapter count in database: ${recentManga.chapters.length}`);

    // Check for Fire Force specifically
    if (recentManga.title.toLowerCase().includes('fire force')) {
      console.log('\n🔥 Fire Force Detection 🔥');
      console.log('Expected chapters: 304');
      console.log(`Actual chapters in metadata: ${recentManga.metadata?.chapters || 'Not set'}`);
      console.log(`Actual chapters in database: ${recentManga.chapters.length}`);
      
      if (recentManga.metadata?.chapters !== 304 && recentManga.metadata?.chapters !== recentManga.chapters.length) {
        console.log('\n⚠️  WARNING: Chapter count mismatch!');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMetadataSave();