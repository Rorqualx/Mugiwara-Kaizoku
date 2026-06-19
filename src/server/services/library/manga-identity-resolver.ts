/**
 * Manga Identity Resolver
 *
 * Resolves whether an incoming "add this title" request refers to a title that
 * already exists in the shared catalog, so the add flow can LINK the existing
 * (already-downloaded) manga into the user's library instead of creating a
 * duplicate and re-downloading.
 *
 * Lookup priority (most to least reliable):
 *   1. Metadata (source + sourceId) — the canonical provider identity
 *   2. Manga.sourceId               — external id captured at add time
 *   3. Manga.title (case-insensitive) — the legacy key; `Manga.title` is @unique,
 *      so an identical title is GUARANTEED to resolve to the existing row.
 *
 * @module server/services/library/manga-identity-resolver
 */
import type { Manga, Prisma, PrismaClient } from '@prisma/client';

export interface MangaIdentityInput {
  /** Canonical display title (used for the guaranteed @unique fallback match). */
  title: string;
  /** External provider id supplied at add time (maps to `Manga.sourceId`). */
  sourceId?: string | null;
  /** Provider name for the metadata identity (e.g. "anilist", "mangadex"). */
  metadataSource?: string | null;
  /** Provider's canonical id for the metadata identity. */
  metadataSourceId?: string | null;
}

/** Build the ordered list of candidate `where` filters for this identity. */
function buildIdentityWhereClauses(identity: MangaIdentityInput): Prisma.MangaWhereInput[] {
  const clauses: Prisma.MangaWhereInput[] = [];

  // 1. Strongest: provider identity recorded on the linked Metadata row.
  if (identity.metadataSource && identity.metadataSourceId) {
    const metadataFilter: Prisma.MetadataWhereInput = {
      source: identity.metadataSource,
      sourceId: identity.metadataSourceId,
    };
    clauses.push({ Metadata: metadataFilter });
  }

  // 2. External id captured directly on the Manga row at add time.
  if (identity.sourceId) {
    clauses.push({ sourceId: identity.sourceId });
  }

  // 3. Case-insensitive title match (title is globally @unique).
  clauses.push({ title: { equals: identity.title, mode: 'insensitive' } });

  return clauses;
}

/**
 * Find an existing shared `Manga` that represents the same title, or `null`.
 */
export async function resolveExistingManga(
  prisma: PrismaClient,
  identity: MangaIdentityInput,
): Promise<Manga | null> {
  const clauses = buildIdentityWhereClauses(identity);

  for (const where of clauses) {
    // eslint-disable-next-line no-await-in-loop -- ordered priority lookup; stop at first hit
    const match = await prisma.manga.findFirst({ where });
    if (match) return match;
  }

  return null;
}
