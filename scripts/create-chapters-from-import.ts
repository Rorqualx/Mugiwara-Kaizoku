import { PrismaClient } from '@prisma/client';
import { toNumberId } from '../src/utils/id-converters';

const prisma = new PrismaClient();

async function createChaptersFromImport(mangaId?: number) {
  try {
    // Find manga with import profile
    const whereClause = mangaId ? { id: mangaId } : {};
    const mangaList = await prisma.manga.findMany({
      where: whereClause,
      include: {
        chapters: true
      }
    });

    for (const manga of mangaList) {
      console.log(`\nProcessing: ${manga.title} (ID: ${manga.id})`);

      // Skip if already has chapters
      if (manga.chapters && manga.chapters.length > 0) {
        console.log(`Already has ${manga.chapters.length} chapters, skipping...`);
        continue;
      }

      // Parse providerMetadata
      const providerMetadata = manga.providerMetadata as any;
      if (!providerMetadata) {
        console.log('No providerMetadata found, skipping...');
        continue;
      }

      // Check for import profile
      const importProfile = providerMetadata.importProfile || (manga.metadata as any)?.importProfile;
      if (!importProfile) {
        console.log('No import profile found, skipping...');
        continue;
      }

      console.log('Import profile found:', {
        primarySource: importProfile.primarySource,
        chapterSource: importProfile.chapterSource,
        selectedChapters: importProfile.selectedChapters,
        totalAvailableChapters: importProfile.totalAvailableChapters
      });

      // Get chapter data from the selected source
      const chapterSource = importProfile.chapterSource || importProfile.primarySource;
      let chapters: any[] = [];

      // Check different locations for chapter data
      if (providerMetadata[chapterSource]) {
        const sourceData = providerMetadata[chapterSource];

        // Check for ComicVine issues
        if (sourceData.rawData?.issues) {
          chapters = sourceData.rawData.issues;
        } else if (sourceData.metadata?.issues) {
          chapters = sourceData.metadata.issues;
        } else if (sourceData.issues) {
          chapters = sourceData.issues;
        }

        // Check for Fandom chapters
        else if (sourceData.volumeDetails) {
          // Extract chapters from volume details
          for (const volume of sourceData.volumeDetails) {
            if (volume.chapters && Array.isArray(volume.chapters)) {
              chapters.push(...volume.chapters.map((ch: any) => ({
                ...ch,
                volume: volume.volumeNumber || volume.number
              })));
            }
          }
        }

        // Check for AniList/generic chapters
        else if (sourceData.chapters) {
          chapters = sourceData.chapters;
        } else if (sourceData.rawData?.chapters) {
          chapters = sourceData.rawData.chapters;
        } else if (sourceData.metadata?.chapters) {
          chapters = sourceData.metadata.chapters;
        }
      }

      // If no detailed chapters found, create placeholders based on counts
      if (!chapters || chapters.length === 0) {
        const chapterCount = importProfile.selectedChapters ||
                           importProfile.totalAvailableChapters ||
                           (providerMetadata[chapterSource]?.metadata?.chapters) ||
                           (providerMetadata[chapterSource]?.metadata?.totalChapters) ||
                           0;

        if (chapterCount > 0) {
          console.log(`No detailed chapters found. Creating ${chapterCount} placeholder chapters...`);

          for (let i = 1; i <= chapterCount; i++) {
            chapters.push({
              chapterNumber: i,
              title: `Chapter ${i}`,
              index: i,
              number: i.toString()
            });
          }
        }
      }

      if (chapters.length === 0) {
        console.log('No chapter data found, skipping...');
        continue;
      }

      console.log(`Found ${chapters.length} chapters to create`);

      // Create chapter records
      const chapterRecords = chapters.map((chapter: any, index: number) => ({
        mangaId: toNumberId(manga.id),
        chapterNumber: chapter.chapterNumber || chapter.issueNumber || index + 1,
        title: chapter.title || chapter.name || `Chapter ${index + 1}`,
        volume: chapter.volume || chapter.volumeNumber || null,
        releaseDate: chapter.releaseDate || chapter.cover_date || chapter.store_date || null,
        index: chapter.index || index + 1,
        number: (chapter.number || chapter.chapterNumber || chapter.issueNumber || index + 1).toString(),
        fileName: null,
        size: null,
        pageCount: chapter.pageCount || null,
        resolutionWidth: null,
        resolutionHeight: null,
        resolutionLabel: null,
        language: chapter.language || 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
        downloadStatus: 'NOT_STARTED',
        downloadUrl: chapter.url || chapter.downloadUrl || null,
        hash: null,
        mimeType: null,
        fileFormat: null,
        filePath: null,
        coverImage: chapter.coverUrl || chapter.cover || chapter.coverImage || null,
        description: chapter.description || chapter.summary || null,
        isRead: false,
        pages: null
      }));

      // Insert chapters into database
      const result = await prisma.chapter.createMany({
        data: chapterRecords,
        skipDuplicates: true
      });

      console.log(`✅ Created ${result.count} chapters for ${manga.title}`);
    }

    console.log('\n✅ Chapter creation complete!');

  } catch (error) {
    console.error('Error creating chapters:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
const mangaId = process.argv[2] ? parseInt(process.argv[2]) : undefined;
if (mangaId && isNaN(mangaId)) {
  console.error('Invalid manga ID provided');
  process.exit(1);
}

createChaptersFromImport(mangaId);