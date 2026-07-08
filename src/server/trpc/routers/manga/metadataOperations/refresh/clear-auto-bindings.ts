import { logger } from '@/utils/logger';
import { MangaFileParser } from '@/utils/parsers/mangaFileParser';

import type { Prisma } from '@prisma/client';

const CLEARABLE_PROVIDERS = ['comicvine', 'fandom', 'wikipedia', 'mangadex', 'mangaupdates'] as const;
type ClearableProvider = (typeof CLEARABLE_PROVIDERS)[number];

const PROVIDER_TO_LINK_SITE: Partial<Record<ClearableProvider, string>> = {
  comicvine: 'ComicVine',
  fandom: 'Fandom',
  wikipedia: 'Wikipedia',
};

const PROVIDER_TO_VOLUME_SOURCE: Partial<Record<ClearableProvider, string>> = {
  comicvine: 'comicvine',
  fandom: 'fandom',
  wikipedia: 'wikipedia',
  mangadex: 'mangadex',
};

export interface ClearAutoBindingsResult {
  providersCleared: ClearableProvider[];
  providersPreserved: ClearableProvider[];
  removedLinks: number;
  removedVolumes: number;
  detachedChapters: number;
  deletedStubChapters: number;
  resetUserChapters: number;
  resetDerivedCounts: boolean;
}

function parseProviderMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function isManualBinding(entry: unknown): boolean {
  return typeof entry === 'object' && entry !== null
    && (entry as Record<string, unknown>)['manual'] === true;
}

type PrismaClient = typeof import('@/server/db').prisma;

function partitionProviders(pm: Record<string, unknown>): {
  newPm: Record<string, unknown>;
  cleared: ClearableProvider[];
  preserved: ClearableProvider[];
} {
  const newPm = { ...pm };
  const cleared: ClearableProvider[] = [];
  const preserved: ClearableProvider[] = [];
  for (const provider of CLEARABLE_PROVIDERS) {
    const entry = pm[provider];
    if (entry === undefined) continue;
    if (isManualBinding(entry)) {
      preserved.push(provider);
      continue;
    }
    delete newPm[provider];
    cleared.push(provider);
  }
  // Clear any binding-review flag on reidentify; the next enrichment re-sets it
  // only if the rebind still yields an implausibly-low count.
  delete newPm['bindingReview'];
  return { newPm, cleared, preserved };
}

async function removeExternalLinksForProviders(
  prisma: PrismaClient,
  metadataId: number | null,
  existing: unknown,
  cleared: ClearableProvider[],
): Promise<number> {
  if (!metadataId) return 0;
  const sitesToRemove = new Set<string>(
    cleared.map((p) => PROVIDER_TO_LINK_SITE[p]).filter((s): s is string => Boolean(s)),
  );
  if (sitesToRemove.size === 0) return 0;

  const arr: Array<{ url: unknown; site: unknown }> = Array.isArray(existing)
    ? (existing as Array<{ url: unknown; site: unknown }>)
    : [];
  const filtered = arr.filter((l) => !(typeof l.site === 'string' && sitesToRemove.has(l.site)));
  const removed = arr.length - filtered.length;
  if (removed > 0) {
    await prisma.metadata.update({
      where: { id: metadataId },
      data: { externalLinks: filtered as unknown as Prisma.InputJsonValue },
    });
  }
  return removed;
}

export interface ChapterWithCounts {
  id: number;
  filePath: string | null;
  /** Optional because public helpers (chapterHasUserData/IsCarrier/IsPointerOnly)
   * don't read it. resetProviderSourcedChapters DOES use it (to recover
   * chapterNumber from filename), so its DB select includes it. */
  fileName?: string;
  packDownloadId: bigint | null;
  _count: {
    chapterFiles: number;
    ReadingProgress: number;
    ReaderBookmark: number;
    ReadingHistory: number;
    WantedItem: number;
    NativeDownload: number;
  };
}

export const CHAPTER_USER_DATA_SELECT = {
  id: true, filePath: true, fileName: true, packDownloadId: true,
  _count: { select: {
    chapterFiles: true, ReadingProgress: true, ReaderBookmark: true,
    ReadingHistory: true, WantedItem: true, NativeDownload: true,
  } },
} as const;

/**
 * Try to recover a chapter number from a carrier row's filename so we don't
 * leave it as a chapterNumber=null orphan after reset. Returns null when the
 * filename has no recoverable number (e.g. a volume file with no chapter
 * range, or a weird convention we don't understand) — in that case nulling
 * is the right call.
 *
 * Without this, the next pipeline pass would: (a) keep the carrier (filePath
 * set, chapterNumber null), AND (b) create a fresh slot row for the parsed
 * chapter number, AND (c) bind the same file to the new row via
 * matchFileToChapter — double-binding the file and producing the Kaiju vol 1
 * 14-rows-for-7-files duplication.
 */
function recoverChapterNumberFromFileName(fileName: string): number | null {
  if (!fileName || fileName.length === 0) return null;
  const parsed = MangaFileParser.parse(fileName);
  return parsed.chapter ?? null;
}

export function chapterHasUserData(c: ChapterWithCounts): boolean {
  if (c.filePath !== null || c.packDownloadId !== null) return true;
  const k = c._count;
  return k.chapterFiles > 0 || k.ReadingProgress > 0 || k.ReaderBookmark > 0
    || k.ReadingHistory > 0 || k.WantedItem > 0 || k.NativeDownload > 0;
}

/**
 * "Carrier" chapters anchor real files or pack-downloads. Nulling their
 * chapterNumber/title on reidentify is intentional — they survive as the
 * carrier of the file mapping until the next provider supplies a number.
 */
function chapterIsCarrier(c: ChapterWithCounts): boolean {
  return c.filePath !== null || c.packDownloadId !== null || c._count.chapterFiles > 0;
}

/**
 * "Pointer-only" chapters have no file/pack/chapterFiles, but do have one of
 * the secondary signals (ReadingProgress, ReaderBookmark, ReadingHistory,
 * WantedItem, NativeDownload). On reidentify they were previously nulled and
 * preserved — but a bookmark with no chapter number is useless and just
 * creates a phantom row. We delete the chapter; cascade kills the dependents.
 */
function chapterIsPointerOnly(c: ChapterWithCounts): boolean {
  return chapterHasUserData(c) && !chapterIsCarrier(c);
}

function partitionChaptersByUserData(chapters: ChapterWithCounts[]): {
  stubIds: number[];
  carrierIds: number[];
} {
  const stubIds: number[] = [];
  const carrierIds: number[] = [];
  for (const c of chapters) {
    // "Pointer-only" rows (bookmarks/wants/progress without a file or
    // chapterFile) are treated as stubs — keeping them around as
    // chapterNumber=null phantoms after reidentify is worse than letting
    // cascade-delete remove the orphan dependents.
    if (chapterIsCarrier(c)) carrierIds.push(c.id);
    else stubIds.push(c.id);
  }
  return { stubIds, carrierIds };
}

/**
 * Reset provider-sourced chapter data so the pipeline re-populates from current
 * bindings instead of preserving stale strings from a prior wrong match.
 *
 * Two passes:
 *   - Stub + pointer-only chapters get deleted (cascade handles bookmarks,
 *     wants, progress, native-downloads).
 *   - Carrier chapters (real file, pack-download, or chapterFiles row) keep
 *     their identity but get their provider-sourced fields nulled.
 *
 * Pre-2026-05-19: pointer-only rows were preserved-and-nulled, leaving
 * chapterNumber=null phantoms that cluttered the volume browser. See audit
 * plan Fix C.
 */
interface CarrierUpdate { id: number; recoveredChapterNumber: number | null }

/**
 * Dedupe by recovered number — when multiple carriers' filenames parse to
 * the SAME chapter number (duplicate downloads, mirror archives, vN-cN
 * archives where v and c collide), the per-row update loop in
 * resetProviderSourcedChapters would hit unique(mangaId, chapterNumber)
 * on the second carrier. Keep the first carrier per number (sorted by id
 * ascending so the older row wins); the rest fall through to the null
 * path as anchor rows the pipeline can later re-merge.
 */
function partitionCarrierUpdates(
  carrierUpdates: CarrierUpdate[],
): { recoverable: CarrierUpdate[]; nullable: number[] } {
  const recoverableRaw = carrierUpdates.filter(u => u.recoveredChapterNumber !== null);
  const nullableRaw = carrierUpdates.filter(u => u.recoveredChapterNumber === null).map(u => u.id);
  const seenNumbers = new Set<number>();
  const recoverable: CarrierUpdate[] = [];
  const collisionFallback: number[] = [];
  for (const u of [...recoverableRaw].sort((a, b) => a.id - b.id)) {
    const n = u.recoveredChapterNumber;
    if (n === null) continue;
    if (seenNumbers.has(n)) {
      collisionFallback.push(u.id);
      continue;
    }
    seenNumbers.add(n);
    recoverable.push(u);
  }
  return { recoverable, nullable: [...nullableRaw, ...collisionFallback] };
}

async function resetProviderSourcedChapters(
  prisma: PrismaClient,
  mangaId: number,
): Promise<{ deletedStubChapters: number; resetUserChapters: number }> {
  const chapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: CHAPTER_USER_DATA_SELECT,
  });
  const { stubIds, carrierIds } = partitionChaptersByUserData(chapters);

  let deletedStubChapters = 0;
  if (stubIds.length > 0) {
    const del = await prisma.chapter.deleteMany({ where: { id: { in: stubIds } } });
    deletedStubChapters = del.count;
  }
  // Partition carriers into "recover from filename" vs "null out". Carriers
  // whose filename parses to a chapter number get to keep their number so
  // the next pipeline pass matches the file → existing row instead of
  // creating a fresh duplicate slot.
  const carrierRows = chapters.filter(c => carrierIds.includes(c.id));
  const carrierUpdates = carrierRows.map(c => ({
    id: c.id,
    recoveredChapterNumber: recoverChapterNumberFromFileName(c.fileName),
  }));
  const { recoverable, nullable } = partitionCarrierUpdates(carrierUpdates);

  // IMPORTANT: title AND description are INTENTIONALLY preserved.
  //
  // Earlier this function wiped them alongside chapterNumber/releaseDate, on
  // the assumption that the post-reset enrichment would re-populate from
  // current provider data. In practice the chapter-title-fill priority chain
  // (MangaDex → Wikipedia → Fandom) covers chapters partially or not at all:
  //   - MangaDex returns English titles only for chapters where the official
  //     scanlation group set one (Kaiju ch 1-3 yes, 4-7 null)
  //   - Wikipedia chapter lists use volume-level summaries, not per-chapter
  //   - Fandom page titles are literal "Chapter 1" / "Chapter 2" which the
  //     fill's GENERIC_CHAPTER_TITLE filter (correctly) rejects; the real
  //     Fandom chapter content lives in the page body (==Summary==) +
  //     infobox |jname= which the current extractor doesn't pull from
  // Result: every reidentify silently DROPS data (Kaiju 79: 23 → 1 titles
  // across two cycles). The fill phases already have correct overwrite
  // logic — chapter-title-fill skips non-generic non-stale-mangadex titles
  // — so preserving here is safe AND prevents data loss.
  //
  // Likewise description is preserved because Fandom per-chapter summaries
  // are NOT currently re-extracted on every enrichment (only the volume-level
  // descriptions from CV/Fandom are guaranteed). Wiping description would
  // lose the per-chapter summary text without any replacement source.
  //
  // releaseDate is still nulled because it changes when the manga binding
  // moves (different AL/MD → different scheduled chapter dates), and the
  // pipeline's count-backfills always re-supply it from the current binding.
  let resetUserChapters = 0;
  if (nullable.length > 0) {
    const upd = await prisma.chapter.updateMany({
      where: { id: { in: nullable } },
      data: { chapterNumber: null, releaseDate: null },
    });
    resetUserChapters += upd.count;
  }
  const collisionNullable: number[] = [];
  for (const r of recoverable) {
    try {
      // eslint-disable-next-line no-await-in-loop -- per-row update because chapterNumber differs per carrier
      await prisma.chapter.update({
        where: { id: r.id },
        data: { chapterNumber: r.recoveredChapterNumber, releaseDate: null },
      });
      resetUserChapters++;
    } catch (err) {
      // Unique(mangaId, chapterNumber) collision can happen across update
      // orderings — carrier B's recovered number collides with carrier A's
      // CURRENT number (A hasn't been updated yet, or A's recovery target
      // matches B's recovery target after the per-batch dedupe). Fall the
      // colliding carrier through to the null path so it survives as an
      // anchor row the pipeline's later phases can re-merge.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Unique constraint') && msg.includes('chapterNumber')) {
        collisionNullable.push(r.id);
        continue;
      }
      throw err;
    }
  }
  if (collisionNullable.length > 0) {
    const upd = await prisma.chapter.updateMany({
      where: { id: { in: collisionNullable } },
      data: { chapterNumber: null, releaseDate: null },
    });
    resetUserChapters += upd.count;
  }
  return { deletedStubChapters, resetUserChapters };
}

/** Exported for testability — see clear-auto-bindings.spec. */
export { chapterIsCarrier, chapterIsPointerOnly };

/**
 * A volume is auto-derived (clearable on reidentify) when it's a `reconciliation`
 * volume, or its `source` is composed *entirely* of cleared provider names. This
 * catches cross-validation compounds like `"comicvine+wikipedia+mangadex"` that a
 * naive exact-name `IN` filter misses — the gap that left Dorohedoro's 23 provider
 * volumes (+ 2 reconciliation phantoms) undeletable on reidentify. A compound that
 * includes a preserved provider (e.g. a manual binding) is kept; null/empty/custom
 * sources are left alone (ambiguous — may be user-created).
 */
export function shouldClearVolumeSource(source: string | null, clearedSources: Set<string>): boolean {
  if (!source) return false;
  if (source === 'reconciliation') return true;
  const parts = source.split('+').map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => clearedSources.has(p));
}

async function deleteProviderVolumes(
  prisma: PrismaClient,
  mangaId: number,
  cleared: ClearableProvider[],
): Promise<{ removedVolumes: number; detachedChapters: number }> {
  const clearedSources = new Set(
    cleared.map((p) => PROVIDER_TO_VOLUME_SOURCE[p]).filter((s): s is string => Boolean(s)),
  );
  if (clearedSources.size === 0) return { removedVolumes: 0, detachedChapters: 0 };

  const all = await prisma.volume.findMany({ where: { mangaId }, select: { id: true, source: true } });
  const ids = all.filter((v) => shouldClearVolumeSource(v.source, clearedSources)).map((v) => v.id);
  if (ids.length === 0) return { removedVolumes: 0, detachedChapters: 0 };

  const detached = await prisma.chapter.updateMany({
    where: { volumeId: { in: ids } },
    data: { volumeId: null },
  });
  await prisma.volume.deleteMany({ where: { id: { in: ids } } });
  return { removedVolumes: ids.length, detachedChapters: detached.count };
}

/**
 * Provider-derived summary counts on Metadata (volumes/chapters) go stale when a
 * manga was previously bound to a different entry — classically a spin-off left
 * carrying its parent series' counts (e.g. "Before the Fall" stuck on the main
 * AoT 34 volumes / 139 chapters). Nothing downstream overwrites a positive value
 * — both count-backfills are fill-only — so the volume browser keeps synthesising
 * phantom volume rows up to the stale count (volume-processing's
 * addMissingPlaceholderVolumes loops 1..Metadata.volumes). Null them on
 * reidentify so the fresh enrichment + fill-only backfills rebuild the counts
 * from the rebuilt Volume/Chapter rows instead of preserving parent-series noise.
 */
async function resetDerivedMetadataCounts(
  prisma: PrismaClient,
  metadataId: number | null,
): Promise<boolean> {
  if (!metadataId) return false;
  await prisma.metadata.update({
    where: { id: metadataId },
    data: { volumes: null, chapters: null },
  });
  return true;
}

const EMPTY_RESULT: ClearAutoBindingsResult = {
  providersCleared: [],
  providersPreserved: [],
  removedLinks: 0,
  removedVolumes: 0,
  detachedChapters: 0,
  deletedStubChapters: 0,
  resetUserChapters: 0,
  resetDerivedCounts: false,
};

/**
 * Reidentify clears all auto provider bindings before re-enrichment so stale
 * matches don't survive the newer-wins externalLinks merge. AniList is the
 * anchor (preserved). Manual bindings (`providerMetadata.<p>.manual === true`)
 * are also preserved — that flag is the load-bearing signal that the user
 * picked a binding intentionally.
 *
 * Cleared per provider:
 *   - `Manga.providerMetadata.<provider>` entry
 *   - `Metadata.externalLinks` rows for that provider's site
 *   - `Volume` rows where `source` matches the provider — chapters detached,
 *     not deleted, so user-owned read progress survives.
 */
export async function clearAutoBindingsForReidentify(
  prisma: PrismaClient,
  mangaId: number,
): Promise<ClearAutoBindingsResult> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: {
      providerMetadata: true,
      metadataId: true,
      Metadata: { select: { externalLinks: true } },
    },
  });
  if (!manga) return { ...EMPTY_RESULT };

  const pm = parseProviderMetadata(manga.providerMetadata);
  const { newPm, cleared, preserved } = partitionProviders(pm);
  if (cleared.length === 0) {
    return { ...EMPTY_RESULT, providersPreserved: preserved };
  }

  const removedLinks = await removeExternalLinksForProviders(
    prisma, manga.metadataId, manga.Metadata?.externalLinks, cleared,
  );
  const { removedVolumes, detachedChapters } = await deleteProviderVolumes(prisma, mangaId, cleared);
  const { deletedStubChapters, resetUserChapters } = await resetProviderSourcedChapters(prisma, mangaId);
  const resetDerivedCounts = await resetDerivedMetadataCounts(prisma, manga.metadataId);

  await prisma.manga.update({
    where: { id: mangaId },
    data: { providerMetadata: newPm as Prisma.InputJsonValue },
  });

  logger.info(
    `[clearAutoBindings] manga=${mangaId} cleared=[${cleared.join(',')}]`
    + ` preserved=[${preserved.join(',')}]`
    + ` links=-${removedLinks} volumes=-${removedVolumes} detachedChapters=${detachedChapters}`
    + ` stubChapters=-${deletedStubChapters} userChaptersReset=${resetUserChapters}`
    + ` derivedCounts=${resetDerivedCounts ? 'reset' : 'kept'}`,
  );

  return {
    providersCleared: cleared,
    providersPreserved: preserved,
    removedLinks,
    removedVolumes,
    detachedChapters,
    deletedStubChapters,
    resetUserChapters,
    resetDerivedCounts,
  };
}
