#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testComicVineFlow() {
  console.log('\n=== Testing ComicVine Chapter Data Flow ===\n');
  
  try {
    // Find a manga with ComicVine as source
    const comicVineManga = await prisma.manga.findFirst({
      where: {
        source: { contains: 'comicvine' }
      },
      include: {
        metadata: true,
        chapters: {
          take: 5,
          orderBy: { index: 'asc' }
        }
      }
    });
    
    if (!comicVineManga) {
      console.log('No manga found with ComicVine as source.');
      console.log('Please add a manga using ComicVine first.');
      return;
    }
    
    console.log(`Found manga: ${comicVineManga.title} (ID: ${comicVineManga.id})`);
    console.log(`Source: ${comicVineManga.source}`);
    console.log(`Chapter count: ${comicVineManga.chapters.length}`);
    
    // Check providerMetadata for ComicVine data
    if (comicVineManga.providerMetadata) {
      console.log('\n--- Provider Metadata ---');
      const providerMeta = comicVineManga.providerMetadata;
      
      // Check if it contains ComicVine chapter data
      if (typeof providerMeta === 'object') {
        const hasComicVineChapters = 
          (providerMeta.comicvine_chapters) ||
          (providerMeta.comicvine) ||
          (Array.isArray(providerMeta) && providerMeta.find(p => p.providerId === 'comicvine_chapters'));
        
        if (hasComicVineChapters) {
          console.log('✅ Found ComicVine chapter metadata');
          
          const comicVineData = providerMeta.comicvine_chapters || 
                                providerMeta.comicvine ||
                                (Array.isArray(providerMeta) ? providerMeta.find(p => p.providerId === 'comicvine_chapters') : null);
          
          if (comicVineData?.metadata?.issues) {
            console.log(`   Total issues stored: ${comicVineData.metadata.issues.length}`);
            
            // Show first issue details
            const firstIssue = comicVineData.metadata.issues[0];
            if (firstIssue) {
              console.log('\n   First issue details:');
              console.log(`   - Name: ${firstIssue.name || firstIssue.title || 'N/A'}`);
              console.log(`   - Issue Number: ${firstIssue.issue_number || firstIssue.issueNumber || 'N/A'}`);
              console.log(`   - Description: ${firstIssue.deck ? firstIssue.deck.substring(0, 100) + '...' : 'N/A'}`);
            }
          }
        } else {
          console.log('❌ No ComicVine chapter metadata found');
        }
      }
    }
    
    // Check actual chapters created
    console.log('\n--- Created Chapters ---');
    if (comicVineManga.chapters.length > 0) {
      comicVineManga.chapters.forEach((chapter) => {
        console.log(`Chapter ${chapter.index}:`);
        console.log(`  Title: ${chapter.title}`);
        console.log(`  Cover: ${chapter.coverImage ? '✅ Has cover' : '❌ No cover'}`);
        console.log(`  Description: ${chapter.description ? '✅ Has description' : '❌ No description'}`);
        console.log(`  Release Date: ${chapter.releaseDate || 'N/A'}`);
        
        // Check if title is generic or from ComicVine
        if (chapter.title.match(/^(Chapter|Issue) #?\d+$/i)) {
          console.log(`  ⚠️  Generic title detected - ComicVine data may not have been used`);
        } else {
          console.log(`  ✅ Custom title from ComicVine`);
        }
        console.log('');
      });
    } else {
      console.log('No chapters found for this manga.');
    }
    
    // Check metadata
    if (comicVineManga.metadata) {
      console.log('\n--- Metadata ---');
      console.log(`Volumes: ${comicVineManga.metadata.volumes || 'N/A'}`);
      console.log(`Chapters: ${comicVineManga.metadata.chapters || 'N/A'}`);
    }
    
  } catch (error) {
    console.error('Error testing ComicVine flow:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testComicVineFlow().catch(console.error);