/**
 * @jest-environment node
 *
 * createChaptersFromFiles duplicate-import tests.
 *
 * Regression tests for the log-flood incident: the PACK importer created one
 * Chapter row per file with no dedup lookup, so re-importing a pack hammered
 * Postgres with unique-violation errors on the partial unique index
 * `Chapter_mangaId_chapterNumber_unique`. The fake prisma below enforces that
 * index exactly like Postgres (throwing unless `skipDuplicates` is set) so a
 * regression back to bare `create()` fails these tests.
 *
 * Also covers the file-copy ordering fix: the library copy must happen AFTER
 * a successful row create, so duplicates/failures never orphan files.
 */

import * as fsSync from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('@/server/services/config/globalConfigService', () => ({
  getGlobalConfigService: jest.fn(() => ({
    get: jest.fn(async () => undefined),
  })),
}));

jest.mock('@/server/services/fileOrganization/configService', () => ({
  getFileOrganizationConfigService: jest.fn(() => ({
    loadConfig: jest.fn(async () => ({
      folderStructure: 'byTitle',
      customFolderTemplate: '',
      fileNamingTemplate: '',
      createMetadataFiles: false,
      fileMode: 'copy',
      organizeOnImport: false,
    })),
  })),
}));

jest.mock('@/server/services/conversion', () => ({
  getConversionService: jest.fn(() => ({
    createConversionJob: jest.fn(),
  })),
  ConverterFactory: { isConversionSupported: jest.fn(() => false) },
}));

import { createChaptersFromFiles } from '@/server/services/download/fileImporter/chapter-processing';

import type { PrismaClient } from '@prisma/client';

interface FakeChapterRow {
  id: number;
  mangaId: number;
  index: number;
  title: string;
  chapterNumber: number | null;
  filePath: string | null;
  fileName: string;
}

interface CreateManyArgs {
  data: Array<Omit<FakeChapterRow, 'id'>>;
  skipDuplicates?: boolean;
}

/**
 * In-memory Chapter table that enforces the same unique constraints as the
 * real Postgres schema: the partial unique `(mangaId, chapterNumber) WHERE
 * chapterNumber IS NOT NULL` and `(mangaId, index)`. An insert that violates
 * a constraint WITHOUT skipDuplicates throws (and is counted) — exactly the
 * behavior that flooded the server log.
 */
class FakeChapterDb {
  rows: FakeChapterRow[] = [];
  nextId = 1;
  constraintErrors = 0;
  createManyCalls = 0;
  deleteManyCalls = 0;
  /** Simulates a concurrent writer: rows exist but the pre-load can't see them. */
  hideRowsFromFindMany = false;

  private violates(data: Omit<FakeChapterRow, 'id'>): boolean {
    return this.rows.some((r) =>
      (data.chapterNumber !== null
        && r.mangaId === data.mangaId
        && r.chapterNumber === data.chapterNumber)
      || (r.mangaId === data.mangaId && r.index === data.index)
    );
  }

  asPrisma(): PrismaClient {
    const db = this;
    const client = {
      manga: {
        findUnique: async (): Promise<{ title: string }> => ({ title: 'Test Manga' }),
      },
      chapter: {
        findFirst: async (): Promise<{ index: number } | null> => {
          if (db.rows.length === 0) return null;
          const maxIndex = Math.max(...db.rows.map((r) => r.index));
          return { index: maxIndex };
        },
        findMany: async (args: {
          where: { mangaId: number; chapterNumber?: { not: null } };
        }): Promise<Array<{ chapterNumber: number | null }>> => {
          if (db.hideRowsFromFindMany) return [];
          return db.rows
            .filter((r) => r.mangaId === args.where.mangaId && r.chapterNumber !== null)
            .map((r) => ({ chapterNumber: r.chapterNumber }));
        },
        createMany: async (args: CreateManyArgs): Promise<{ count: number }> => {
          db.createManyCalls++;
          let count = 0;
          for (const data of args.data) {
            if (db.violates(data)) {
              if (args.skipDuplicates === true) continue;
              db.constraintErrors++;
              throw new Error(
                'duplicate key value violates unique constraint "Chapter_mangaId_chapterNumber_unique"'
              );
            }
            db.rows.push({ ...data, id: db.nextId++ });
            count++;
          }
          return { count };
        },
        findUnique: async (args: {
          where: { mangaId_index: { mangaId: number; index: number } };
        }): Promise<{ id: number } | null> => {
          const { mangaId, index } = args.where.mangaId_index;
          const row = db.rows.find((r) => r.mangaId === mangaId && r.index === index);
          return row ? { id: row.id } : null;
        },
        deleteMany: async (args: { where: { id: number } }): Promise<{ count: number }> => {
          db.deleteManyCalls++;
          const before = db.rows.length;
          db.rows = db.rows.filter((r) => r.id !== args.where.id);
          return { count: before - db.rows.length };
        },
      },
    };
    return client as unknown as PrismaClient;
  }
}

let tmpRoot: string;
let sourceDir: string;
let destDir: string;

function makeSourceFile(name: string): string {
  const filePath = path.join(sourceDir, name);
  fsSync.writeFileSync(filePath, 'PK\x03\x04dummy-cbz-payload');
  return filePath;
}

function listLibraryFiles(): string[] {
  const chaptersDir = path.join(destDir, 'Chapters');
  if (!fsSync.existsSync(chaptersDir)) return [];
  return fsSync.readdirSync(chaptersDir).sort();
}

beforeEach(() => {
  tmpRoot = fsSync.mkdtempSync(path.join(os.tmpdir(), 'pack-import-'));
  sourceDir = path.join(tmpRoot, 'source');
  destDir = path.join(tmpRoot, 'library', 'Test Manga');
  fsSync.mkdirSync(sourceDir, { recursive: true });
  fsSync.mkdirSync(destDir, { recursive: true });
});

afterEach(() => {
  // Restore permissions in case a test made a directory read-only
  const chaptersDir = path.join(destDir, 'Chapters');
  if (fsSync.existsSync(chaptersDir)) fsSync.chmodSync(chaptersDir, 0o755);
  fsSync.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('createChaptersFromFiles duplicate handling', () => {
  it('importing the same pack twice produces zero constraint errors and no duplicate rows', async () => {
    const db = new FakeChapterDb();
    const files = [
      makeSourceFile('Test Manga - Chapter 001.cbz'),
      makeSourceFile('Test Manga - Chapter 002.cbz'),
    ];

    const firstRun = await createChaptersFromFiles(files, 1, destDir, db.asPrisma());
    expect(firstRun).toHaveLength(2);
    expect(db.rows).toHaveLength(2);
    expect(db.constraintErrors).toBe(0);
    expect(listLibraryFiles()).toHaveLength(2);
    const createManyCallsAfterFirstRun = db.createManyCalls;

    // Re-import the exact same pack — the incident scenario.
    const secondRun = await createChaptersFromFiles(files, 1, destDir, db.asPrisma());
    expect(secondRun).toHaveLength(0);
    expect(db.rows).toHaveLength(2);
    // ZERO constraint errors reached the DB layer.
    expect(db.constraintErrors).toBe(0);
    // Duplicates are skipped before any insert is attempted.
    expect(db.createManyCalls).toBe(createManyCallsAfterFirstRun);
    // No orphaned/overwritten files: library contents unchanged.
    expect(listLibraryFiles()).toHaveLength(2);
  });

  it('skips duplicate chapter numbers within a single pack without DB errors', async () => {
    const db = new FakeChapterDb();
    const files = [
      makeSourceFile('Test Manga - Chapter 003.cbz'),
      makeSourceFile('Test Manga - Chapter 003 (alt scan).cbz'),
    ];

    const created = await createChaptersFromFiles(files, 1, destDir, db.asPrisma());
    expect(created).toHaveLength(1);
    expect(db.rows).toHaveLength(1);
    expect(db.constraintErrors).toBe(0);
    expect(listLibraryFiles()).toHaveLength(1);
  });

  it('handles a lookup/insert race via conflict-safe insert (no error, no orphaned file)', async () => {
    const db = new FakeChapterDb();
    // A concurrent writer inserted these rows AFTER our pre-load would run:
    // rows exist for the constraint check, but findMany can't see them.
    db.rows.push({
      id: db.nextId++, mangaId: 1, index: 500, title: 'Chapter 1',
      chapterNumber: 1, filePath: '/elsewhere/c001.cbz', fileName: 'c001.cbz',
    });
    db.hideRowsFromFindMany = true;

    const files = [makeSourceFile('Test Manga - Chapter 001.cbz')];
    const created = await createChaptersFromFiles(files, 1, destDir, db.asPrisma());

    expect(created).toHaveLength(0);
    // The insert was attempted but skipped silently — never an error.
    expect(db.constraintErrors).toBe(0);
    expect(db.rows).toHaveLength(1);
    // The library copy happens only after a successful row create,
    // so the losing writer leaves no orphaned file behind.
    expect(listLibraryFiles()).toHaveLength(0);
  });

  it('rolls back the chapter row when the library copy fails', async () => {
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      return; // chmod-based read-only dirs don't block root
    }
    const db = new FakeChapterDb();
    const chaptersDir = path.join(destDir, 'Chapters');
    fsSync.mkdirSync(chaptersDir, { recursive: true });
    fsSync.chmodSync(chaptersDir, 0o555); // copyFile will fail with EACCES

    const files = [makeSourceFile('Test Manga - Chapter 001.cbz')];
    const created = await createChaptersFromFiles(files, 1, destDir, db.asPrisma());

    expect(created).toHaveLength(0);
    // Row was created then rolled back — no COMPLETED chapter without a file.
    expect(db.deleteManyCalls).toBe(1);
    expect(db.rows).toHaveLength(0);
    expect(db.constraintErrors).toBe(0);
  });
});
