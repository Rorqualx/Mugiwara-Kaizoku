#!/usr/bin/env node

/**
 * Test script to verify metadata refresh fix
 * 
 * This script tests that the metadata refresh no longer confuses
 * AniList date years with volume/chapter counts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMetadataRefreshFix() {
  try {
    console.log('Testing metadata refresh fix...\n');
    
    // Get a manga that uses AniList as the provider
    const mangaList = await prisma.manga.findMany({
      where: {
        source: {
          contains: 'anilist',
          mode: 'insensitive'
        }
      },
      include: {
        metadata: true
      },
      take: 5
    });
    
    if (mangaList.length === 0) {
      console.log('No AniList manga found in database');
      return;
    }
    
    console.log(`Found ${mangaList.length} AniList manga:\n`);
    
    for (const manga of mangaList) {
      console.log(`Manga: ${manga.title} (ID: ${manga.id})`);
      console.log(`  Source: ${manga.source}`);
      
      if (manga.metadata) {
        console.log(`  Current Metadata:`);
        console.log(`    - Volumes: ${manga.metadata.volumes || 'Not set'}`);
        console.log(`    - Chapters: ${manga.metadata.chapters || 'Not set'}`);
        console.log(`    - Start Date: ${manga.metadata.startDate || 'Not set'}`);
        console.log(`    - End Date: ${manga.metadata.endDate || 'Not set'}`);
        
        // Check for suspicious values
        if (manga.metadata.volumes && manga.metadata.volumes >= 1900 && manga.metadata.volumes <= 2100) {
          console.log(`    ⚠️  WARNING: Volume count (${manga.metadata.volumes}) looks like a year!`);
        }
        if (manga.metadata.chapters && manga.metadata.chapters >= 1900 && manga.metadata.chapters <= 2100) {
          console.log(`    ⚠️  WARNING: Chapter count (${manga.metadata.chapters}) looks like a year!`);
        }
        
        // Check if the year from dates matches volumes/chapters
        if (manga.metadata.startDate) {
          const startYear = new Date(manga.metadata.startDate).getFullYear();
          if (manga.metadata.volumes === startYear) {
            console.log(`    ⚠️  ISSUE DETECTED: Volume count matches start year (${startYear})`);
          }
          if (manga.metadata.chapters === startYear) {
            console.log(`    ⚠️  ISSUE DETECTED: Chapter count matches start year (${startYear})`);
          }
        }
        
        if (manga.metadata.endDate) {
          const endYear = new Date(manga.metadata.endDate).getFullYear();
          if (manga.metadata.volumes === endYear) {
            console.log(`    ⚠️  ISSUE DETECTED: Volume count matches end year (${endYear})`);
          }
          if (manga.metadata.chapters === endYear) {
            console.log(`    ⚠️  ISSUE DETECTED: Chapter count matches end year (${endYear})`);
          }
        }
      } else {
        console.log(`  No metadata found`);
      }
      
      console.log('');
    }
    
    console.log('\n✅ Test complete. If any issues were detected above, they should be fixed after refreshing metadata.');
    console.log('The fix will prevent date years from being used as volume/chapter counts during refresh.');
    
  } catch (error) {
    console.error('Error running test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testMetadataRefreshFix();