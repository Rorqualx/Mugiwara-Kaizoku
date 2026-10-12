import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import {
  clearStaleKcefProfileLock,
  isKcefLockOwnerAlive,
  kcefProfileDir,
} from '@/server/services/suwayomi/kcef-profile-lock';

describe('Suwayomi embedded-browser profile lock', () => {
  let root: string;
  let profile: string;

  async function writeLock(target: string): Promise<void> {
    await fs.symlink(target, path.join(profile, 'SingletonLock'));
    await fs.symlink('/tmp/org.chromium.Chromium.gone/SingletonSocket', path.join(profile, 'SingletonSocket'));
    await fs.symlink('63586126270248166', path.join(profile, 'SingletonCookie'));
  }

  async function remaining(): Promise<string[]> {
    return (await fs.readdir(profile)).filter((name) => name.startsWith('Singleton')).sort();
  }

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kcef-lock-'));
    profile = kcefProfileDir(root);
    await fs.mkdir(profile, { recursive: true });
    await fs.writeFile(path.join(profile, 'Preferences'), '{}');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('clears a lock left by another host (a previous container)', async () => {
    await writeLock('8c857607c8c9-313');

    expect(await clearStaleKcefProfileLock(root)).toBe(true);
    expect(await remaining()).toEqual([]);
    // The profile itself is kept.
    await expect(fs.readFile(path.join(profile, 'Preferences'), 'utf8')).resolves.toBe('{}');
  });

  it('clears a lock whose process no longer exists on this host', async () => {
    await writeLock(`${os.hostname()}-2147483646`);

    expect(await clearStaleKcefProfileLock(root)).toBe(true);
    expect(await remaining()).toEqual([]);
  });

  it('leaves a lock held by a live process on this host', async () => {
    await writeLock(`${os.hostname()}-${process.pid}`);

    expect(await clearStaleKcefProfileLock(root)).toBe(false);
    expect(await remaining()).toEqual(['SingletonCookie', 'SingletonLock', 'SingletonSocket']);
  });

  it('does nothing when there is no lock or no profile yet', async () => {
    expect(await clearStaleKcefProfileLock(root)).toBe(false);
    expect(await clearStaleKcefProfileLock(path.join(root, 'missing'))).toBe(false);
  });

  it('reads the owner from the last dash, since hostnames contain dashes', () => {
    expect(isKcefLockOwnerAlive(`my-host-${process.pid}`, 'my-host')).toBe(true);
    expect(isKcefLockOwnerAlive(`my-host-${process.pid}`, 'other-host')).toBe(false);
    expect(isKcefLockOwnerAlive('garbage', 'my-host')).toBe(false);
  });
});
