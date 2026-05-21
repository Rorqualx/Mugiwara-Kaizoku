import { logger } from '@/utils/logger';

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
  id: true, filePath: true, packDownloadId: true,
  _count: { select: {
    chapterFiles: true, ReadingProgress: true, ReaderBookmark: true,
    ReadingHistory: true, WantedItem: true, NativeDownload: true,
  } },
} as const;

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
  let resetUserChapters = 0;
  if (carrierIds.length > 0) {
    const upd = await prisma.chapter.updateMany({
      where: { id: { in: carrierIds } },
      data: { title: '', chapterNumber: null, releaseDate: null, description: null },
    });
    resetUserChapters = upd.count;
  }
  return { deletedStubChapters, resetUserChapters };
}

/** Exported for testability — see clear-auto-bindings.spec. */
export { chapterIsCarrier, chapterIsPointerOnly };

async function deleteProviderVolumes(
  prisma: PrismaClient,
  mangaId: number,
  cleared: ClearableProvider[],
): Promise<{ removedVolumes: number; detachedChapters: number }> {
  const sources = cleared.map((p) => PROVIDER_TO_VOLUME_SOURCE[p]).filter((s): s is string => Boolean(s));
  if (sources.length === 0) return { removedVolumes: 0, detachedChapters: 0 };

  const vols = await prisma.volume.findMany({
    where: { mangaId, source: { in: sources } },
    select: { id: true },
  });
  if (vols.length === 0) return { removedVolumes: 0, detachedChapters: 0 };

  const ids = vols.map((v) => v.id);
  const detached = await prisma.chapter.updateMany({
    where: { volumeId: { in: ids } },
    data: { volumeId: null },
  });
  await prisma.volume.deleteMany({ where: { id: { in: ids } } });
  return { removedVolumes: vols.length, detachedChapters: detached.count };
}

const EMPTY_RESULT: ClearAutoBindingsResult = {
  providersCleared: [],
  providersPreserved: [],
  removedLinks: 0,
  removedVolumes: 0,
  detachedChapters: 0,
  deletedStubChapters: 0,
  resetUserChapters: 0,
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

  await prisma.manga.update({
    where: { id: mangaId },
    data: { providerMetadata: newPm as Prisma.InputJsonValue },
  });

  logger.info(
    `[clearAutoBindings] manga=${mangaId} cleared=[${cleared.join(',')}]`
    + ` preserved=[${preserved.join(',')}]`
    + ` links=-${removedLinks} volumes=-${removedVolumes} detachedChapters=${detachedChapters}`
    + ` stubChapters=-${deletedStubChapters} userChaptersReset=${resetUserChapters}`,
  );

  return {
    providersCleared: cleared,
    providersPreserved: preserved,
    removedLinks,
    removedVolumes,
    detachedChapters,
    deletedStubChapters,
    resetUserChapters,
  };
}
