#!/usr/bin/env node

/**
 * Test script for verifying the refresh metadata fix
 * This script tests that Fandom metadata is properly loaded and applied
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRefreshMetadata() {
  console.log('🔍 Testing Refresh Metadata Fix...\n');
  
  try {
    // Find manga with Fandom metadata
    const mangaWithFandom = await prisma.$queryRaw`
      SELECT id, title, "providerMetadata"::text as provider_metadata
      FROM "Manga"
      WHERE "providerMetadata"::text LIKE '%fandom_selected%'
      LIMIT 5
    `;
    
    if (!mangaWithFandom || mangaWithFandom.length === 0) {
      console.log('❌ No manga found with fandom_selected metadata');
      return;
    }
    
    console.log(`Found ${mangaWithFandom.length} manga with Fandom metadata:\n`);
    
    for (const manga of mangaWithFandom) {
      console.log(`📚 Manga: ${manga.title} (ID: ${manga.id})`);
      
      // Parse provider metadata
      let providerMetadata;
      try {
        providerMetadata = JSON.parse(manga.provider_metadata);
      } catch (e) {
        console.log('  ❌ Failed to parse provider metadata');
        continue;
      }
      
      // Check for fandom_selected key
      const fandomData = providerMetadata.fandom_selected || providerMetadata.fandom;
      
      if (fandomData) {
        console.log('  ✅ Found Fandom data:');
        console.log(`     - Volumes: ${fandomData.volumes || 'N/A'}`);
        console.log(`     - Chapters: ${fandomData.chapters || 'N/A'}`);
        
        // Check current metadata values
        const currentMetadata = await prisma.$queryRaw`
          SELECT md.volumes, md.chapters
          FROM "Manga" m
          JOIN "Metadata" md ON m."metadataId" = md.id
          WHERE m.id = ${manga.id}
        `;
        
        if (currentMetadata && currentMetadata.length > 0) {
          const current = currentMetadata[0];
          console.log('\n  📊 Current metadata in database:');
          console.log(`     - Volumes: ${current.volumes || 'NULL'}`);
          console.log(`     - Chapters: ${current.chapters || 'NULL'}`);
          
          // Check if values match
          const volumesMatch = current.volumes === fandomData.volumes;
          const chaptersMatch = current.chapters === fandomData.chapters;
          
          if (volumesMatch && chaptersMatch) {
            console.log('\n  ✅ Metadata matches Fandom data!');
          } else {
            console.log('\n  ⚠️  Metadata does not match Fandom data');
            
            // Check for year confusion
            if (current.volumes >= 1900 && current.volumes <= 2100) {
              console.log(`  🚨 Volume count (${current.volumes}) looks like a year!`);
            }
            
            console.log('\n  💡 Run "Refresh Metadata" to apply the correct values');
          }
        }
      } else {
        console.log('  ❌ No Fandom data found in provider metadata');
      }
      
      console.log('\n' + '─'.repeat(60) + '\n');
    }
    
    // Test the isValidCount logic
    console.log('🧪 Testing isValidCount logic:\n');
    
    const testValues = [34, 305, 2022, 1995, 0, -1, 15000, 100];
    
    for (const value of testValues) {
      const isValid = isValidCount(value);
      const emoji = isValid ? '✅' : '❌';
      console.log(`  ${emoji} ${value}: ${isValid ? 'Valid' : 'Invalid (might be year or out of range)'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Validates if a numeric value is a reasonable count (not a year)
 */
function isValidCount(value) {
  if (typeof value !== 'number' || !isFinite(value)) return false;
  
  // Check if value might be a year (between 1900 and 2100)
  if (value >= 1900 && value <= 2100) {
    return false;
  }
  
  // Check for reasonable manga counts
  if (value < 0 || value > 10000) {
    return false;
  }
  
  return true;
}

// Run the test
testRefreshMetadata().catch(console.error);