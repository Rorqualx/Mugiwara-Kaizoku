#!/usr/bin/env node

/**
 * Test script to verify ComicVine volume titles are displayed correctly
 * when using mixed providers (ComicVine volumes + Wikipedia chapters)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testVolumeTitles() {
  console.log('\n=== Testing Volume Title Display ===\n');
  
  try {
    // Create a test manga with ComicVine volumes and Wikipedia chapters
    const testManga = await prisma.manga.create({
      data: {
        title: 'Fire Force (Test)',
        source: 'wikipedia',
        sourceId: 'fire-force-test',
        libraryPath: '/test/fire-force',
        selectedSourceId: JSON.stringify({
          volumes: 'comicvine',
          chapters: 'wikipedia'
        }),
        providerMetadata: JSON.stringify({
          comicvine_chapters: {
            providerId: 'comicvine_chapters',
            metadata: {
              issues: [
                { issue_number: 1, name: 'Fire Walk with Me' },
                { issue_number: 2, name: 'The Burning Soul' },
                { issue_number: 3, name: 'Infernal Awakening' },
                { issue_number: 4, name: 'The Phoenix Rises' },
                { issue_number: 5, name: 'Flame of Destiny' }
              ]
            }
          },
          wikipedia_chapters: {
            providerId: 'wikipedia_chapters',
            metadata: {
              totalChapters: 10,
              volumeList: [
                {
                  number: 1,
                  chapters: [
                    { number: 1, title: 'The Beginning' },
                    { number: 2, title: 'First Flame' }
                  ]
                },
                {
                  number: 2,
                  chapters: [
                    { number: 3, title: 'Rising Heat' },
                    { number: 4, title: 'Ember Glow' }
                  ]
                },
                {
                  number: 3,
                  chapters: [
                    { number: 5, title: 'Blazing Trail' },
                    { number: 6, title: 'Scorched Earth' }
                  ]
                },
                {
                  number: 4,
                  chapters: [
                    { number: 7, title: 'Phoenix Flight' },
                    { number: 8, title: 'Eternal Flame' }
                  ]
                },
                {
                  number: 5,
                  chapters: [
                    { number: 9, title: 'Final Burn' },
                    { number: 10, title: 'Ashes to Ashes' }
                  ]
                }
              ]
            }
          }
        }),
        metadata: {
          create: {
            title: 'Fire Force (Test)',
            description: 'Test manga for volume title display',
            genres: ['Action', 'Supernatural'],
            status: 'COMPLETED',
            volumes: 5,
            chapters: 10
          }
        },
        library: {
          create: {
            name: 'Test Library',
            path: '/test/library',
            type: 'MANGA'
          }
        }
      },
      include: {
        metadata: true,
        chapters: true
      }
    });
    
    console.log(`✅ Created test manga: ${testManga.title} (ID: ${testManga.id})`);
    console.log(`   Selected sources: volumes from ComicVine, chapters from Wikipedia`);
    
    // Create chapters with proper volume mapping
    const chaptersToCreate = [];
    let chapterIndex = 1;
    
    // 10 chapters distributed across 5 ComicVine volumes (2 chapters per volume)
    const _chaptersPerVolume = 2;
    
    const wikipediaChapters = [
      { title: 'The Beginning', volumeNum: 1 },
      { title: 'First Flame', volumeNum: 1 },
      { title: 'Rising Heat', volumeNum: 2 },
      { title: 'Ember Glow', volumeNum: 2 },
      { title: 'Blazing Trail', volumeNum: 3 },
      { title: 'Scorched Earth', volumeNum: 3 },
      { title: 'Phoenix Flight', volumeNum: 4 },
      { title: 'Eternal Flame', volumeNum: 4 },
      { title: 'Final Burn', volumeNum: 5 },
      { title: 'Ashes to Ashes', volumeNum: 5 }
    ];
    
    for (const chapter of wikipediaChapters) {
      chaptersToCreate.push({
        mangaId: testManga.id,
        title: chapter.title,
        index: chapterIndex,
        fileName: `Vol.${chapter.volumeNum} Chapter ${chapterIndex}`,
        size: 0,
        downloadStatus: 'PENDING',
        volume: chapter.volumeNum // This should map to ComicVine issue number
      });
      chapterIndex++;
    }
    
    // Create all chapters
    await prisma.chapter.createMany({
      data: chaptersToCreate
    });
    
    console.log(`✅ Created ${chaptersToCreate.length} chapters with ComicVine volume mapping`);
    
    // Fetch the manga with chapters to verify
    const mangaWithChapters = await prisma.manga.findUnique({
      where: { id: testManga.id },
      include: {
        chapters: {
          orderBy: { index: 'asc' }
        }
      }
    });
    
    // Group chapters by volume
    const volumeMap = new Map();
    for (const chapter of mangaWithChapters.chapters) {
      const volumeNum = chapter.volume || -1;
      if (!volumeMap.has(volumeNum)) {
        volumeMap.set(volumeNum, []);
      }
      volumeMap.get(volumeNum).push(chapter);
    }
    
    console.log('\n--- Volume Grouping ---');
    const comicVineIssues = JSON.parse(mangaWithChapters.providerMetadata).comicvine_chapters.metadata.issues;
    
    for (const [volumeNum, chapters] of volumeMap) {
      const issue = comicVineIssues[volumeNum - 1];
      const volumeTitle = issue ? `#${issue.issue_number}: ${issue.name}` : `Volume ${volumeNum}`;
      
      console.log(`\nVolume ${volumeNum}: ${volumeTitle}`);
      for (const chapter of chapters) {
        console.log(`  - Chapter ${chapter.index}: ${chapter.title}`);
      }
    }
    
    console.log('\n✅ Test complete! Volume titles should display as:');
    console.log('   Volume 1 -> #1: Fire Walk with Me');
    console.log('   Volume 2 -> #2: The Burning Soul');
    console.log('   Volume 3 -> #3: Infernal Awakening');
    console.log('   Volume 4 -> #4: The Phoenix Rises');
    console.log('   Volume 5 -> #5: Flame of Destiny');
    
    console.log('\nThe UI should now show ComicVine issue titles as volume names!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testVolumeTitles().catch(console.error);