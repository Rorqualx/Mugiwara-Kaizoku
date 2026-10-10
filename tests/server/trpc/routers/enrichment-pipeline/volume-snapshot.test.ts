/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from '@jest/globals';

import { planVolumeRestore } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/volume-snapshot';

jest.mock('@/server/db', () => ({ prisma: {} }));

describe('planVolumeRestore — which volumes to put back after the per-run rebuild', () => {
  // Why this exists: enrichment deletes every Volume row and rebuilds from that
  // run's provider results. A timeout is the same null as "no match", so a run
  // during a provider outage (or a rebuild that threw) left a title with fewer
  // volumes or none, and still reported success.
  const snapshot = [
    { number: 1, source: 'comicvine+wikipedia' },
    { number: 2, source: 'wikipedia' },
    { number: 3, source: 'mangadex' },
    { number: 4, source: null },
    { number: 5, source: 'manual' },
  ];

  it('restores nothing on a healthy run — the rebuilt set is the truth', () => {
    expect(planVolumeRestore(snapshot, new Set([1, 2]), [])).toEqual([5]);
  });

  it('restores everything when the rebuild produced no volumes at all', () => {
    expect(planVolumeRestore(snapshot, new Set(), [])).toEqual([1, 2, 3, 4, 5]);
  });

  it('restores missing volumes sourced from a provider that did not answer', () => {
    expect(planVolumeRestore(snapshot, new Set([3]), ['wikipedia'])).toEqual([1, 2, 5]);
  });

  it('does not restore a missing volume whose providers all answered', () => {
    expect(planVolumeRestore(snapshot, new Set([1, 2]), ['kitsu'])).toEqual([5]);
  });

  it('never restores a volume the rebuild already produced', () => {
    expect(planVolumeRestore(snapshot, new Set([1, 2, 3, 4, 5]), ['wikipedia', 'mangadex'])).toEqual([]);
  });

  it('always restores a missing manual volume', () => {
    expect(planVolumeRestore([{ number: 9, source: 'manual' }], new Set([1]), [])).toEqual([9]);
  });

  it('has nothing to restore when there was nothing before', () => {
    expect(planVolumeRestore([], new Set(), ['anilist'])).toEqual([]);
  });
});
