/**
 * @jest-environment node
 *
 * cleanupVanishedFileChapters tests — uses hermetic tmp dirs + a
 * minimal mock prisma so we exercise the actual fs.access checks
 * (parent-dir gate) without spinning up a real DB.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { cleanupVanishedFileChapters } from '@/server/services/download/download-monitor/chapter-manager';

type GhostRow = { id: number; mangaId: number; filePath: string | null };
type UpdateCall = { id: number; data: Record<string, unknown> };

interface MockPrismaState {
  ghosts: GhostRow[];
  updates: UpdateCall[];
}

function mockPrisma(state: MockPrismaState): unknown {
  return {
    chapter: {
      findMany: async (_args: unknown) => state.ghosts,
      update: async (args: { where: { id: number }; data: Record<string, unknown> }) => {
        state.updates.push({ id: args.where.id, data: args.data });
        return { id: args.where.id };
      },
    },
  };
}

let tmpRoot: string;

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-vanished-'));
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('cleanupVanishedFileChapters', () => {
  it('downgrades when file is gone but parent dir exists', async () => {
    const parentDir = path.join(tmpRoot, 'pluto-v01');
    fs.mkdirSync(parentDir, { recursive: true });
    const filePath = path.join(parentDir, 'Pluto V01.cbz');
    // file deliberately NOT created — only parent

    const state: MockPrismaState = {
      ghosts: [{ id: 100, mangaId: 9, filePath }],
      updates: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock surface
    const result = await cleanupVanishedFileChapters(mockPrisma(state) as any, 50);

    expect(result.scanned).toBe(1);
    expect(result.downgraded).toBe(1);
    expect(result.mountOutages).toBe(0);
    expect(result.parentDirExists).toBe(1);

    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]?.id).toBe(100);
    expect(state.updates[0]?.data).toMatchObject({
      downloadStatus: 'PENDING',
      filePath: null,
      pageCount: null,
    });
  });

  it('skips (mountOutage) when parent dir is also missing', async () => {
    const filePath = path.join(tmpRoot, 'unmounted-share', 'volume', 'Pluto V01.cbz');
    // neither parent dir nor file exist

    const state: MockPrismaState = {
      ghosts: [{ id: 200, mangaId: 9, filePath }],
      updates: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock surface
    const result = await cleanupVanishedFileChapters(mockPrisma(state) as any, 50);

    expect(result.scanned).toBe(1);
    expect(result.downgraded).toBe(0);
    expect(result.mountOutages).toBe(1);
    expect(state.updates).toHaveLength(0);
  });

  it('skips entirely when file exists (healthy ghost — recount path handles it)', async () => {
    const parentDir = path.join(tmpRoot, 'healthy-vol');
    fs.mkdirSync(parentDir, { recursive: true });
    const filePath = path.join(parentDir, 'Pluto V02.cbz');
    fs.writeFileSync(filePath, 'PK\x03\x04dummy-cbz');

    const state: MockPrismaState = {
      ghosts: [{ id: 300, mangaId: 9, filePath }],
      updates: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock surface
    const result = await cleanupVanishedFileChapters(mockPrisma(state) as any, 50);

    expect(result.scanned).toBe(1);
    expect(result.downgraded).toBe(0);
    expect(result.mountOutages).toBe(0);
    expect(result.parentDirExists).toBe(0);
    expect(state.updates).toHaveLength(0);
  });

  it('processes a mixed batch with all three dispositions', async () => {
    const presentParent = path.join(tmpRoot, 'batch-parent');
    fs.mkdirSync(presentParent, { recursive: true });
    const existingFile = path.join(presentParent, 'existing.cbz');
    fs.writeFileSync(existingFile, 'x');

    const state: MockPrismaState = {
      ghosts: [
        { id: 1, mangaId: 9, filePath: path.join(presentParent, 'missing-1.cbz') },     // downgrade
        { id: 2, mangaId: 9, filePath: path.join(presentParent, 'missing-2.cbz') },     // downgrade
        { id: 3, mangaId: 9, filePath: path.join(tmpRoot, 'gone-dir', 'x.cbz') },        // mountOutage
        { id: 4, mangaId: 9, filePath: existingFile },                                   // skip
      ],
      updates: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock surface
    const result = await cleanupVanishedFileChapters(mockPrisma(state) as any, 50);

    expect(result.scanned).toBe(4);
    expect(result.downgraded).toBe(2);
    expect(result.mountOutages).toBe(1);
    expect(result.parentDirExists).toBe(2);
    expect(state.updates.map(u => u.id).sort()).toEqual([1, 2]);
  });

  it('returns zero-stats when no ghosts found', async () => {
    const state: MockPrismaState = { ghosts: [], updates: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock surface
    const result = await cleanupVanishedFileChapters(mockPrisma(state) as any, 50);
    expect(result).toEqual({
      scanned: 0, downgraded: 0, mountOutages: 0, parentDirExists: 0, errors: 0,
    });
  });

  it('handles null filePath rows gracefully (skipped, no crash)', async () => {
    const state: MockPrismaState = {
      ghosts: [{ id: 999, mangaId: 9, filePath: null }],
      updates: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock surface
    const result = await cleanupVanishedFileChapters(mockPrisma(state) as any, 50);
    expect(result.scanned).toBe(1);
    expect(result.downgraded).toBe(0);
    expect(state.updates).toHaveLength(0);
  });
});
