import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import type { PrismaClient } from '@prisma/client';

const getMappings = jest.fn<() => { localPath: string; remotePath: string }[]>();

jest.mock('@/server/services/download/pathMapper', () => ({
  getPathMapper: () => ({ getMappings }),
}));

import { assertServerPathAllowed, isServerPathAllowed } from '@/server/trpc/routers/_shared/server-path-access';

describe('server path access', () => {
  let root: string;
  let library: string;
  let downloads: string;
  let elsewhere: string;
  const findMany = jest.fn<() => Promise<{ path: string }[]>>();
  const prisma = { library: { findMany } } as unknown as PrismaClient;
  const user = { user: { id: 'user-1', role: 'USER' } };
  const admin = { user: { id: 'admin-1', role: 'ADMIN' } };

  beforeAll(async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'path-access-')));
    library = path.join(root, 'libraries', 'user-1');
    downloads = path.join(root, 'downloads');
    elsewhere = path.join(root, 'elsewhere');
    await fs.mkdir(path.join(library, 'Series'), { recursive: true });
    await fs.mkdir(downloads, { recursive: true });
    await fs.mkdir(elsewhere, { recursive: true });
    await fs.writeFile(path.join(elsewhere, 'secret.cbz'), 'x');
    await fs.symlink(elsewhere, path.join(library, 'link-out'));

    findMany.mockResolvedValue([{ path: library }]);
    getMappings.mockReturnValue([{ localPath: downloads, remotePath: '/remote/completed' }]);
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('lets an admin name any path', async () => {
    expect(await isServerPathAllowed(admin, prisma, path.join(elsewhere, 'secret.cbz'))).toBe(true);
  });

  it('lets a user name paths inside their library and the download folders', async () => {
    expect(await isServerPathAllowed(user, prisma, library)).toBe(true);
    expect(await isServerPathAllowed(user, prisma, path.join(library, 'Series', 'not-created-yet', 'c001.cbz'))).toBe(true);
    expect(await isServerPathAllowed(user, prisma, path.join(downloads, 'pack', 'v01.cbz'))).toBe(true);
  });

  it('refuses paths outside those folders', async () => {
    expect(await isServerPathAllowed(user, prisma, path.join(elsewhere, 'secret.cbz'))).toBe(false);
    expect(await isServerPathAllowed(user, prisma, '/etc/passwd')).toBe(false);
    expect(await isServerPathAllowed(user, prisma, 'relative/path')).toBe(false);
  });

  it('refuses a sibling folder that only shares the name prefix', async () => {
    expect(await isServerPathAllowed(user, prisma, `${library}-other/file.cbz`)).toBe(false);
  });

  it('refuses dot-dot and symlink escapes from an allowed folder', async () => {
    expect(await isServerPathAllowed(user, prisma, path.join(library, '..', '..', 'elsewhere', 'secret.cbz'))).toBe(false);
    expect(await isServerPathAllowed(user, prisma, path.join(library, 'link-out', 'secret.cbz'))).toBe(false);
  });

  it('only looks at the caller\'s own libraries', async () => {
    await isServerPathAllowed(user, prisma, library);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { ownerId: 'user-1' } }));
  });

  it('assertServerPathAllowed throws FORBIDDEN for a refused path', async () => {
    await expect(assertServerPathAllowed(user, prisma, '/etc/passwd')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(assertServerPathAllowed(user, prisma, library)).resolves.toBeUndefined();
  });
});
