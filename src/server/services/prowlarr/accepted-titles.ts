/**
 * Helper for loading the canonical-titles list that drives the Prowlarr
 * relevance gate (see `relevance-gate.ts`). Canonical title + any synonyms
 * stored on `Metadata.synonyms`, filtered for non-empty strings.
 *
 * Callers that already have the manga + its Metadata relation hydrated
 * (e.g. `autoDownloadWorker`, `alternatives-finder`) should build the
 * list inline rather than invoking this helper — it's its own DB round
 * trip. Use it from routers / entry points that only have a mangaId.
 */

import { prisma } from '@/server/db';

export async function loadAcceptedTitles(mangaId: number): Promise<string[]> {
  const row = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { title: true, Metadata: { select: { synonyms: true } } },
  });
  return [row?.title, ...(row?.Metadata?.synonyms ?? [])].filter(
    (t): t is string => typeof t === 'string' && t.length > 0,
  );
}
