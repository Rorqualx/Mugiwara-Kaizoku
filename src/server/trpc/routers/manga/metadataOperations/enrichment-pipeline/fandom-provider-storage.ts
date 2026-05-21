/**
 * Fandom Provider Metadata Storage
 *
 * Handles storing Fandom enrichment data in providerMetadata JSON field.
 * Extracted from phase-fandom-enrichment.ts to keep file sizes manageable.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { ChapterEnrichmentMaps, ChapterUrlTemplate } from './types';
import type { Prisma } from '@prisma/client';

/** Maximum age (in days) before a stored template is considered stale */
const TEMPLATE_TTL_DAYS = 30;

/** Load existing provider metadata from DB */
async function loadProviderMetadata(mangaId: number): Promise<Record<string, unknown>> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { providerMetadata: true },
  });
  if (!manga?.providerMetadata) return {};
  return manga.providerMetadata as Record<string, unknown>;
}

/** Extract a Fandom subdomain (e.g. "naruto" from https://naruto.fandom.com/wiki/...). */
function extractFandomSubdomain(fandomUrl: string): string | null {
  const m = /^https?:\/\/([^.]+)\.fandom\.com/i.exec(fandomUrl);
  return m?.[1] ?? null;
}

/**
 * Inject `providerId` (subdomain) + `wikiUrl` into a fandom-block being persisted.
 * The cold-import audit surfaced that successful Fandom binds were leaving
 * `providerMetadata.fandom.providerId` null because `buildUpdatedProviderMetadata`
 * only wrote chapter/volume/gallery payloads, not the binding identity.
 */
function attachBindingIdentity(
  fandomBlock: Record<string, unknown>, fandomUrl: string,
): Record<string, unknown> {
  const subdomain = extractFandomSubdomain(fandomUrl);
  return {
    ...fandomBlock,
    ...(subdomain ? { providerId: subdomain } : {}),
    wikiUrl: fandomUrl,
    boundAt: new Date().toISOString(),
  };
}

/** Store Fandom data in providerMetadata */
export async function storeFandomProviderMetadata(
  mangaId: number,
  maps: ChapterEnrichmentMaps,
  fandomResult: { fandomData?: unknown; chapterEnrichmentMap: Record<string, unknown>; enrichedVolumes: unknown[] },
  buildUpdatedProviderMetadata: (...args: unknown[]) => Record<string, unknown>,
  fandomUrl: string,
): Promise<void> {
  const enrichmentMapForStorage = buildEnrichmentMapForStorage(maps);
  const existingProviderMeta = await loadProviderMetadata(mangaId);

  if (fandomResult.fandomData) {
    await storeFandomWithScraperData(mangaId, existingProviderMeta, enrichmentMapForStorage, fandomResult, buildUpdatedProviderMetadata, fandomUrl);
    return;
  }

  if (Object.keys(enrichmentMapForStorage).length > 0) {
    await storeFandomWithFallbackData(mangaId, existingProviderMeta, enrichmentMapForStorage, fandomUrl);
  }
}

/** Store fandom metadata when scraper data is available */
async function storeFandomWithScraperData(
  mangaId: number,
  existingProviderMeta: Record<string, unknown>,
  enrichmentMapForStorage: Record<number, unknown>,
  fandomResult: { fandomData?: unknown; chapterEnrichmentMap: Record<string, unknown>; enrichedVolumes: unknown[] },
  buildUpdatedProviderMetadata: (...args: unknown[]) => Record<string, unknown>,
  fandomUrl: string,
): Promise<void> {
  const enrichmentMap = Object.keys(enrichmentMapForStorage).length > 0
    ? enrichmentMapForStorage
    : fandomResult.chapterEnrichmentMap;
  const built = buildUpdatedProviderMetadata(
    existingProviderMeta,
    fandomResult.fandomData,
    enrichmentMap as Record<string, unknown>,
    fandomResult.enrichedVolumes,
  );
  // Layer binding identity onto the fandom block — buildUpdatedProviderMetadata
  // writes payload but not providerId/wikiUrl.
  const fandomBlock = (built['fandom'] as Record<string, unknown> | undefined) ?? {};
  const updatedProviderMeta = {
    ...built,
    fandom: attachBindingIdentity(fandomBlock, fandomUrl),
  } as unknown as Prisma.InputJsonValue;
  await prisma.manga.update({
    where: { id: mangaId },
    data: { providerMetadata: updatedProviderMeta },
  });
}

/** Store fandom metadata from API fallback */
async function storeFandomWithFallbackData(
  mangaId: number,
  existingProviderMeta: Record<string, unknown>,
  enrichmentMapForStorage: Record<number, unknown>,
  fandomUrl: string,
): Promise<void> {
  const rawFandom: unknown = existingProviderMeta['fandom'];
  const fandomSection: Record<string, unknown> = rawFandom !== null && rawFandom !== undefined
    ? rawFandom as Record<string, unknown>
    : {};
  const fandomBlock = attachBindingIdentity({
    ...fandomSection,
    chapterEnrichment: enrichmentMapForStorage,
    lastFetch: new Date().toISOString(),
  }, fandomUrl);
  const providerMetadata = {
    ...existingProviderMeta,
    fandom: fandomBlock,
  } as unknown as Prisma.InputJsonValue;
  await prisma.manga.update({
    where: { id: mangaId },
    data: { providerMetadata },
  });
  logger.info(`[enrichmentPipeline] Stored ${Object.keys(enrichmentMapForStorage).length} chapter enrichments in providerMetadata from API fallback`);
}

/** Build enrichment map for storage from chapter maps */
function buildEnrichmentMapForStorage(
  maps: ChapterEnrichmentMaps,
): Record<number, { title?: string; coverImage?: string; summary?: string; pages?: number; releaseDate?: string }> {
  const result: Record<number, { title?: string; coverImage?: string; summary?: string; pages?: number; releaseDate?: string }> = {};
  for (const [numStr, titleVal] of Object.entries(maps.chapterTitleMap)) {
    const num = Number(numStr);
    result[num] = buildSingleChapterEnrichment(num, titleVal, maps);
  }
  return result;
}

/** Build enrichment entry for a single chapter */
function buildSingleChapterEnrichment(
  num: number,
  titleVal: string,
  maps: ChapterEnrichmentMaps,
): { title?: string; coverImage?: string; summary?: string; pages?: number; releaseDate?: string } {
  const entry: { title?: string; coverImage?: string; summary?: string; pages?: number; releaseDate?: string } = {
    title: titleVal,
  };
  if (maps.chapterCoverMap[num]) entry.coverImage = maps.chapterCoverMap[num];
  if (maps.chapterDescriptionMap[num]) entry.summary = maps.chapterDescriptionMap[num];
  if (maps.chapterPagesMap[num]) entry.pages = maps.chapterPagesMap[num];
  if (maps.chapterReleaseDateMap[num]) entry.releaseDate = maps.chapterReleaseDateMap[num];
  return entry;
}

/**
 * Load a stored chapter URL template from providerMetadata.
 * Returns null if missing or older than TEMPLATE_TTL_DAYS.
 */
export async function loadChapterUrlTemplate(mangaId: number): Promise<ChapterUrlTemplate | null> {
  const meta = await loadProviderMetadata(mangaId);
  const fandom = meta['fandom'] as Record<string, unknown> | undefined;
  const stored = fandom?.['chapterUrlTemplate'] as ChapterUrlTemplate | undefined;
  if (!stored?.template || !stored.confirmedAt) return null;

  const age = Date.now() - new Date(stored.confirmedAt).getTime();
  const maxAge = TEMPLATE_TTL_DAYS * 24 * 60 * 60 * 1000;
  if (age > maxAge) {
    logger.info(`[fandomProviderStorage] Stored template expired (age: ${Math.round(age / 86_400_000)}d)`);
    return null;
  }

  return stored;
}

/**
 * Store a chapter URL template in providerMetadata.fandom.chapterUrlTemplate.
 */
export async function storeChapterUrlTemplate(
  mangaId: number,
  template: ChapterUrlTemplate,
): Promise<void> {
  const existingProviderMeta = await loadProviderMetadata(mangaId);
  const rawFandom: unknown = existingProviderMeta['fandom'];
  const fandomSection: Record<string, unknown> = rawFandom !== null && rawFandom !== undefined
    ? rawFandom as Record<string, unknown>
    : {};

  const providerMetadata = {
    ...existingProviderMeta,
    fandom: {
      ...fandomSection,
      chapterUrlTemplate: template,
    },
  } as unknown as Prisma.InputJsonValue;

  await prisma.manga.update({
    where: { id: mangaId },
    data: { providerMetadata },
  });

  logger.info(
    `[fandomProviderStorage] Stored URL template "${template.template}" (confidence=${template.confidence.toFixed(2)}, source=${template.source})`,
  );
}

/**
 * Clear a stored chapter URL template (e.g., when it proved ineffective).
 */
export async function clearChapterUrlTemplate(mangaId: number): Promise<void> {
  const existingProviderMeta = await loadProviderMetadata(mangaId);
  const rawFandom: unknown = existingProviderMeta['fandom'];
  if (!rawFandom) return;

  const fandomSection = { ...(rawFandom as Record<string, unknown>) };
  delete fandomSection['chapterUrlTemplate'];

  const providerMetadata = {
    ...existingProviderMeta,
    fandom: fandomSection,
  } as unknown as Prisma.InputJsonValue;

  await prisma.manga.update({
    where: { id: mangaId },
    data: { providerMetadata },
  });

  logger.info(`[fandomProviderStorage] Cleared ineffective URL template for manga ${mangaId}`);
}
