import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFireForceData() {
  try {
    // Find Fire Force manga
    const fireForce = await prisma.manga.findFirst({
      where: {
        OR: [
          { title: { contains: 'Fire Force', mode: 'insensitive' } },
          { title: { contains: 'Enen no Shouboutai', mode: 'insensitive' } }
        ]
      },
      include: {
        chapters: {
          select: {
            id: true,
            chapterNumber: true,
            title: true,
            volume: true,
            releaseDate: true
          },
          orderBy: {
            chapterNumber: 'asc'
          }
        }
      }
    });

    if (fireForce) {
      console.log('\n=== FIRE FORCE MANGA DATA ===\n');
      console.log('ID:', fireForce.id);
      console.log('Title:', fireForce.title);
      console.log('Source:', fireForce.source);
      console.log('Status:', fireForce.status);

      // Check metadata
      console.log('\n=== METADATA ===');
      if (fireForce.metadata) {
        const metadata = fireForce.metadata as any;
        console.log('Raw metadata:', JSON.stringify(metadata, null, 2));
        console.log('\nParsed fields:');
        console.log('Volumes:', metadata.volumes);
        console.log('Chapters:', metadata.chapters);
        console.log('Authors:', metadata.authors);
        console.log('Artists:', metadata.artists);
        console.log('Genres:', metadata.genres);
        console.log('Tags:', metadata.tags);
        console.log('Publisher:', metadata.publisher);
      } else {
        console.log('Metadata is null/undefined');
      }

      // Check provider metadata
      console.log('\n=== PROVIDER METADATA ===');
      if (fireForce.providerMetadata) {
        const providerMeta = fireForce.providerMetadata as any;
        console.log('Raw providerMetadata:', JSON.stringify(providerMeta, null, 2).substring(0, 1000));

        if (providerMeta.comicvine) {
          console.log('\nComicVine Data:');
          console.log('- Volumes:', providerMeta.comicvine?.metadata?.volumes);
          console.log('- Issues:', providerMeta.comicvine?.metadata?.issues?.length || 0);
          if (providerMeta.comicvine?.rawData?.issues) {
            console.log('- Raw Issues Count:', providerMeta.comicvine.rawData.issues.length);
            // Show first few issues
            const issues = providerMeta.comicvine.rawData.issues.slice(0, 5);
            console.log('- Sample Issues:');
            issues.forEach((issue: any) => {
              console.log(`  * ${issue.name} - Vol ${issue.volumeNumber || 'N/A'}, Issue ${issue.issueNumber}`);
            });
          }
        }

        if (providerMeta.anilist) {
          console.log('\nAniList Data:');
          console.log('- Chapters:', providerMeta.anilist?.chapters);
          console.log('- Volumes:', providerMeta.anilist?.volumes);
        }

        if (providerMeta.fandom) {
          console.log('\nFandom Data:');
          console.log('- Chapters:', providerMeta.fandom?.chapters?.length || 0);
          console.log('- Volumes:', providerMeta.fandom?.volumes?.length || 0);
        }
      } else {
        console.log('ProviderMetadata is null/undefined');
      }

      // Check actual chapters in database
      console.log('\n=== DATABASE CHAPTERS ===');
      console.log('Total Chapters in DB:', fireForce.chapters.length);

      if (fireForce.chapters.length > 0) {
        // Group by volume
        const volumeMap = new Map<number | null, any[]>();
        fireForce.chapters.forEach(ch => {
          const vol = ch.volume;
          if (!volumeMap.has(vol)) {
            volumeMap.set(vol, []);
          }
          volumeMap.get(vol)?.push(ch);
        });

        console.log('Volumes with chapters:', volumeMap.size);

        // Show summary by volume
        Array.from(volumeMap.entries())
          .sort((a, b) => (a[0] || 0) - (b[0] || 0))
          .slice(0, 5)
          .forEach(([vol, chapters]) => {
            console.log(`- Volume ${vol || 'N/A'}: ${chapters.length} chapters`);
          });
      }
    } else {
      console.log('Fire Force manga not found in database');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFireForceData();