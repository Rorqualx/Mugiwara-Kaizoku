import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFireForceChapters() {
  try {
    // Find Fire Force manga
    const fireForce = await prisma.manga.findFirst({
      where: {
        OR: [
          { title: { contains: 'Fire Force', mode: 'insensitive' } },
          { title: { contains: 'Enen no Shouboutai', mode: 'insensitive' } }
        ]
      }
    });

    if (!fireForce) {
      console.log('Fire Force manga not found');
      return;
    }

    console.log(`Found Fire Force manga: ${fireForce.title} (ID: ${fireForce.id})`);

    // Extract ComicVine data from providerMetadata
    const providerMetadata = fireForce.providerMetadata as any;
    if (!providerMetadata?.comicvine) {
      console.log('No ComicVine data found in providerMetadata');
      return;
    }

    const comicvineData = providerMetadata.comicvine;
    console.log('ComicVine data found:', {
      volumes: comicvineData.metadata?.volumes,
      publisher: comicvineData.metadata?.publisher,
      startYear: comicvineData.metadata?.startYear
    });

    // Check if we have issues/chapters data
    let issues = [];
    if (comicvineData.rawData?.issues) {
      issues = comicvineData.rawData.issues;
    } else if (comicvineData.metadata?.issues) {
      issues = comicvineData.metadata.issues;
    } else if (comicvineData.issues) {
      issues = comicvineData.issues;
    }

    // If no detailed issues, create placeholder chapters based on volume count
    if (!issues || issues.length === 0) {
      const volumeCount = comicvineData.metadata?.volumes || 34;
      console.log(`No detailed issues found. Creating ${volumeCount} placeholder volumes...`);

      // Create placeholder chapters for each volume
      const chapters = [];
      for (let i = 1; i <= volumeCount; i++) {
        chapters.push({
          mangaId: fireForce.id,
          chapterNumber: i,
          title: `Volume ${i}`,
          volume: i,
          releaseDate: null,
          index: i,
          number: i.toString(),
          // Add other required fields with defaults
          fileName: null,
          size: null,
          pageCount: null,
          resolutionWidth: null,
          resolutionHeight: null,
          resolutionLabel: null,
          language: 'en',
          createdAt: new Date(),
          updatedAt: new Date(),
          downloadStatus: 'NOT_STARTED',
          downloadUrl: null,
          hash: null,
          mimeType: null,
          fileFormat: null,
          filePath: null,
          coverImage: null,
          description: null,
          isRead: false,
          pages: null
        });
      }

      // Insert chapters into database
      const result = await prisma.chapter.createMany({
        data: chapters,
        skipDuplicates: true
      });

      console.log(`Created ${result.count} placeholder chapters`);
    } else {
      // Create chapters from actual issues data
      console.log(`Found ${issues.length} issues. Creating chapters...`);

      const chapters = issues.map((issue: any, index: number) => ({
        mangaId: fireForce.id,
        chapterNumber: issue.issueNumber || index + 1,
        title: issue.name || issue.title || `Chapter ${index + 1}`,
        volume: issue.volumeNumber || Math.ceil((index + 1) / 10), // Estimate volume if not provided
        releaseDate: issue.releaseDate || issue.cover_date || issue.store_date || null,
        index: index + 1,
        number: (issue.issueNumber || index + 1).toString(),
        // Add other required fields
        fileName: null,
        size: null,
        pageCount: issue.pageCount || null,
        resolutionWidth: null,
        resolutionHeight: null,
        resolutionLabel: null,
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
        downloadStatus: 'NOT_STARTED',
        downloadUrl: issue.url || null,
        hash: null,
        mimeType: null,
        fileFormat: null,
        filePath: null,
        coverImage: issue.coverUrl || issue.cover || null,
        description: issue.description || issue.summary || null,
        isRead: false,
        pages: null
      }));

      // Insert chapters into database
      const result = await prisma.chapter.createMany({
        data: chapters,
        skipDuplicates: true
      });

      console.log(`Created ${result.count} chapters from issues data`);
    }

    // Add import profile to providerMetadata to track selections
    const updatedProviderMetadata = {
      ...providerMetadata,
      importProfile: {
        selectedSources: {
          title: 'comicvine',
          description: 'comicvine',
          cover: 'comicvine',
          volumes: 'comicvine',
          chapters: 'comicvine',
          metadata: 'comicvine'
        },
        importDate: new Date().toISOString(),
        volumeSource: 'comicvine',
        chapterSource: 'comicvine',
        selectedVolumes: comicvineData.metadata?.volumes || 34,
        selectedChapters: issues.length || 0
      }
    };

    // Update manga with import profile
    await prisma.manga.update({
      where: { id: fireForce.id },
      data: {
        providerMetadata: updatedProviderMetadata
      }
    });

    console.log('Added import profile to manga metadata');

    // Verify the fix
    const chapterCount = await prisma.chapter.count({
      where: { mangaId: fireForce.id }
    });

    console.log(`\n✅ Fix complete! Fire Force now has ${chapterCount} chapters in the database.`);

  } catch (error) {
    console.error('Error fixing Fire Force chapters:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFireForceChapters();