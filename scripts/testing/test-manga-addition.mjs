#!/usr/bin/env node

/**
 * Test script to verify manga addition with proper metadata storage
 * This tests the end-to-end flow from search to creation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMangaAddition() {
  try {
    console.log('🧪 Testing manga addition with metadata...\n');
    
    // Check if we have any manga in the database
    const mangaCount = await prisma.manga.count();
    console.log(`📊 Current manga count: ${mangaCount}`);
    
    // Get the most recent manga if any exists
    if (mangaCount > 0) {
      const recentManga = await prisma.manga.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          metadata: true,
          chapters: {
            take: 5
          }
        }
      });
      
      console.log('\n📖 Most recent manga:');
      console.log(`  Title: ${recentManga.title}`);
      console.log(`  Source: ${recentManga.source}`);
      console.log(`  Provider Metadata: ${recentManga.providerMetadata ? '✅ Present' : '❌ Missing'}`);
      
      if (recentManga.metadata) {
        console.log('\n📋 Metadata:');
        console.log(`  Volumes: ${recentManga.metadata.volumes || 'N/A'}`);
        console.log(`  Chapters: ${recentManga.metadata.chapters || 'N/A'}`);
        console.log(`  Status: ${recentManga.metadata.status || 'N/A'}`);
        console.log(`  Genres: ${recentManga.metadata.genres?.join(', ') || 'N/A'}`);
      }
      
      console.log(`\n📚 Chapters: ${recentManga.chapters.length} found`);
      if (recentManga.chapters.length > 0) {
        console.log('  Sample chapters:');
        recentManga.chapters.forEach(ch => {
          console.log(`    - Chapter ${ch.index}: ${ch.title || ch.fileName}`);
        });
      }
      
      // Check for source issues
      if (recentManga.source === 'unknown' || recentManga.source === 'Unknown') {
        console.log('\n⚠️  WARNING: Manga source is "unknown" - metadata may not be properly preserved!');
      } else {
        console.log('\n✅ Manga source is properly set to:', recentManga.source);
      }
      
      // Parse provider metadata if present
      if (recentManga.providerMetadata) {
        try {
          const providerData = JSON.parse(recentManga.providerMetadata);
          console.log('\n🔍 Provider metadata details:');
          if (Array.isArray(providerData) && providerData.length > 0) {
            const provider = providerData[0];
            console.log(`  Provider ID: ${provider.providerId}`);
            console.log(`  External ID: ${provider.externalId}`);
            if (provider.metadata) {
              console.log('  Additional metadata fields:', Object.keys(provider.metadata).join(', '));
            }
          }
        } catch (e) {
          console.log('  Could not parse provider metadata');
        }
      }
    } else {
      console.log('\n📭 No manga found in database');
      console.log('💡 Try adding a manga through the UI to test the flow');
    }
    
    // Check libraries
    const libraries = await prisma.library.findMany();
    console.log(`\n📚 Libraries: ${libraries.length} found`);
    libraries.forEach(lib => {
      console.log(`  - ${lib.name} (ID: ${lib.id})`);
    });
    
    // Check for manga with each source type
    const sources = ['anilist', 'mangadex', 'comicvine', 'fandom', 'unknown'];
    console.log('\n📊 Manga by source:');
    for (const source of sources) {
      const count = await prisma.manga.count({
        where: { source }
      });
      if (count > 0) {
        console.log(`  ${source}: ${count} manga`);
      }
    }
    
    console.log('\n✅ Test complete!');
    console.log('\n💡 To fully test the flow:');
    console.log('  1. Go to http://localhost:3000');
    console.log('  2. Add a manga using the search feature');
    console.log('  3. Check that the source is correctly set (not "unknown")');
    console.log('  4. Verify metadata and chapters are created');
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testMangaAddition();