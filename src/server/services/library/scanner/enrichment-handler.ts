/**
 * Scanner Enrichment Handler
 *
 * Auto-matches a freshly-scanned manga via the modern enrichment pipeline
 * (`runEnrichmentPipeline`) and returns its `EnrichmentResult` so scanner
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

/**
 * `runEnrichmentPipeline` returns the `EnrichmentResult` itself as `result`
 * (typed `unknown`), not a wrapper around it.
 */
export function asEnrichmentResult(value: unknown): EnrichmentResult | null {
  if (value === null || typeof value !== 'object') return null;
  const candidate = value as { status?: unknown; manga?: unknown };
  if (typeof candidate.status !== 'string' || candidate.manga === null || typeof candidate.manga !== 'object') return null;
  return value as EnrichmentResult;
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
    return asEnrichmentResult(result);
  } catch (error: unknown) {
    serverLogger.warn('Failed to auto-enrich manga', {
      mangaId: toNumberId(mangaId),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
