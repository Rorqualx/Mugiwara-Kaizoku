import { prisma } from '../src/server/db';
import { logger } from '../src/utils/logger';

async function main(): Promise<void> {
  try {
    const count = await prisma.annotatedPage.count();
    logger.info('Total pages', { count });

    const pages = await prisma.annotatedPage.findMany({
      take: 3,
      select: {
        id: true,
        url: true,
        mangaTitle: true,
        sourceType: true,
        status: true,
      },
    });
    logger.info('Sample pages', { pages });
  } catch (error) {
    logger.error('Error checking database', { error: error instanceof Error ? error.message : error });
  } finally {
    await prisma.$disconnect();
  }
}

main();
