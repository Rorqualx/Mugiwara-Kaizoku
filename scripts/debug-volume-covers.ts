/**
 * Debug script to analyze why volumes 17-19 aren't being labeled
 * Run: bunx ts-node scripts/debug-volume-covers.ts
 */

import { prisma } from '@/server/db';
import { linearizeDOM } from '@/server/ml/features/dom-linearizer';
import { logger } from '@/utils/logger';

async function debugVolumeCoverLabels(): Promise<void> {
  // Find the Vinland Saga chapters and volumes page
  const page = await prisma.annotatedPage.findFirst({
    where: {
      url: {
        contains: 'vinlandsaga.fandom.com',
      },
      pageType: 'LIST',
    },
    include: {
      title: true,
    },
  });

  if (!page) {
    logger.info('No Vinland Saga list page found');
    return;
  }

  logger.info('Analyzing page', { title: page.title?.title, url: page.url, pageType: page.pageType });

  // Linearize the HTML
  const result = linearizeDOM(page.html, page.url);
  logger.info('Linearization complete', { totalTokens: result.tokens.length, imageTokens: result.stats.imageTokens });

  // Find all image tokens
  const imageTokens = result.tokens.filter(t => t.isImage);

  // Group by whether they have volume patterns
  const volumeImages = imageTokens.filter(t =>
    /volume\s*\d+/i.test(t.text) ||
    /volume\s*\d+/i.test(t.imageAlt ?? '') ||
    /vol(ume)?[-_]?\d+/i.test(t.imageSrc ?? '')
  );

  logger.info('Volume images found', { count: volumeImages.length });

  // Show all volume images
  for (const token of volumeImages) {
    const volumeMatch = token.text.match(/\d+/) ?? token.imageAlt?.match(/\d+/);
    const volumeNum = volumeMatch?.[0];
    logger.info('Volume image', {
      volume: volumeNum,
      text: token.text,
      alt: token.imageAlt,
      src: token.imageSrc?.substring(0, 80),
      isInTable: token.isInTable,
      xpath: token.xpath.substring(0, 80),
    });
  }

  // Specifically look for volumes 15-20
  logger.info('Checking for volumes 15-20 specifically');
  for (let v = 15; v <= 20; v++) {
    const found = imageTokens.find(t =>
      t.imageAlt?.toLowerCase().includes(`volume ${v}`) ||
      t.text.toLowerCase().includes(`volume ${v}`)
    );
    if (found) {
      logger.info(`Volume ${v} FOUND`, { alt: found.imageAlt, xpath: found.xpath });
    } else {
      logger.warn(`Volume ${v} NOT FOUND`);
      // Search for any token with the number
      const nearby = result.tokens.find(t =>
        t.imageAlt?.includes(String(v)) && t.isImage
      );
      if (nearby) {
        logger.info(`Found image with "${v}" in alt`, { alt: nearby.imageAlt });
      }
    }
  }

  // Check if there are images in the HTML that aren't being tokenized
  const volumeImageMatches = page.html.match(/<img[^>]*alt=["']Volume \d+["'][^>]*>/gi);
  logger.info('Volume images in raw HTML', { count: volumeImageMatches?.length ?? 0 });

  if (volumeImageMatches) {
    for (const match of volumeImageMatches.slice(-10)) {
      const altMatch = match.match(/alt=["']([^"']+)["']/i);
      const srcMatch = match.match(/src=["']([^"']+)["']/i);
      logger.info('HTML image', { alt: altMatch?.[1], src: srcMatch?.[1]?.substring(0, 50) });
    }
  }

  await prisma.$disconnect();
}

debugVolumeCoverLabels().catch((err: unknown) => {
  logger.error('Debug script failed', { error: err });
});
