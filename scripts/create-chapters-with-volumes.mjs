#!/usr/bin/env node

/**
 * Script to create chapter records with proper volume assignments
 * Based on typical manga volume structure
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Fire Force volume information (approximate chapter distribution)
const FIRE_FORCE_VOLUMES = [
  { volume: 1, startChapter: 1, endChapter: 7 },
  { volume: 2, startChapter: 8, endChapter: 16 },
  { volume: 3, startChapter: 17, endChapter: 25 },
  { volume: 4, startChapter: 26, endChapter: 34 },
  { volume: 5, startChapter: 35, endChapter: 43 },
  { volume: 6, startChapter: 44, endChapter: 52 },
  { volume: 7, startChapter: 53, endChapter: 61 },
  { volume: 8, startChapter: 62, endChapter: 70 },
  { volume: 9, startChapter: 71, endChapter: 79 },
  { volume: 10, startChapter: 80, endChapter: 88 },
  { volume: 11, startChapter: 89, endChapter: 97 },
  { volume: 12, startChapter: 98, endChapter: 106 },
  { volume: 13, startChapter: 107, endChapter: 115 },
  { volume: 14, startChapter: 116, endChapter: 124 },
  { volume: 15, startChapter: 125, endChapter: 133 },
  { volume: 16, startChapter: 134, endChapter: 142 },
  { volume: 17, startChapter: 143, endChapter: 151 },
  { volume: 18, startChapter: 152, endChapter: 160 },
  { volume: 19, startChapter: 161, endChapter: 169 },
  { volume: 20, startChapter: 170, endChapter: 178 },
  { volume: 21, startChapter: 179, endChapter: 187 },
  { volume: 22, startChapter: 188, endChapter: 196 },
  { volume: 23, startChapter: 197, endChapter: 205 },
  { volume: 24, startChapter: 206, endChapter: 214 },
  { volume: 25, startChapter: 215, endChapter: 223 },
  { volume: 26, startChapter: 224, endChapter: 232 },
  { volume: 27, startChapter: 233, endChapter: 241 },
  { volume: 28, startChapter: 242, endChapter: 250 },
  { volume: 29, startChapter: 251, endChapter: 259 },
  { volume: 30, startChapter: 260, endChapter: 268 },
  { volume: 31, startChapter: 269, endChapter: 277 },
  { volume: 32, startChapter: 278, endChapter: 286 },
  { volume: 33, startChapter: 287, endChapter: 295 },
  { volume: 34, startChapter: 296, endChapter: 304 }
];

function getVolumeForChapter(chapterNumber) {
  const volumeInfo = FIRE_FORCE_VOLUMES.find(
    v => chapterNumber >= v.startChapter && chapterNumber <= v.endChapter
  );
  return volumeInfo ? volumeInfo.volume : null;
}

async function updateChaptersWithVolumes() {
  try {
    console.log('=== Updating Fire Force Chapters with Volume Information ===\n');
    
    // Find Fire Force manga
    const fireForce = await prisma.manga.findFirst({
      where: {
        OR: [
          { title: { contains: 'Fire Force' } },
          { title: { contains: 'fire force' } }
        ]
      },
      include: {
        chapters: {
          orderBy: { index: 'asc' }
        }
      }
    });

    if (!fireForce) {
      console.log('❌ Fire Force manga not found');
      return;
    }

    console.log(`Found: ${fireForce.title} (ID: ${fireForce.id})`);
    console.log(`Total chapters: ${fireForce.chapters.length}\n`);

    if (fireForce.chapters.length === 0) {
      console.log('❌ No chapters found. Run create-fire-force-chapters.mjs first.');
      return;
    }

    console.log('Adding volume information to chapters...\n');

    // Update chapters with volume information
    for (const volumeInfo of FIRE_FORCE_VOLUMES) {
      const chaptersInVolume = fireForce.chapters.filter(
        ch => ch.index >= volumeInfo.startChapter && ch.index <= volumeInfo.endChapter
      );

      if (chaptersInVolume.length > 0) {
        // Update all chapters in this volume
        await prisma.chapter.updateMany({
          where: {
            mangaId: fireForce.id,
            index: {
              gte: volumeInfo.startChapter,
              lte: volumeInfo.endChapter
            }
          },
          data: {
            title: {
              set: prisma.$queryRaw`CASE 
                WHEN "title" LIKE 'Chapter %' 
                THEN CONCAT('Volume ', ${volumeInfo.volume}::text, ' - ', "title")
                ELSE "title"
              END`
            }
          }
        });

        console.log(`✅ Volume ${volumeInfo.volume}: Chapters ${volumeInfo.startChapter}-${volumeInfo.endChapter} (${chaptersInVolume.length} chapters)`);
      }
    }

    console.log('\n✨ Successfully updated chapters with volume information!');
    console.log('\nVolume distribution:');
    
    // Show summary
    let totalChapters = 0;
    for (const vol of FIRE_FORCE_VOLUMES) {
      const chapterCount = vol.endChapter - vol.startChapter + 1;
      totalChapters += chapterCount;
      console.log(`  Volume ${vol.volume}: ${chapterCount} chapters`);
    }
    console.log(`  Total: ${totalChapters} chapters across 34 volumes`);
    
  } catch (error) {
    console.error('Error updating chapters:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateChaptersWithVolumes();