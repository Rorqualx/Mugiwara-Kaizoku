/**
 * Binding-as-record service — integration test against the local Postgres.
 *
 * Exercises the real ProviderBinding table so the idempotency + supersededAt
 * filtering semantics are validated as actual SQL, not a mock. Uses a reserved
 * high mangaId and cleans up after itself.
 *
 * Runs under `bun test` (local Postgres). It is SKIPPED under Jest (the
 * pre-commit runner), which mocks `@/server/db` and has no ProviderBinding
 * model — see the jest-vs-bun runner split in project memory. The service logic
 * is thus covered by `bun test` here plus the live AoT end-to-end.
 */

import { prisma } from '@/server/db';
import {
  clearRejection,
  getRejectedIds,
  recordBinding,
  recordRejection,
} from '@/server/services/metadata/binding-record';

const TEST_MANGA_ID = 990_001;
const underJest = typeof process !== 'undefined' && Boolean(process.env['JEST_WORKER_ID']);
const suite = underJest ? describe.skip : describe;

async function wipe(): Promise<void> {
  await prisma.providerBinding.deleteMany({ where: { mangaId: TEST_MANGA_ID } });
}

suite('binding-record (bun/real-DB integration)', () => {
  beforeEach(wipe);
  afterAll(async () => {
    await wipe();
  });

  describe('rejections', () => {
    it('records a rejection and surfaces it via getRejectedIds', async () => {
      await recordRejection({ mangaId: TEST_MANGA_ID, provider: 'anilist', providerId: '85199', reason: 'test' });
      const rejected = await getRejectedIds(TEST_MANGA_ID, 'anilist');
      expect(rejected.has('85199')).toBe(true);
    });

    it('is idempotent — a repeated rejection does not create a second active row', async () => {
      await recordRejection({ mangaId: TEST_MANGA_ID, provider: 'anilist', providerId: '85199' });
      await recordRejection({ mangaId: TEST_MANGA_ID, provider: 'anilist', providerId: '85199' });
      const rows = await prisma.providerBinding.findMany({
        where: { mangaId: TEST_MANGA_ID, provider: 'anilist', origin: 'rejected', supersededAt: null },
      });
      expect(rows).toHaveLength(1);
    });

    it('clearRejection supersedes the row so the id drops out of getRejectedIds', async () => {
      await recordRejection({ mangaId: TEST_MANGA_ID, provider: 'anilist', providerId: '85199' });
      await clearRejection(TEST_MANGA_ID, 'anilist', '85199');
      const rejected = await getRejectedIds(TEST_MANGA_ID, 'anilist');
      expect(rejected.has('85199')).toBe(false);
      const superseded = await prisma.providerBinding.findFirst({
        where: { mangaId: TEST_MANGA_ID, provider: 'anilist', providerId: '85199', origin: 'rejected' },
      });
      expect(superseded?.supersededAt).not.toBeNull();
    });

    it('scopes rejections per (manga, provider)', async () => {
      await recordRejection({ mangaId: TEST_MANGA_ID, provider: 'anilist', providerId: '85199' });
      const otherProvider = await getRejectedIds(TEST_MANGA_ID, 'mangadex');
      expect(otherProvider.size).toBe(0);
    });
  });

  describe('bindings', () => {
    it('records manual/auto bindings without surfacing them as rejections', async () => {
      await recordBinding({ mangaId: TEST_MANGA_ID, provider: 'anilist', providerId: '53390', origin: 'auto', score: 1 });
      await recordBinding({ mangaId: TEST_MANGA_ID, provider: 'anilist', providerId: '53390', origin: 'manual' });
      const rejected = await getRejectedIds(TEST_MANGA_ID, 'anilist');
      expect(rejected.size).toBe(0);
      const rows = await prisma.providerBinding.findMany({
        where: { mangaId: TEST_MANGA_ID, provider: 'anilist' },
      });
      expect(rows).toHaveLength(2);
      expect(rows.some((r) => r.origin === 'auto' && r.score === 1)).toBe(true);
    });
  });
});
