/**
 * runMetadataRefresh: the sequence shared by the single-title mutation and the
 * queued bulk refresh. The pipeline, the binding clear and the phantom sweep
 * are mocked; what is tested is the order, the arguments and the progress.
 *
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type Progress = (phase: string, message: string) => Promise<void>;
type RunPipeline = (
  mangaId: number,
  title: string,
  onProgress: Progress,
  options: { forceRefresh: boolean; previousAniListId: string | null },
) => Promise<{ manga: unknown }>;
type ClearBindings = (db: unknown, mangaId: number) => Promise<{ providersCleared: string[]; providersPreserved: string[] }>;
type RemovePhantoms = (mangaId: number) => Promise<{ outOfRangeVolumes: number; chapters: number; emptyVolumes: number }>;
type EmitProgress = (event: Record<string, unknown>) => Promise<void>;

const calls: string[] = [];
const mockRunEnrichmentPipeline = jest.fn<RunPipeline>();
const mockClearAutoBindings = jest.fn<ClearBindings>();
const mockRemovePhantomArtifacts = jest.fn<RemovePhantoms>();
const mockEmitProgress = jest.fn<EmitProgress>();

jest.mock('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline', () => ({
  runEnrichmentPipeline: (...args: Parameters<RunPipeline>) => mockRunEnrichmentPipeline(...args),
}));
jest.mock('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch', () => ({
  extractBoundAniListId: (providerMetadata: unknown): string | null => {
    const anilist = (providerMetadata as { anilist?: { providerId?: string } } | null)?.anilist;
    return anilist?.providerId ?? null;
  },
}));
jest.mock('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-phantom-prune', () => ({
  removePhantomArtifacts: (...args: Parameters<RemovePhantoms>) => mockRemovePhantomArtifacts(...args),
}));
jest.mock('@/server/trpc/routers/manga/metadataOperations/refresh/clear-auto-bindings', () => ({
  clearAutoBindingsForReidentify: (...args: Parameters<ClearBindings>) => mockClearAutoBindings(...args),
}));
jest.mock('@/server/services/realtime/RealtimeEventEmitter', () => ({
  realtimeEmitter: { emitMetadataRefreshProgress: (...args: Parameters<EmitProgress>) => mockEmitProgress(...args) },
}));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { runMetadataRefresh } from '@/server/trpc/routers/manga/metadataOperations/refresh/run-refresh';

type Db = Parameters<typeof runMetadataRefresh>[0];
const db = {} as Db;
const manga = { id: 7, title: 'Akira', providerMetadata: { anilist: { providerId: '30002' } } };
const fresh = { id: 7, title: 'Akira' };

beforeEach(() => {
  calls.length = 0;
  mockClearAutoBindings.mockReset().mockImplementation(async () => {
    calls.push('clear-bindings');
    return { providersCleared: ['comicvine'], providersPreserved: ['anilist'] };
  });
  mockRunEnrichmentPipeline.mockReset().mockImplementation(async () => {
    calls.push('pipeline');
    return { manga: fresh };
  });
  mockRemovePhantomArtifacts.mockReset().mockImplementation(async () => {
    calls.push('phantom-sweep');
    return { outOfRangeVolumes: 0, chapters: 0, emptyVolumes: 0 };
  });
  mockEmitProgress.mockReset().mockResolvedValue(undefined);
});

describe('runMetadataRefresh', () => {
  // A bulk refresh must not re-identify the library: bindings are cleared only
  // when the caller asks for it.
  it('keeps every binding on a plain refresh: pipeline, then phantom sweep', async () => {
    const outcome = await runMetadataRefresh(db, manga, false);

    expect(mockClearAutoBindings).not.toHaveBeenCalled();
    expect(calls).toEqual(['pipeline', 'phantom-sweep']);
    expect(mockRunEnrichmentPipeline).toHaveBeenCalledWith(
      7, 'Akira', expect.any(Function), { forceRefresh: false, previousAniListId: '30002' },
    );
    expect(mockRemovePhantomArtifacts).toHaveBeenCalledWith(7);
    expect(outcome).toEqual({ manga: fresh, removedPhantoms: 0 });
  });

  it('clears automatic bindings before the pipeline on a re-identify, and passes on the AniList id read before the clear', async () => {
    await runMetadataRefresh(db, manga, true);

    expect(calls).toEqual(['clear-bindings', 'pipeline', 'phantom-sweep']);
    expect(mockClearAutoBindings).toHaveBeenCalledWith(db, 7);
    expect(mockRunEnrichmentPipeline.mock.calls[0]?.[3]).toEqual({ forceRefresh: true, previousAniListId: '30002' });
  });

  it('passes no previous AniList id for a title that was never bound', async () => {
    await runMetadataRefresh(db, { id: 7, title: 'Akira', providerMetadata: null }, true);
    expect(mockRunEnrichmentPipeline.mock.calls[0]?.[3]).toEqual({ forceRefresh: true, previousAniListId: null });
  });

  it('adds up the phantom volumes and chapters it removed', async () => {
    mockRemovePhantomArtifacts.mockResolvedValueOnce({ outOfRangeVolumes: 1, chapters: 3, emptyVolumes: 2 });
    expect((await runMetadataRefresh(db, manga, false)).removedPhantoms).toBe(6);
  });

  it('announces the start, then maps pipeline phases onto the progress bar and ignores phases it does not know', async () => {
    mockRunEnrichmentPipeline.mockImplementationOnce(async (_id, _title, onProgress) => {
      await onProgress('fetching', 'Fetching providers');
      await onProgress('not-a-phase', 'ignored');
      await onProgress('finalizing', 'Rebuilding chapters');
      return { manga: fresh };
    });

    await runMetadataRefresh(db, manga, false);

    expect(mockEmitProgress.mock.calls.map(([event]) => [event['phase'], event['phaseIndex'], event['message']])).toEqual([
      ['starting', 0, 'Starting metadata refresh...'],
      ['fetching_providers', 1, 'Fetching providers'],
      ['rebuilding_chapters', 9, 'Rebuilding chapters'],
    ]);
    expect(mockEmitProgress.mock.calls.every(([event]) => event['mangaId'] === 7 && event['totalPhases'] === 10)).toBe(true);
  });

  // The queue handler relies on this to report the error and still hand the chain on.
  it('lets a pipeline failure through and does not run the phantom sweep after it', async () => {
    mockRunEnrichmentPipeline.mockRejectedValueOnce(new Error('AniList unreachable'));
    await expect(runMetadataRefresh(db, manga, false)).rejects.toThrow('AniList unreachable');
    expect(mockRemovePhantomArtifacts).not.toHaveBeenCalled();
  });
});
