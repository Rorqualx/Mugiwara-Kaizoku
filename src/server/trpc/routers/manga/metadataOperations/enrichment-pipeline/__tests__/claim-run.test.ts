/**
 * @jest-environment node
 */
import { writeClaimRun } from '@/server/services/metadata/provider-claims/claim-store';
import type { ClaimRow, ClaimRunBatch } from '@/server/services/metadata/provider-claims/claim-types';
import { collectCandidates, type ProviderClaim } from '@/server/services/metadata/selectors/collect-candidates';
import { runShadowSelection } from '@/server/services/metadata/selectors/shadow-mode';

import { ClaimRun, withClaimRun } from '../claim-run/claim-run';

import { fandomSnapshot, snapshot } from './claim-test-fixtures';

import type { FetchPhaseSnapshot, ManifestProposal } from '../claim-run/recorder';

jest.mock('@/server/services/metadata/provider-claims/claim-store', () => ({
  writeClaimRun: jest.fn(),
}));

const mockedWrite = jest.mocked(writeClaimRun);

function proposal(source: string, volumeNumber: number, chapterStart: number, chapterEnd: number): ManifestProposal {
  return { source, volumeNumber, chapterStart, chapterEnd, extractionMethod: 'explicit-range' };
}

function noteSelection(run: ClaimRun, claims: ProviderClaim[]): void {
  run.noteSelection(claims, runShadowSelection(collectCandidates(claims)));
}

function row(rows: ClaimRow[], provider: string, field: string): ClaimRow | undefined {
  return rows.find(r => r.provider === provider && r.field === field);
}

function lastBatch(): ClaimRunBatch {
  const call = mockedWrite.mock.calls[mockedWrite.mock.calls.length - 1];
  if (!call) throw new Error('writeClaimRun was not called');
  return call[0];
}

beforeEach(() => {
  mockedWrite.mockReset();
  mockedWrite.mockResolvedValue(0);
});

describe('ClaimRun — one recorder per run', () => {
  it('gives every run its own id and keeps one run\'s notes out of another\'s rows', () => {
    const first = new ClaimRun(73);
    const second = new ClaimRun(73);
    first.noteFetchPhase(snapshot());

    expect(first.runId).not.toBe(second.runId);
    expect(first.buildRows().length).toBeGreaterThan(0);
    expect(second.buildRows()).toEqual([]);
  });

  it('stamps each scalar claim with its provider\'s fetch outcome and record id', () => {
    const run = new ClaimRun(73);
    noteSelection(run, [{ provider: 'anilist', matchConfidence: 0.9, fields: { chapters: 706 } }]);
    run.noteFetchPhase(snapshot());

    const claim = row(run.buildRows(), 'anilist', 'chapters');
    expect(claim).toMatchObject({ kind: 'scalar', value: 706, fetchOutcome: 'ok', providerRecordId: '30012', selectorOutcome: 'winner' });
  });

  it('writes one fetch row per provider the phase reported on', () => {
    const run = new ClaimRun(73);
    run.noteFetchPhase(snapshot());
    const fetchRows = run.buildRows().filter(r => r.kind === 'fetch');
    expect(fetchRows.map(r => r.provider).sort()).toEqual(
      ['anilist', 'comicvine', 'fandom', 'kitsu', 'mal', 'mangadex', 'mangaupdates', 'wikipedia'],
    );
    expect(fetchRows.every(r => r.field === '_fetch' && r.value === null)).toBe(true);
  });

  it('does not let an unvoted value replace the value the selector voted on', () => {
    const run = new ClaimRun(73);
    noteSelection(run, [{ provider: 'wikipedia' as ProviderClaim['provider'], matchConfidence: 0.9, fields: { chapters: 685 } }]);
    run.noteFetchPhase(snapshot());

    const rows = run.buildRows().filter(r => r.provider === 'wikipedia' && r.field === 'chapters');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(685);
  });
});

describe('ClaimRun — volume manifests', () => {
  it('summarises each source\'s ranges with volume count, highest chapter and the ranges', () => {
    const run = new ClaimRun(73);
    run.noteFetchPhase(snapshot());
    run.noteManifests([proposal('mangadex', 2, 8, 16), proposal('mangadex', 1, 1, 7), proposal('comicvine', 1, 1, 7)]);

    const manifest = row(run.buildRows(), 'mangadex', 'volumeRanges');
    expect(manifest?.kind).toBe('manifest');
    expect(manifest?.value).toEqual({
      volumeCount: 2, lowestChapter: 1, highestChapter: 16,
      methods: { 'explicit-range': 2 }, ranges: [[1, 1, 7], [2, 8, 16]],
    });
  });

  it('records the ranges as they entered cross-validation even if the proposals are changed afterwards', () => {
    const run = new ClaimRun(73);
    const proposals = [proposal('comicvine', 1, 1, 7), proposal('comicvine', 2, 8, 99)];
    run.noteManifests(proposals);
    proposals.pop();
    const first = proposals[0];
    if (first) first.chapterEnd = 3;

    expect(row(run.buildRows(), 'comicvine', 'volumeRanges')?.value).toMatchObject({ ranges: [[1, 1, 7], [2, 8, 99]] });
  });

  it('records a gated wiki\'s ranges from its pre-gate list, marked as never reaching cross-validation', () => {
    const run = new ClaimRun(78);
    const preGate = fandomSnapshot(700, [[1, 1, 7], [2, 8, 17]]);
    run.noteGated('fandom', '>2x AniList (700 vs 147)', { fandom: preGate });
    run.noteFetchPhase(snapshot({ fandom: { ...preGate, chapterList: [], volumeList: [] } }));
    run.noteManifests([proposal('mangadex', 1, 1, 7)]);

    const rows = run.buildRows();
    const manifest = row(rows, 'fandom', 'volumeRanges');
    expect(row(rows, 'fandom', '_fetch')?.fetchOutcome).toBe('gated');
    expect(manifest?.fetchOutcome).toBe('gated');
    expect(manifest?.value).toMatchObject({ volumeCount: 2, highestChapter: 17 });
    expect(manifest?.detail).toEqual({ enteredCrossValidation: false, gateReason: '>2x AniList (700 vs 147)' });
  });

  it('records how many of the kept volumes each source backs, as cross-validation reported it', () => {
    const run = new ClaimRun(73);
    run.noteManifests([proposal('mangadex', 1, 1, 7), proposal('comicvine', 1, 1, 7)]);
    run.noteValidatedRanges([
      { volumeNumber: 1, sources: ['mangadex', 'comicvine'] },
      { volumeNumber: 2, sources: ['mangadex'] },
    ]);

    const rows = run.buildRows();
    expect(row(rows, 'mangadex', 'volumeRanges')?.detail).toEqual({ enteredCrossValidation: true, validatedVolumes: 2, backedVolumes: 2 });
    expect(row(rows, 'comicvine', 'volumeRanges')?.detail).toMatchObject({ backedVolumes: 1 });
  });
});

describe('ClaimRun — follow-up fetches', () => {
  it('records Fandom\'s chapter pages as failed when none of the requested pages came back', () => {
    const run = new ClaimRun(73);
    run.noteFetchPhase(snapshot());
    run.noteStage('fandom', 'chapterPages', { requested: 110, fetched: 0 });

    const rows = run.buildRows();
    expect(row(rows, 'fandom', '_fetch.chapterPages')).toMatchObject({
      kind: 'fetch', fetchOutcome: 'failed', detail: { requested: 110, fetched: 0 },
    });
    // The list fetch keeps its own outcome.
    expect(row(rows, 'fandom', '_fetch')?.fetchOutcome).toBe('ok');
  });
});

describe('ClaimRun — recording cannot fail a run', () => {
  it('does not throw from any note when handed data it cannot read', () => {
    const run = new ClaimRun(73);
    const hostile = new Proxy({}, { get: (): never => { throw new Error('boom'); } });

    expect(() => {
      run.noteFetchPhase(hostile as unknown as FetchPhaseSnapshot);
      run.noteFetchPhase(null as unknown as FetchPhaseSnapshot);
      run.noteSelection(hostile as unknown as ProviderClaim[], hostile as never);
      run.noteManifests(hostile as unknown as ManifestProposal[]);
      run.noteValidatedRanges(null as never);
      run.noteGated('fandom', 'reason', hostile as never);
      run.noteStage('fandom', 'chapterPages', null as never);
    }).not.toThrow();
    expect(() => run.buildRows()).not.toThrow();
  });

  it('still records the notes that succeeded after one note failed', () => {
    const run = new ClaimRun(73);
    run.noteSelection(null as unknown as ProviderClaim[], null as never);
    run.noteFetchPhase(snapshot());
    expect(run.buildRows().filter(r => r.kind === 'fetch')).toHaveLength(8);
  });

  it('flush resolves when the store rejects', async () => {
    mockedWrite.mockRejectedValue(new Error('db down'));
    const run = new ClaimRun(73);
    run.noteFetchPhase(snapshot());
    await expect(run.flush()).resolves.toBeUndefined();
  });

  it('flush writes the whole run in one store call, once', async () => {
    const run = new ClaimRun(73);
    run.noteFetchPhase(snapshot());
    await run.flush();
    await run.flush();

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    expect(lastBatch()).toMatchObject({ mangaId: 73, runId: run.runId, startedAt: run.startedAt });
    expect(lastBatch().rows.length).toBeGreaterThan(8);
  });
});

describe('withClaimRun', () => {
  it('hands the body a recorder on its options, keeps the caller\'s options, and writes when the body resolves', async () => {
    const result = await withClaimRun(73, { forceRefresh: true }, (options) => {
      options.claimRun?.noteFetchPhase(snapshot());
      return Promise.resolve({ forceRefresh: options.forceRefresh, runId: options.claimRun?.runId });
    });

    expect(result.forceRefresh).toBe(true);
    expect(mockedWrite).toHaveBeenCalledTimes(1);
    expect(lastBatch().runId).toBe(result.runId);
  });

  it('writes what was noted and rethrows the body\'s own error when the run fails', async () => {
    const failure = new Error('phase 2 failed');
    await expect(withClaimRun(73, undefined, (options) => {
      options.claimRun?.noteFetchPhase(snapshot());
      return Promise.reject(failure);
    })).rejects.toBe(failure);

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    expect(lastBatch().rows.some(r => r.kind === 'fetch')).toBe(true);
  });

  it('returns the body\'s result unchanged when the write fails', async () => {
    mockedWrite.mockRejectedValue(new Error('db down'));
    await expect(withClaimRun(73, undefined, () => Promise.resolve('done'))).resolves.toBe('done');
  });

  it('creates a new run id for each run of the same title', async () => {
    const ids: Array<string | undefined> = [];
    const collect = (options: { claimRun?: { runId: string } }): Promise<void> => {
      ids.push(options.claimRun?.runId);
      return Promise.resolve();
    };
    await withClaimRun(73, undefined, collect);
    await withClaimRun(73, undefined, collect);
    expect(ids[0]).toBeDefined();
    expect(ids[0]).not.toBe(ids[1]);
  });
});
