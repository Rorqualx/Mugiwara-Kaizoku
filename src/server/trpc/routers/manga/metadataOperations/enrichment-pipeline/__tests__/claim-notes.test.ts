/**
 * @jest-environment node
 */
import { crossValidateRecorded, noteFandomChapterPages, noteReconciliationGate } from '../claim-run/notes';
import { crossValidateVolumeRanges, type VolumeRangeProposal } from '../phase-volume-cross-validation';

import type { ClaimRecorder } from '../claim-run/recorder';

function proposal(source: VolumeRangeProposal['source'], volumeNumber: number, chapterStart: number, chapterEnd: number): VolumeRangeProposal {
  return { source, volumeNumber, chapterStart, chapterEnd, confidence: 0.9, extractionMethod: 'explicit-range' };
}

/** A recorder that logs the order of its calls and what it was shown. */
function spyRecorder(): { recorder: ClaimRecorder; calls: string[]; seenSources: string[] } {
  const calls: string[] = [];
  const seenSources: string[] = [];
  const recorder: ClaimRecorder = {
    runId: 'run-1',
    noteFetchFailure: () => { calls.push('failure'); },
    noteGated: (provider, reason, preGate) => { calls.push(`gated:${provider}:${reason}:${Object.keys(preGate).length}`); },
    noteFetchPhase: () => { calls.push('fetch'); },
    noteSelection: () => { calls.push('selection'); },
    noteStage: (provider, stage, counts) => { calls.push(`stage:${provider}:${stage}:${counts.requested}:${counts.fetched}`); },
    noteManifests: (proposals) => {
      calls.push('manifests');
      seenSources.push(...proposals.map(p => p.source));
    },
    noteValidatedRanges: (ranges) => { calls.push(`validated:${ranges.length}`); },
  };
  return { recorder, calls, seenSources };
}

const GATE = { expectedChapterCount: 16, expectedVolumeCount: 2, volumeTrusted: false };

describe('crossValidateRecorded', () => {
  // ComicVine lists 2 omnibus volumes reaching chapter 40; MangaDex lists the
  // tankobon edition. Cross-validation drops ComicVine's ranges as a
  // different edition — the recorder must have seen them first.
  const proposals = [
    proposal('comicvine', 1, 1, 20), proposal('comicvine', 2, 21, 40),
    proposal('mangadex', 1, 1, 7), proposal('mangadex', 2, 8, 16),
    proposal('mangadex', 3, 17, 25), proposal('mangadex', 4, 26, 34),
  ];

  it('shows the recorder every source\'s ranges before cross-validation drops any of them', () => {
    const { recorder, calls, seenSources } = spyRecorder();

    crossValidateRecorded({ claimRun: recorder }, proposals, { ...GATE, expectedChapterCount: 34, expectedVolumeCount: 4 });

    expect(calls[0]).toBe('manifests');
    expect(calls[1]).toMatch(/^validated:/u);
    expect(seenSources.filter(s => s === 'comicvine')).toHaveLength(2);
  });

  it('returns exactly what cross-validation returns, with or without a recorder', () => {
    const simple = [proposal('mangadex', 1, 1, 7), proposal('mangadex', 2, 8, 16)];
    const expected = crossValidateVolumeRanges(simple, 16, 2, false);

    expect(crossValidateRecorded(undefined, simple, GATE)).toEqual(expected);
    expect(crossValidateRecorded({ claimRun: spyRecorder().recorder }, simple, GATE)).toEqual(expected);
  });
});

describe('noteReconciliationGate', () => {
  const counts = { mangadex: 6, anilist: 60 };

  it('notes Fandom as gated, with no pre-gate lists, when chapters went into the reconciliation gate and none came out', () => {
    const { recorder, calls } = spyRecorder();
    noteReconciliationGate({ claimRun: recorder }, 686, 0, counts);
    expect(calls).toEqual(['gated:fandom:reconciliation gate: 686 chapters vs AniList 60 / MangaDex 6:0']);
  });

  it('notes nothing when the gate let the chapters through or there were none to gate', () => {
    const { recorder, calls } = spyRecorder();
    noteReconciliationGate({ claimRun: recorder }, 110, 110, counts);
    noteReconciliationGate({ claimRun: recorder }, 0, 0, counts);
    noteReconciliationGate(undefined, 686, 0, counts);
    expect(calls).toEqual([]);
  });
});

describe('noteFandomChapterPages', () => {
  it('reports the requested and fetched page counts for Fandom\'s chapter pages', () => {
    const { recorder, calls } = spyRecorder();
    noteFandomChapterPages({ claimRun: recorder }, 110, 0);
    expect(calls).toEqual(['stage:fandom:chapterPages:110:0']);
  });

  it('does nothing when the phase runs without a recorder', () => {
    expect(() => { noteFandomChapterPages(undefined, 110, 0); }).not.toThrow();
  });
});
