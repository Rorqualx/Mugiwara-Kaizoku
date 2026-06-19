/**
 * Per-User Library Access Helpers
 *
 * The manga catalog is a single shared, deduplicated content layer; a title is
 * "in a user's library" iff a `LibraryMembership(userId, mangaId)` row exists.
 * These helpers centralise that membership check so every read site filters the
 * shared catalog down to the caller's library consistently.
 *
 * @module server/trpc/routers/_shared/library-access
 */
import { TRPCError } from '@trpc/server';

import { isObject, hasProperty } from '@/utils/type-guards';

import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Safely extract the authenticated user id from a protected-procedure context.
 *
 * `protectedProcedure` guarantees a session user at runtime, but the default
 * NextAuth `Session['user']` type does not surface `id`, so we read defensively
 * (mirroring `reader/utils.ts:getUserId`) and throw `UNAUTHORIZED` if absent.
 */
export function requireUserId(ctx: unknown): string {
  if (isObject(ctx) && hasProperty(ctx, 'user')) {
    const user = ctx['user'];
    if (isObject(user) && hasProperty(user, 'id')) {
      const id = user['id'];
      if (typeof id === 'string') return id;
      if (typeof id === 'number') return String(id);
    }
  }
  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'You must be logged in to access your library.',
  });
}

/**
 * Prisma `where` fragment limiting `Manga` to titles in the given user's library.
 * Compose into existing filters: `where: { ...membershipWhere(userId), ...rest }`.
 */
export function membershipWhere(userId: string): Prisma.MangaWhereInput {
  return { LibraryMembership: { some: { userId } } };
}

/** True if the user has the given manga in their library. */
export async function hasMembership(
  prisma: PrismaClient,
  userId: string,
  mangaId: number,
): Promise<boolean> {
  const row = await prisma.libraryMembership.findUnique({
    where: { userId_mangaId: { userId, mangaId } },
    select: { id: true },
  });
  return row !== null;
}

/** Throws `FORBIDDEN` unless the user has the given manga in their library. */
export async function assertMembership(
  prisma: PrismaClient,
  userId: string,
  mangaId: number,
): Promise<void> {
  if (!(await hasMembership(prisma, userId, mangaId))) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This title is not in your library.',
    });
  }
}

/**
 * All manga ids in a user's library. Useful for scoping endpoints/services that
 * filter by an explicit `mangaIds` allow-list (e.g. the calendar) rather than a
 * relational `where`. An empty result means "the user's library is empty".
 */
export async function getUserLibraryMangaIds(
  prisma: PrismaClient,
  userId: string,
): Promise<number[]> {
  const rows = await prisma.libraryMembership.findMany({
    where: { userId },
    select: { mangaId: true },
  });
  return rows.map((r) => r.mangaId);
}

/**
 * Restrict a set of manga ids to those in the caller's library, so a bulk
 * action can never touch titles the user doesn't own. Order is preserved.
 */
export async function filterMangaIdsToLibrary(
  prisma: PrismaClient,
  userId: string,
  mangaIds: number[],
): Promise<number[]> {
  if (mangaIds.length === 0) return [];
  const rows = await prisma.libraryMembership.findMany({
    where: { userId, mangaId: { in: mangaIds } },
    select: { mangaId: true },
  });
  const allowed = new Set(rows.map((r) => r.mangaId));
  return mangaIds.filter((id) => allowed.has(id));
}

/** Idempotently add a manga to a user's library. */
export async function addMembership(
  prisma: PrismaClient,
  userId: string,
  mangaId: number,
): Promise<void> {
  await prisma.libraryMembership.upsert({
    where: { userId_mangaId: { userId, mangaId } },
    create: { userId, mangaId },
    update: {},
  });
}

/**
 * Remove a manga from a user's library and report whether any members remain.
 * Callers use `remainingMembers === 0` to decide whether to physically delete
 * the shared `Manga` row and its files (reference-counted removal).
 */
export async function removeMembership(
  prisma: PrismaClient,
  userId: string,
  mangaId: number,
): Promise<{ remainingMembers: number }> {
  await prisma.libraryMembership.deleteMany({ where: { userId, mangaId } });
  const remainingMembers = await prisma.libraryMembership.count({ where: { mangaId } });
  return { remainingMembers };
}
