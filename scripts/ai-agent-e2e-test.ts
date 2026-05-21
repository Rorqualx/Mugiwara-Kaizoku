/**
 * AI Agent End-to-End Validation Script
 *
 * Tests the full AI agent enrichment pipeline against a real manga.
 * Downloads model on first run (~1.3GB), then runs inference + tools.
 *
 * Usage: bun run scripts/ai-agent-e2e-test.ts
 */

import { prisma } from '@/server/db';
import { runAIAgentEnrichment } from '@/server/ai-agent/orchestrator/phase-orchestrator';
import { Qwen35InferenceService } from '@/server/ai-agent/agent-core/inference-service';
import { isSuccess, isError } from '@/utils/async-result';
import type { EnrichmentResult } from '@/server/services/library/metadataEnrichmentService/types';

async function main(): Promise<void> {
  const targetMangaId = parseInt(process.argv[2] ?? '199', 10); // Default: Goodbye, Eri

  // 1. Load manga from database
  const manga = await prisma.manga.findUnique({
    where: { id: targetMangaId },
    select: { id: true, title: true },
  });

  if (!manga) {
    process.stderr.write(`Manga with id ${targetMangaId} not found\n`);
    process.exit(1);
  }

  process.stderr.write(`\n=== AI Agent E2E Validation ===\n`);
  process.stderr.write(`Manga: ${manga.title} (id: ${manga.id})\n\n`);

  // 2. Create mock raw provider data (simulates Phase 1 output)
  const mockRawProviderData: EnrichmentResult = {
    status: 'matches_found',
    manga: { id: manga.id, title: manga.title },
    matches: [
      {
        id: '1',
        provider: 'mangadex',
        providerId: `mangadex-${manga.id}`,
        title: manga.title,
        confidence: 0.95,
        metadata: {},
      },
    ],
    appliedMatch: {
      id: '1',
      provider: 'mangadex',
      providerId: `mangadex-${manga.id}`,
      title: manga.title,
      confidence: 0.95,
    },
  };

  // 3. Run AI agent enrichment
  const startTime = Date.now();
  process.stderr.write(`Starting AI agent enrichment...\n`);

  const progressCallback = (phase: string, message: string): void => {
    process.stderr.write(`  [${phase}] ${message}\n`);
  };

  const result = await runAIAgentEnrichment(
    manga.id,
    manga.title,
    mockRawProviderData,
    progressCallback
  );

  const duration = Date.now() - startTime;

  // 4. Report results
  process.stderr.write(`\n=== Results (${duration}ms) ===\n`);

  if (isSuccess(result)) {
    const maps = result.data;
    process.stderr.write(`Status: SUCCESS\n`);
    process.stderr.write(`Chapter titles: ${Object.keys(maps.chapterTitleMap).length}\n`);
    process.stderr.write(`Volume assignments: ${Object.keys(maps.chapterVolumeMap).length}\n`);
    process.stderr.write(`Volume descriptions: ${Object.keys(maps.volumeDescriptionMap).length}\n`);
    process.stderr.write(`Covers: ${Object.keys(maps.chapterCoverMap).length}\n`);
    process.stderr.write(`Descriptions: ${Object.keys(maps.chapterDescriptionMap).length}\n`);

    if (Object.keys(maps.chapterTitleMap).length > 0) {
      process.stderr.write(`\nSample chapter titles:\n`);
      const entries = Object.entries(maps.chapterTitleMap).slice(0, 5);
      for (const [num, title] of entries) {
        process.stderr.write(`  Ch.${num}: ${title}\n`);
      }
    }
  } else if (isError(result)) {
    process.stderr.write(`Status: ERROR\n`);
    process.stderr.write(`Error: ${result.error.message}\n`);
  }

  process.stderr.write(`\n`);

  // Cleanup: dispose inference service before prisma to avoid NAPI crash
  Qwen35InferenceService.resetInstance();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
