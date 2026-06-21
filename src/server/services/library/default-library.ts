/**
 * Default Library Provisioning
 *
 * Every user gets a standard default library named "My Manga". This is the
 * single source of truth for that behaviour — called when a user account is
 * created (admin-create + first-run setup) and by the `library.ensureDefault`
 * tRPC procedure. Idempotent: if the user already owns a library, the first one
 * is returned untouched (no duplicate, no rename of an existing library).
 *
 * @module server/services/library/default-library
 */
import fs from 'fs/promises';
import path from 'path';


import { prisma as defaultPrisma } from '@/server/db';
import { ensureDirectoriesExist } from '@/utils/defaultPaths';
import { logger } from '@/utils/logger';

import type { Library, PrismaClient } from '@prisma/client';

/** The standard default library name created for every user. */
export const DEFAULT_LIBRARY_NAME = 'My Manga';

/**
 * Resolve (and create on disk) the per-user library directory for a given name.
 * Mirrors `createLibraryDirectory` in the library router so auto-provisioned and
 * user-created libraries share the same `data/libraries/<owner>/<name>` layout.
 */
async function resolveLibraryDir(name: string, ownerId: string): Promise<string> {
  const librariesDir = path.join(path.resolve(process.cwd(), 'data'), 'libraries');
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9]+/g, '-');
  const resolvedPath = path.join(librariesDir, safeOwner, safeName);
  await ensureDirectoriesExist();
  await fs.mkdir(resolvedPath, { recursive: true });
  return path.resolve(resolvedPath);
}

/**
 * Find-or-create the user's default "My Manga" library. Returns the existing
 * first library if the user already has one (so it's safe to call on every
 * login/creation). Pass a transaction client to run inside one.
 */
export async function ensureDefaultLibrary(
  userId: string,
  client: PrismaClient = defaultPrisma,
): Promise<Library> {
  const existing = await client.library.findFirst({
    where: { ownerId: userId },
    orderBy: { id: 'asc' },
  });
  if (existing) return existing;

  const absolutePath = await resolveLibraryDir(DEFAULT_LIBRARY_NAME, userId);
  // Guard the race where two calls both miss the findFirst above.
  const raced = await client.library.findFirst({ where: { path: absolutePath, ownerId: userId } });
  if (raced) return raced;

  const library = await client.library.create({
    data: { name: DEFAULT_LIBRARY_NAME, path: absolutePath, ownerId: userId },
  });
  logger.info(`[library] auto-created default "${DEFAULT_LIBRARY_NAME}" library for user ${userId}`);
  return library;
}
