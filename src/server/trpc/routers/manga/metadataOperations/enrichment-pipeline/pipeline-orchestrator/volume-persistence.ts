/**
 * Volume range persistence — extracted from pipeline-orchestrator.ts.
 *
 * Persists cross-validated `ValidatedVolumeRange[]` to the DB, creating new
 * Volume rows where missing and patching null semantic fields on existing rows.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { applyManualVolumeManifest, readManualVolumeManifest } from '../manual-volume-manifest-sentinel';

import type { ValidatedVolumeRange } from '../phase-volume-cross-validation';
import type { Prisma } from '@prisma/client';

type ExistingVolumeRow = {
  number: number;
  chapterStart: number | null;
  chapterEnd: number | null;
  title: string | null;
  description: string | null;
  coverImage: string | null;
  releaseDate: Date | null;
  isbn: string | null;
  publisher: string | null;
  alternativeTitle: string | null;
  pageCount: number | null;
};

function parseReleaseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t);
}

function fillIfMissing(
  key: string,
  value: unknown,
  current: unknown,
): Record<string, unknown> {
  return value && !current ? { [key]: value } : {};
}

/**
 * Build the Prisma update payload for an already-existing Volume row.
 * Fills semantic fields only when the DB currently has them null — cross-validation
 * is authoritative on first write; later phases (Fandom, covers) fill the rest.
 */
function buildVolumeUpdateData(
  r: ValidatedVolumeRange,
  prior: ExistingVolumeRow | undefined,
): Record<string, unknown> {
  return {
    chapterStart: r.chapterStart,
    chapterEnd: r.chapterEnd,
    totalChapters: r.chapterEnd - r.chapterStart + 1,
    source: r.sources.join('+'),
    ...fillIfMissing('title', r.title, prior?.title),
    ...fillIfMissing('description', r.description, prior?.description),
    ...fillIfMissing('coverImage', r.coverImage, prior?.coverImage),
    ...fillIfMissing('releaseDate', parseReleaseDate(r.releaseDate), prior?.releaseDate),
    ...fillIfMissing('isbn', r.isbn, prior?.isbn),
    ...fillIfMissing('publisher', r.publisher, prior?.publisher),
    ...fillIfMissing('alternativeTitle', r.alternativeTitle, prior?.alternativeTitle),
    ...(r.pageCount !== undefined && (prior?.pageCount === null || prior?.pageCount === undefined)
      ? { pageCount: r.pageCount }
      : {}),
  };
}

function buildVolumeCreateInput(
  mangaId: number,
  r: ValidatedVolumeRange,
): Prisma.VolumeCreateManyInput {
  const rd = parseReleaseDate(r.releaseDate);
  const row: Prisma.VolumeCreateManyInput = {
    mangaId,
    number: r.volumeNumber,
    chapterStart: r.chapterStart,
    chapterEnd: r.chapterEnd,
    totalChapters: r.chapterEnd - r.chapterStart + 1,
    source: r.sources.join('+'),
  };
  if (r.title) row.title = r.title;
  if (r.description) row.description = r.description;
  if (r.coverImage) row.coverImage = r.coverImage;
  if (rd) row.releaseDate = rd;
  if (r.isbn) row.isbn = r.isbn;
  if (r.publisher) row.publisher = r.publisher;
  if (r.alternativeTitle) row.alternativeTitle = r.alternativeTitle;
  if (r.pageCount !== undefined) row.pageCount = r.pageCount;
  return row;
}

/**
 * Persist cross-validated volume ranges to the database.
 * Creates/updates Volume records with validated chapterStart/chapterEnd.
 */
export async function persistValidatedVolumeRanges(
  mangaId: number,
  ranges: ValidatedVolumeRange[],
): Promise<void> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { providerMetadata: true },
  });
  const manifest = readManualVolumeManifest(manga?.providerMetadata);
  const effectiveRanges = manifest ? applyManualVolumeManifest(ranges, manifest) : ranges;
  if (manifest) {
    logger.info(`[enrichmentPipeline] Manual volume manifest active for manga ${mangaId}: ${Object.keys(manifest.volumes).length} volume(s) overridden`);
  }

  if (effectiveRanges.length === 0) return;

  const existing = await prisma.volume.findMany({
    where: { mangaId },
    select: { number: true, chapterStart: true, chapterEnd: true, title: true, description: true, coverImage: true, releaseDate: true, isbn: true, publisher: true, alternativeTitle: true, pageCount: true },
  });
  const existingByNumber = new Map(existing.map(v => [v.number, v]));
  const existingSet = new Set(existing.map(v => v.number));

  const toCreate = effectiveRanges
    .filter(r => !existingSet.has(r.volumeNumber))
    .map(r => buildVolumeCreateInput(mangaId, r));

  const toUpdate = effectiveRanges.filter(r => existingSet.has(r.volumeNumber));

  if (toCreate.length > 0) {
    await prisma.volume.createMany({ data: toCreate, skipDuplicates: true });
  }
  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map(r => prisma.volume.updateMany({
        where: { mangaId, number: r.volumeNumber },
        data: buildVolumeUpdateData(r, existingByNumber.get(r.volumeNumber)),
      })),
    );
  }

  logger.info(`[enrichmentPipeline] Persisted ${effectiveRanges.length} cross-validated volume ranges for manga ${mangaId} (${toCreate.length} created, ${toUpdate.length} updated${manifest ? ', manual manifest applied' : ''})`);
}
