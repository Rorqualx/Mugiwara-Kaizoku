/** @jest-environment node */
/**
 * bindProvider / unbindProvider: what is written to the Manga row and to the
 * binding record. An unbind must leave the unbound sentinel so the next
 * enrichment does not re-bind the provider; AniList is the exception.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('superjson', () => ({
  __esModule: true,
  default: {
    serialize: (data: unknown) => ({ json: data, meta: undefined }),
    deserialize: (data: { json: unknown }) => data.json,
  },
}));
jest.mock('@/server/db', () => ({ prisma: {} }));
// The real protectedProcedure resolves a NextAuth session; auth is not under
// test here — membership is, and that helper is mocked below.
jest.mock('@/server/trpc/procedures', () => {
  const { procedure } = jest.requireActual<{ procedure: unknown }>('@/server/trpc/trpc');
  return { protectedProcedure: procedure };
});

const mockAssertMembership = jest.fn<(prisma: unknown, userId: string, mangaId: number) => Promise<void>>();
jest.mock('@/server/trpc/routers/_shared/library-access', () => ({
  assertMembership: mockAssertMembership,
  requireUserId: () => 'user-1',
}));

const mockRecord = {
  recordBinding: jest.fn<(input: Record<string, unknown>) => Promise<void>>(),
  recordRejection: jest.fn<(input: Record<string, unknown>) => Promise<void>>(),
  clearRejection: jest.fn<(mangaId: number, provider: string, providerId: string) => Promise<void>>(),
};
jest.mock('@/server/services/metadata/binding-record', () => mockRecord);

const mockEmit = jest.fn<(event: string, payload: unknown) => Promise<void>>();
jest.mock('@/server/services/eventEmitter', () => ({ eventEmitter: { emit: mockEmit } }));

const mockInvalidate = jest.fn<(mangaId: number) => Promise<void>>();
jest.mock('@/server/trpc/routers/manga/crud-operations/get-manga-cache', () => ({ invalidateMangaCache: mockInvalidate }));

import { isManuallyUnboundFromMetadata } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/manual-binding-sentinel';
import { readMangaDexPin } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/provider-pins';
import { bindingRouter } from '@/server/trpc/routers/manga/provider-operations/binding';

const MD_UUID = 'a1c7c817-4e59-43b7-9365-09675a149a6f';

interface MangaRow {
  id: number;
  title: string;
  source: string;
  selectedSourceId: string | null;
  providerMetadata: Record<string, unknown>;
  Metadata: null;
}

function makeCtx(manga: MangaRow | null): {
  ctx: { prisma: Record<string, unknown>; user: { id: string } };
  update: jest.Mock<(args: { where: { id: number }; data: Record<string, unknown> }) => Promise<unknown>>;
} {
  const update = jest.fn<(args: { where: { id: number }; data: Record<string, unknown> }) => Promise<unknown>>();
  update.mockResolvedValue({});
  const prisma = {
    manga: { findUnique: jest.fn(async () => manga), update },
    metadata: { update: jest.fn(async () => ({})) },
    volume: { findMany: jest.fn(async () => []), deleteMany: jest.fn(async () => ({ count: 0 })) },
    chapter: { updateMany: jest.fn(async () => ({ count: 0 })) },
  };
  return { ctx: { prisma, user: { id: 'user-1' } }, update };
}

function manga(providerMetadata: Record<string, unknown>, selectedSourceId: string | null = null): MangaRow {
  return { id: 37, title: 'Blood Lad', source: 'anilist', selectedSourceId, providerMetadata, Metadata: null };
}

function writtenProviderMetadata(update: ReturnType<typeof makeCtx>['update']): Record<string, unknown> {
  expect(update).toHaveBeenCalledTimes(1);
  return update.mock.calls[0]?.[0].data['providerMetadata'] as Record<string, unknown>;
}

// The mocked ctx is a slice of the real context; the router only reads prisma + user.
const call = (ctx: unknown): ReturnType<typeof bindingRouter.createCaller> => bindingRouter.createCaller(ctx as never);

describe('bindingRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssertMembership.mockResolvedValue(undefined);
  });

  describe('unbindProvider', () => {
    it.each(['mangadex', 'mangaupdates', 'kitsu', 'comicvine', 'fandom', 'wikipedia', 'mal'] as const)(
      'replaces the %s section with the unbound sentinel and rejects the old id',
      async (provider) => {
        const { ctx, update } = makeCtx(manga({
          [provider]: { providerId: 'old-id', boundAt: 'x', volumeCache: { volumes: [1] } },
          anilist: { providerId: '51614' },
        }));
        const result = await call(ctx).unbindProvider({ mangaId: 37, provider });

        const pm = writtenProviderMetadata(update);
        expect(pm[provider]).toEqual({ manual: true, providerId: null, intent: 'unbound', boundAt: expect.any(String) });
        expect(isManuallyUnboundFromMetadata(pm, provider)).toBe(true);
        expect(pm['anilist']).toEqual({ providerId: '51614' });
        // Only AniList owns the pin column.
        expect(update.mock.calls[0]?.[0].data).not.toHaveProperty('selectedSourceId');
        expect(mockRecord.recordRejection).toHaveBeenCalledWith({
          mangaId: 37, provider, providerId: 'old-id', reason: 'manual unbind',
        });
        expect(result.success).toBe(true);
        expect(mockInvalidate).toHaveBeenCalledWith(37);
      },
    );

    it('keeps the current AniList behaviour: section and pin removed, id rejected, no sentinel', async () => {
      const { ctx, update } = makeCtx(manga({ anilist: { providerId: '92948', manual: true } }, '92948'));
      await call(ctx).unbindProvider({ mangaId: 37, provider: 'anilist' });

      expect(writtenProviderMetadata(update)).not.toHaveProperty('anilist');
      expect(update.mock.calls[0]?.[0].data['selectedSourceId']).toBeNull();
      expect(mockRecord.recordRejection).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'anilist', providerId: '92948' }),
      );
    });

    it('writes the sentinel even when nothing was bound, and records no rejection', async () => {
      const { ctx, update } = makeCtx(manga({}));
      const result = await call(ctx).unbindProvider({ mangaId: 37, provider: 'mangadex' });

      expect(isManuallyUnboundFromMetadata(writtenProviderMetadata(update), 'mangadex')).toBe(true);
      expect(mockRecord.recordRejection).not.toHaveBeenCalled();
      expect(result.message).toBe('Manga is not bound to mangadex');
    });

    it('checks membership before reading the title', async () => {
      const { ctx } = makeCtx(manga({}));
      mockAssertMembership.mockRejectedValue(new Error('This title is not in your library.'));
      await expect(call(ctx).unbindProvider({ mangaId: 37, provider: 'mangadex' })).rejects.toThrow('not in your library');
      expect((ctx.prisma['manga'] as { findUnique: jest.Mock }).findUnique).not.toHaveBeenCalled();
    });
  });

  describe('bindProvider', () => {
    it('stores a manual pin the pipeline reads back, and records it', async () => {
      const { ctx, update } = makeCtx(manga({}));
      await call(ctx).bindProvider({ mangaId: 37, provider: 'mangadex', providerId: MD_UUID, fetchMetadata: false });

      const pm = writtenProviderMetadata(update);
      expect(pm['mangadex']).toEqual({ providerId: MD_UUID, manual: true, boundAt: expect.any(String) });
      expect(readMangaDexPin(pm)).toMatchObject({ kind: 'pinned', id: MD_UUID });
      expect(update.mock.calls[0]?.[0].data).not.toHaveProperty('selectedSourceId');
      expect(mockRecord.recordBinding).toHaveBeenCalledWith({ mangaId: 37, provider: 'mangadex', providerId: MD_UUID, origin: 'manual' });
      expect(mockRecord.clearRejection).toHaveBeenCalledWith(37, 'mangadex', MD_UUID);
    });

    it('replaces an unbound sentinel with the new manual pin', async () => {
      const { ctx, update } = makeCtx(manga({
        mangadex: { manual: true, providerId: null, intent: 'unbound', boundAt: 'x' },
      }));
      await call(ctx).bindProvider({ mangaId: 37, provider: 'mangadex', providerId: MD_UUID, fetchMetadata: false });

      const pm = writtenProviderMetadata(update);
      expect(isManuallyUnboundFromMetadata(pm, 'mangadex')).toBe(false);
      expect(pm['mangadex']).not.toHaveProperty('intent');
    });

    it('writes the AniList pin column only for an AniList bind', async () => {
      const { ctx, update } = makeCtx(manga({}));
      await call(ctx).bindProvider({ mangaId: 37, provider: 'anilist', providerId: '51614', fetchMetadata: false });
      expect(update.mock.calls[0]?.[0].data).toMatchObject({ selectedSourceId: '51614', sourceId: '51614' });
    });
  });
});
