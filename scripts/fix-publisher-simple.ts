/**
 * Simple fix to update ComicVine publisher from German to English
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPublisher() {
  const mangaId = 42;

  // Get current manga
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId }
  });

  if (!manga) {
    console.error('Manga not found!');
    return;
  }

  console.log('Current providerMetadata type:', typeof manga.providerMetadata);

  // Parse providerMetadata - it might be a JSON string
  let metadata: any = manga.providerMetadata;
  if (typeof metadata === 'string') {
    metadata = JSON.parse(metadata);
  }

  // Update ComicVine fields
  if (metadata && metadata.comicvine) {
    metadata.comicvine.id = '95557';
    metadata.comicvine.volumeId = 95557;
    metadata.comicvine.comicvineId = '95557';
    metadata.comicvine.publisher = 'Kodansha Comics USA';
    metadata.comicvine.siteDetailUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';

    // Also update nested metadata.publisher if it exists
    if (metadata.comicvine.metadata) {
      metadata.comicvine.metadata.publisher = 'Kodansha Comics USA';
    }

    console.log('\nUpdating providerMetadata...');

    // Update in database
    await prisma.manga.update({
      where: { id: mangaId },
      data: {
        providerMetadata: metadata
      }
    });

    console.log('✅ Successfully updated ComicVine publisher!');
  } else {
    console.error('No comicvine metadata found!');
  }
}

fixPublisher()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
