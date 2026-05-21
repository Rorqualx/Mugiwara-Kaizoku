/**
 * Manga.create guard.
 *
 * Wraps `prisma.manga.create` with a TypeScript-required `libraryPath`
 * field, so the compiler rejects any callsite that tries to create a
 * Manga row without specifying where it lives on disk. Closes the gap
 * that left 44 ACTIVE manga with `libraryPath = NULL` (which in turn
 * disabled the cross-binding guard on them).
 *
 * Runtime also rejects empty / whitespace-only libraryPath, so
 * `libraryPath: ''` cannot sneak past the type check.
 *
 * @module server/services/library/manga-create-guard
 */

import type { Manga, Prisma, PrismaClient } from '@prisma/client';

type AnyPrisma = PrismaClient | Omit<PrismaClient, '$on' | '$use' | '$transaction' | '$extends' | '$disconnect' | '$connect'>;

/**
 * Like `Prisma.MangaCreateArgs` but with `data.libraryPath` required
 * (cannot be null/undefined) and forced to a non-empty string at
 * compile time.
 *
 * Accepts both the relational `MangaCreateInput` form (Library.connect)
 * and the unchecked `MangaUncheckedCreateInput` form (raw libraryId fk),
 * which mirrors what Prisma itself accepts. Either way, `libraryPath`
 * must be a string.
 */
type RequireLibraryPath<T> = Omit<T, 'libraryPath'> & { libraryPath: string };
export type MangaCreateArgsRequiringLibraryPath = Omit<Prisma.MangaCreateArgs, 'data'> & {
  data: RequireLibraryPath<Prisma.MangaCreateInput> | RequireLibraryPath<Prisma.MangaUncheckedCreateInput>;
};

/**
 * Create a Manga row, enforcing that `libraryPath` is supplied. Throws
 * if the path is empty / whitespace.
 *
 * Use this in every place that creates a Manga (manual import,
 * pack-import, scanner first-touch, ComicVine binding, etc.).
 */
export async function createMangaSafe<T extends MangaCreateArgsRequiringLibraryPath>(
  prismaClient: AnyPrisma,
  args: T,
): Promise<Manga> {
  const lp = args.data.libraryPath;
  if (typeof lp !== 'string' || lp.trim().length === 0) {
    throw new Error(`[MangaCreateGuard] libraryPath must be a non-empty string (got: ${JSON.stringify(lp)})`);
  }
  return prismaClient.manga.create(args as Prisma.MangaCreateArgs);
}
