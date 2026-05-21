import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkManga() {
  try {
    const manga = await prisma.manga.findMany({
      include: {
        metadata: true,
        chapters: true
      }
    });
    
    console.log('Total manga:', manga.length);
    
    for (const m of manga) {
      console.log('\n---');
      console.log('Title:', m.title);
      console.log('Source:', m.source);
      console.log('Provider metadata:', m.providerMetadata);
      console.log('Metadata volumes:', m.metadata?.volumes);
      console.log('Metadata chapters:', m.metadata?.chapters);
      console.log('Actual chapters count:', m.chapters?.length || 0);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkManga();