/**
 * Fix ComicVine series URL from German to English version
 *
 * The current series (137211 - German) has no chapter data
 * Should use series 95557 (English) which has full chapter information
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixComicVineSeries() {
  const mangaId = 42; // Fire Force manga ID

  console.log('Fetching current manga data...');
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: {
      id: true,
      title: true,
      providerMetadata: true
    }
  });

  if (!manga) {
    console.error('Manga not found!');
    return;
  }

  console.log(`Found manga: ${manga.title}`);

  // Parse metadata if it's a string
  let metadata = typeof manga.providerMetadata === 'string'
    ? JSON.parse(manga.providerMetadata)
    : manga.providerMetadata as any;
  console.log(`Current ComicVine ID: ${metadata?.comicvine?.id}`);
  console.log(`Current series URL: ${metadata?.comicvine?.siteDetailUrl}`);

  // Update to English series
  const newSeriesId = '95557';
  const newSeriesUrl = 'https://comicvine.gamespot.com/fire-force/4050-95557/';

  console.log(`\nUpdating to English series:`);
  console.log(`New ComicVine ID: ${newSeriesId}`);
  console.log(`New series URL: ${newSeriesUrl}`);

  // Update metadata in BOTH locations
  let updated = false;

  // Update providerMetadata.comicvine
  if (metadata?.comicvine) {
    console.log('\nUpdating providerMetadata.comicvine...');
    metadata.comicvine.id = newSeriesId;
    metadata.comicvine.volumeId = parseInt(newSeriesId, 10);
    metadata.comicvine.comicvineId = newSeriesId;
    metadata.comicvine.siteDetailUrl = newSeriesUrl;
    metadata.comicvine.publisher = "Kodansha Comics USA"; // Fix publisher
    updated = true;
  }

  // Also check rawProviderData
  const rawData = manga.rawProviderData as any;
  if (rawData?.providerMetadata?.comicvine || rawData?.providerMetadata?.COMICVINE) {
    console.log('Updating rawProviderData.providerMetadata.comicvine...');
    const cvKey = rawData.providerMetadata.comicvine ? 'comicvine' : 'COMICVINE';
    rawData.providerMetadata[cvKey].id = newSeriesId;
    rawData.providerMetadata[cvKey].volumeId = parseInt(newSeriesId, 10);
    rawData.providerMetadata[cvKey].comicvineId = newSeriesId;
    rawData.providerMetadata[cvKey].siteDetailUrl = newSeriesUrl;
    if (!rawData.providerMetadata[cvKey].publisher) {
      rawData.providerMetadata[cvKey].publisher = "Kodansha Comics USA";
    }
    updated = true;
  }

  if (updated) {
    await prisma.manga.update({
      where: { id: mangaId },
      data: {
        providerMetadata: metadata,
        rawProviderData: rawData
      }
    });

    console.log('\n✅ Successfully updated ComicVine series to English version in both locations!');
    console.log('Refresh the page to see the updated publisher and volume data.');
  } else {
    console.error('No ComicVine metadata found in either location!');
  }
}

fixComicVineSeries()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
