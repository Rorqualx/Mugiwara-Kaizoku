/**
 * Which server paths a caller may name in a request.
 *
 * Several procedures take a filesystem path from the client (probe a path,
 * import from a path, point a title at a folder). Admins manage the server
 * and may name any path. Everyone else is limited to the folders the app
 * already works in on their behalf: their own libraries and the download
 * folders. Without this, any signed-in user could enumerate the server's
 * filesystem or import an arbitrary readable file into a title and read it.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { TRPCError } from '@trpc/server';

import { getPathMapper } from '@/server/services/download/pathMapper';

import { isAdmin, requireUserId } from './library-access';

import type { PrismaClient } from '@prisma/client';

/**
 * Resolve symlinks in the part of `target` that exists, so a link inside an
 * allowed folder cannot lead out of it. The remainder (not created yet) is
 * appended unchanged.
 */
async function resolveExistingPrefix(target: string): Promise<string> {
  const absolute = path.resolve(target);
  const missing: string[] = [];
  let current = absolute;
  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop -- walks up one ancestor at a time until one exists
      const real = await fs.realpath(current);
      return missing.length > 0 ? path.join(real, ...missing.reverse()) : real;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return absolute;
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/** Folders a non-admin caller may name: their libraries and the download folders. */
async function allowedRootsFor(prisma: PrismaClient, userId: string): Promise<string[]> {
  const libraries = await prisma.library.findMany({
    where: { ownerId: userId },
    select: { path: true },
  });
  const roots = libraries.map((library) => library.path);

  for (const mapping of getPathMapper().getMappings()) {
    if (mapping.localPath) roots.push(mapping.localPath);
  }
  const downloadDir = process.env['DOWNLOAD_DIR'];
  if (downloadDir) roots.push(downloadDir);

  return Promise.all(roots.filter((root) => path.isAbsolute(root)).map(resolveExistingPrefix));
}

/** True if the caller may name `target`. Never throws for a disallowed path. */
export async function isServerPathAllowed(
  ctx: unknown,
  prisma: PrismaClient,
  target: string,
): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  if (!path.isAbsolute(target)) return false;
  const [resolved, roots] = await Promise.all([
    resolveExistingPrefix(target),
    allowedRootsFor(prisma, requireUserId(ctx)),
  ]);
  return roots.some((root) => isInside(root, resolved));
}

/** Throw `FORBIDDEN` unless the caller may name `target`. */
export async function assertServerPathAllowed(
  ctx: unknown,
  prisma: PrismaClient,
  target: string,
): Promise<void> {
  if (!(await isServerPathAllowed(ctx, prisma, target))) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'That path is outside your libraries and the download folders.',
    });
  }
}
