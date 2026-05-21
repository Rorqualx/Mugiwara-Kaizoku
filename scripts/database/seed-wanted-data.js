/**
 * Seed data for Wanted functionality testing
 * 
 * Creates sample data for testing wanted pages:
 * - Sample wanted items
 * - Download history entries
 * - Blocklist entries
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import enums (they should match the uppercase values in schema)
const WantedStatus = {
  PENDING: 'PENDING',
  SEARCHING: 'SEARCHING',
  FOUND: 'FOUND',
  BLOCKED: 'BLOCKED',
  DOWNLOADED: 'DOWNLOADED',
  FAILED: 'FAILED'
};

const WantedPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

const DownloadHistoryStatus = {
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  PARTIAL: 'PARTIAL'
};

const BlocklistReason = {
  MANUAL: 'MANUAL',
  QUALITY: 'QUALITY',
  LANGUAGE: 'LANGUAGE',
  SOURCE: 'SOURCE',
  DMCA: 'DMCA',
  OTHER: 'OTHER'
};

async function seedWantedData() {
  try {
    console.log('🌱 Seeding wanted functionality data...');

    // Check if we have any manga to work with
    const mangaCount = await prisma.manga.count();
    if (mangaCount === 0) {
      console.log('⚠️  No manga found in database. Please add some manga first.');
      return;
    }

    // Get some manga to use for seed data
    const manga = await prisma.manga.findMany({
      take: 5,
      include: {
        chapters: {
          take: 2
        }
      }
    });

    // 1. Create some wanted items
    console.log('Creating wanted items...');
    const wantedItems = [];
    
    for (let i = 0; i < Math.min(3, manga.length); i++) {
      const m = manga[i];
      
      // Check if wanted item already exists
      const existing = await prisma.wantedItem.findFirst({
        where: {
          mangaId: m.id,
          chapterId: null
        }
      });

      if (!existing) {
        const wantedItem = await prisma.wantedItem.create({
          data: {
            mangaId: m.id,
            priority: i === 0 ? WantedPriority.HIGH : WantedPriority.NORMAL,
            status: i === 0 ? WantedStatus.SEARCHING : WantedStatus.PENDING,
            retryCount: i,
            lastSearchDate: i === 0 ? new Date() : null,
            metadata: {
              title: m.title,
              preferredSource: 'MangaDex',
              language: 'en'
            }
          }
        });
        wantedItems.push(wantedItem);
        console.log(`  ✅ Created wanted item for: ${m.title}`);
      }
    }

    // 2. Create download history entries
    console.log('Creating download history...');
    const downloadHistory = [];
    
    for (let i = 0; i < Math.min(5, manga.length); i++) {
      const m = manga[i];
      const chapter = m.chapters[0];
      
      if (chapter) {
        const history = await prisma.downloadHistory.create({
          data: {
            mangaId: m.id,
            chapterId: chapter.id,
            downloadId: `DL-${Date.now()}-${i}`,
            status: i % 3 === 0 ? DownloadHistoryStatus.FAILED : DownloadHistoryStatus.COMPLETED,
            startTime: new Date(Date.now() - (i + 1) * 86400000), // i+1 days ago
            endTime: i % 3 === 0 ? null : new Date(Date.now() - (i + 1) * 86400000 + 3600000), // 1 hour later
            downloadSize: Math.floor(Math.random() * 50000000) + 10000000, // 10-60 MB
            downloadSpeed: Math.floor(Math.random() * 5000000) + 500000, // 0.5-5.5 MB/s
            source: ['MangaDex', 'MangaPlus', 'ComicVine'][i % 3],
            downloadClient: ['transmission', 'nzbget'][i % 2],
            errorMessage: i % 3 === 0 ? 'Connection timeout' : null,
            metadata: {
              mangaTitle: m.title,
              chapterNumber: chapter.index?.toString() || '1',
              chapterTitle: chapter.title,
              language: 'en',
              fileName: chapter.fileName
            }
          }
        });
        downloadHistory.push(history);
        console.log(`  ✅ Created download history for: ${m.title} - Chapter ${chapter.index}`);
      }
    }

    // 3. Create blocklist entries
    console.log('Creating blocklist entries...');
    const blocklistEntries = [
      {
        mangaTitle: 'Low Quality Scans Manga',
        source: 'BadScansGroup',
        reason: BlocklistReason.QUALITY,
        reasonDetails: 'Consistently poor scan quality',
        addedBy: 'admin',
        isActive: true
      },
      {
        mangaTitle: manga[0]?.title || 'Sample Manga',
        chapterNumber: '50-60',
        reason: BlocklistReason.LANGUAGE,
        reasonDetails: 'Only available in wrong language',
        addedBy: 'admin',
        isActive: true,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      },
      {
        source: 'BlockedSource.com',
        reason: BlocklistReason.DMCA,
        reasonDetails: 'Received DMCA notice',
        addedBy: 'system',
        isActive: true
      }
    ];

    for (const entry of blocklistEntries) {
      // Check if similar entry exists
      const existing = await prisma.blocklist.findFirst({
        where: {
          OR: [
            { mangaTitle: entry.mangaTitle },
            { source: entry.source }
          ]
        }
      });

      if (!existing) {
        await prisma.blocklist.create({
          data: entry
        });
        console.log(`  ✅ Created blocklist entry: ${entry.mangaTitle || entry.source}`);
      }
    }

    // 4. Summary
    console.log('\n📊 Seed data summary:');
    const wantedCount = await prisma.wantedItem.count();
    const historyCount = await prisma.downloadHistory.count();
    const blocklistCount = await prisma.blocklist.count();
    
    console.log(`  - Wanted items: ${wantedCount}`);
    console.log(`  - Download history: ${historyCount}`);
    console.log(`  - Blocklist entries: ${blocklistCount}`);
    
    console.log('\n✅ Wanted functionality seed data completed!');
    
  } catch (error) {
    console.error('❌ Error seeding wanted data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedWantedData()
  .catch((error) => {
    console.error('Failed to seed wanted data:', error);
    process.exit(1);
  });