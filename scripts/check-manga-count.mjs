import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkManga() {
  try {
    const count = await prisma.manga.count();
    console.log('Total manga in database:', count);
    
    if (count > 0) {
      const allManga = await prisma.manga.findMany({
        include: { metadata: true }
      });
      
      console.log('\nAll manga:');
      allManga.forEach(manga => {
        console.log(`- ${manga.title} (${manga.source}) - Metadata: ${manga.metadata ? 'Yes' : 'No'}`);
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkManga();