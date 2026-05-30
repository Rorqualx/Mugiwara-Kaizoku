/**
 * Scanner Enrichment Handler
 *
 * Auto-matches a freshly-scanned manga via the modern enrichment pipeline
 * (`runEnrichmentPipeline`). Reads the underlying `EnrichmentResult` envelope
 * from the pipeline's UnifiedProviderResults and returns it so scanner
 * downstream (queue handler, ScanPreview UI) can read `appliedMatch.provider`
 * and friends.
 *
 * Errors are logged but swallowed — failed auto-match shouldn't block the
 * scan.
 */
import { runEnrichmentPipeline } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator';
import type { EnrichmentResult } from '@/types/domain/enrichment-result-types';
import { toNumberId } from '@/utils/id-converters';
import { serverLogger } from '@/utils/serverLogger';

interface UnifiedResultsShape {
  enrichmentResult?: EnrichmentResult;
}

export async function enrichMangaMetadata(
  manga: Record<string, unknown>,
): Promise<EnrichmentResult | null> {
  const mangaId = typeof manga['id'] === 'number' ? manga['id'] : 0;
  const mangaTitle = typeof manga['title'] === 'string' ? manga['title'] : '';

  if (mangaId === 0 || mangaTitle === '') {
    serverLogger.warn('Skipping auto-enrich — missing id/title', { mangaId: toNumberId(mangaId) });
    return null;
  }

  try {
    const { result } = await runEnrichmentPipeline(mangaId, mangaTitle);
    const unified = result as UnifiedResultsShape | undefined;
    return unified?.enrichmentResult ?? null;
  } catch (error: unknown) {
    serverLogger.warn('Failed to auto-enrich manga', {
      mangaId: toNumberId(mangaId),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
