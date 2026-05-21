#!/usr/bin/env node

/**
 * Debug script to trace metadata flow for Fire Force manga
 * This will help identify where the volume/chapter counts are being lost
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugMetadataFlow() {
  try {
    console.log('=== Debugging Metadata Flow ===\n');
    
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
        chapters: true,
        library: true
      }
    });

    if (!fireForce) {
      console.log('❌ Fire Force manga not found in database');
      return;
    }

    console.log('📚 Manga Details:');
    console.log(`- ID: ${fireForce.id}`);
    console.log(`- Title: ${fireForce.title}`);
    console.log(`- Source: ${fireForce.source}`);
    console.log(`- Library ID: ${fireForce.libraryId}`);
    console.log(`- Created: ${fireForce.createdAt}`);
    console.log(`- Updated: ${fireForce.updatedAt}`);
    
    console.log('\n📊 Metadata:');
    if (fireForce.metadata) {
      console.log(`- Metadata ID: ${fireForce.metadata.id}`);
      console.log(`- Volumes in metadata: ${fireForce.metadata.volumes}`);
      console.log(`- Chapters in metadata: ${fireForce.metadata.chapters}`);
      console.log(`- Cover: ${fireForce.metadata.cover ? 'Yes' : 'No'}`);
      console.log(`- Summary: ${fireForce.metadata.summary ? fireForce.metadata.summary.substring(0, 100) + '...' : 'None'}`);
      console.log(`- Status: ${fireForce.metadata.status}`);
      console.log(`- Genres: ${fireForce.metadata.genres.join(', ') || 'None'}`);
      console.log(`- Authors: ${fireForce.metadata.authors.join(', ') || 'None'}`);
      console.log(`- Alternative Titles (synonyms): ${fireForce.metadata.synonyms.join(', ') || 'None'}`);
      console.log(`- URLs: ${fireForce.metadata.urls.length} URLs`);
      if (fireForce.metadata.urls.length > 0) {
        fireForce.metadata.urls.forEach((url, i) => {
          console.log(`  ${i + 1}. ${url}`);
        });
      }
    } else {
      console.log('❌ No metadata found');
    }
    
    console.log('\n📖 Actual Chapters in Database:');
    console.log(`- Total chapters: ${fireForce.chapters.length}`);
    
    // Check for expected values
    console.log('\n🔍 Data Validation:');
    const expectedChapters = 304;
    const expectedVolumes = 34;
    
    const metadataChapters = fireForce.metadata?.chapters || 0;
    const metadataVolumes = fireForce.metadata?.volumes || 0;
    const actualChapters = fireForce.chapters.length;
    
    console.log(`\nExpected chapters: ${expectedChapters}`);
    console.log(`Metadata chapters: ${metadataChapters} ${metadataChapters === expectedChapters ? '✅' : '❌'}`);
    console.log(`Actual chapters: ${actualChapters} ${actualChapters === expectedChapters ? '✅' : '❌'}`);
    
    console.log(`\nExpected volumes: ${expectedVolumes}`);
    console.log(`Metadata volumes: ${metadataVolumes} ${metadataVolumes === expectedVolumes ? '✅' : '❌'}`);
    
    // Check for any audit logs or events
    const recentEvents = await prisma.systemEvent.findMany({
      where: {
        relatedEntityId: String(fireForce.id),
        relatedEntityType: 'manga',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    if (recentEvents.length > 0) {
      console.log('\n📋 Recent Events:');
      recentEvents.forEach(event => {
        console.log(`- ${event.createdAt.toISOString()}: ${event.message} (${event.type})`);
        if (event.details) {
          console.log(`  Details: ${JSON.stringify(event.details, null, 2)}`);
        }
      });
    }
    
    // Check if there's raw data stored anywhere
    console.log('\n🔧 Raw Data Check:');
    
    // Check if there's any data in settings or elsewhere
    const settings = await prisma.settings.findFirst();
    if (settings?.metadata) {
      const metadata = typeof settings.metadata === 'string' 
        ? JSON.parse(settings.metadata) 
        : settings.metadata;
      
      // Check if there's any Fire Force specific data
      const mangaKey = `manga_${fireForce.id}`;
      if (metadata[mangaKey]) {
        console.log(`Found manga-specific metadata in settings: ${JSON.stringify(metadata[mangaKey], null, 2)}`);
      }
    }
    
  } catch (error) {
    console.error('Error debugging metadata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugMetadataFlow();