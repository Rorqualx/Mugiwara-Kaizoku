#!/usr/bin/env bun
/**
 * Training Data Validation Script
 *
 * Validates the quality of bootstrap-labeled training data.
 */

import { prisma } from '../src/server/db';
import { logger } from '../src/utils/logger';

interface ValidationStats {
  totalPages: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  lowConfidencePages: number;
  avgConfidence: number;
  entityCoverage: Record<string, number>;
  pagesWithNoLabels: number;
  topMissingEntities: string[];
}

async function validateTrainingData(): Promise<ValidationStats> {
  logger.info('Starting training data validation...');

  // Get all annotated pages
  const pages = await prisma.annotatedPage.findMany({
    select: {
      id: true,
      url: true,
      mangaTitle: true,
      sourceType: true,
      status: true,
      confidence: true,
      labels: true,
      entityCounts: true,
    },
  });

  if (pages.length === 0) {
    logger.warn('No annotated pages found in database');
    return {
      totalPages: 0,
      byStatus: {},
      bySource: {},
      lowConfidencePages: 0,
      avgConfidence: 0,
      entityCoverage: {},
      pagesWithNoLabels: 0,
      topMissingEntities: [],
    };
  }

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const page of pages) {
    byStatus[page.status] = (byStatus[page.status] ?? 0) + 1;
  }

  // Count by source
  const bySource: Record<string, number> = {};
  for (const page of pages) {
    bySource[page.sourceType] = (bySource[page.sourceType] ?? 0) + 1;
  }

  // Confidence stats
  const confidences = pages.map((p) => p.confidence).filter((c): c is number => c !== null);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  const lowConfidencePages = confidences.filter((c) => c < 0.7).length;

  // Entity coverage
  const entityCoverage: Record<string, number> = {};
  let pagesWithNoLabels = 0;

  for (const page of pages) {
    const counts = page.entityCounts as Record<string, number> | null;
    if (!counts || Object.keys(counts).length === 0) {
      pagesWithNoLabels++;
      continue;
    }

    for (const [entity, count] of Object.entries(counts)) {
      if (count > 0) {
        entityCoverage[entity] = (entityCoverage[entity] ?? 0) + 1;
      }
    }
  }

  // Find commonly missing entities
  const allEntities = [
    'TITLE', 'ALT_TITLE', 'AUTHOR', 'ARTIST', 'SUMMARY', 'STATUS',
    'GENRE', 'VOLUME_COUNT', 'CHAPTER_COUNT', 'VOLUME_TITLE',
    'CHAPTER_TITLE', 'RELEASE_DATE', 'PUBLISHER', 'MAGAZINE',
    'COVER_IMAGE', 'DEMOGRAPHIC',
  ];

  const missingCounts = allEntities.map((entity) => ({
    entity,
    missing: pages.length - (entityCoverage[entity] ?? 0),
  }));
  missingCounts.sort((a, b) => b.missing - a.missing);
  const topMissingEntities = missingCounts.slice(0, 5).map((m) => `${m.entity}: ${m.missing} pages`);

  return {
    totalPages: pages.length,
    byStatus,
    bySource,
    lowConfidencePages,
    avgConfidence,
    entityCoverage,
    pagesWithNoLabels,
    topMissingEntities,
  };
}

function printReport(stats: ValidationStats): void {
  logger.info('='.repeat(60));
  logger.info('TRAINING DATA VALIDATION REPORT');
  logger.info('='.repeat(60));

  logger.info('Summary', { totalPages: stats.totalPages });

  logger.info('Pages by Status', stats.byStatus);

  logger.info('Pages by Source', stats.bySource);

  logger.info('Quality Metrics', {
    avgConfidence: `${(stats.avgConfidence * 100).toFixed(1)}%`,
    lowConfidencePages: stats.lowConfidencePages,
    pagesWithNoLabels: stats.pagesWithNoLabels,
  });

  // Entity coverage
  const sortedEntities = Object.entries(stats.entityCoverage)
    .sort(([, a], [, b]) => b - a)
    .reduce((acc, [entity, count]) => {
      const pct = ((count / stats.totalPages) * 100).toFixed(1);
      acc[entity] = `${count} (${pct}%)`;
      return acc;
    }, {} as Record<string, string>);

  logger.info('Entity Coverage (pages with entity found)', sortedEntities);

  logger.info('Top Missing Entities', { entities: stats.topMissingEntities });

  logger.info('='.repeat(60));

  // Recommendations
  const recommendations: string[] = [];
  if (stats.totalPages < 100) {
    recommendations.push('Collect more pages (target: 500+)');
  }
  if (stats.lowConfidencePages > stats.totalPages * 0.3) {
    recommendations.push('Review low-confidence pages manually');
  }
  if (stats.pagesWithNoLabels > 0) {
    recommendations.push(`Investigate ${stats.pagesWithNoLabels} pages with no labels`);
  }
  const bootstrapCount = stats.byStatus['BOOTSTRAP'] ?? 0;
  if (bootstrapCount > stats.totalPages * 0.5) {
    recommendations.push('Review and promote BOOTSTRAP pages to REVIEWED status');
  }

  if (recommendations.length > 0) {
    logger.info('RECOMMENDATIONS', { recommendations });
  } else {
    logger.info('Data quality looks good!');
  }
}

async function main(): Promise<void> {
  try {
    const stats = await validateTrainingData();
    printReport(stats);
  } catch (error) {
    logger.error('Validation failed', { error });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
