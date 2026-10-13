/**
 * @jest-environment node
 *
 * Ranges the pipeline computes must not pass for provider data.
 *
 * - Gap interpolation never extends past the last ranged volume (bug: Dandadan
 *   volume 25, a shell created for its cover, was split up to the newest
 *   chapter and read 214-249; the real volume is 211-219).
 * - Interpolated rows are labelled `interpolated`.
 * - The stored ComicVine fallback only returns rows ComicVine attested (bug:
 *   finalize mirrors every Volume row into `comicvine.volumeData`, so on a
 *   ComicVine outage reconciliation's Tokyo Ghoul "volume 15" came back as
 *   ComicVine's).
 */
jest.mock('@/server/db', () => ({ prisma: {} }));

import { buildGapInterpolations, INTERPOLATED_SOURCE, type VolumeRow } from '../phase-volume-reconciliation';
import { comicVineAttestedVolumes } from '../pipeline-orchestrator/stored-comicvine-volumes';

const row = (number: number, chapterStart: number | null, chapterEnd: number | null): VolumeRow =>
  ({ id: number, number, chapterStart, chapterEnd });

describe('buildGapInterpolations', () => {
  it('leaves empty volumes after the last ranged volume open (bug: Dandadan volume 25 read 214-249)', () => {
    const updates = buildGapInterpolations([row(23, 196, 204), row(24, 205, 213), row(25, null, null)]);
    expect(updates).toEqual([]);
  });

  it('still fills a gap bounded by ranged volumes on both sides, labelled interpolated', () => {
    const updates = buildGapInterpolations([row(1, 1, 10), row(2, null, null), row(3, null, null), row(4, 31, 40)]);
    expect(updates.map(u => [u.volNumber, u.data.chapterStart, u.data.chapterEnd, u.data.source])).toEqual([
      [2, 11, 20, INTERPOLATED_SOURCE],
      [3, 21, 30, INTERPOLATED_SOURCE],
    ]);
  });
});

describe('comicVineAttestedVolumes', () => {
  it('drops mirrored rows ComicVine did not attest (bug: Tokyo Ghoul reconciliation volume 15 came back as ComicVine data)', () => {
    const stored = [
      { number: 14, chapterStart: 133, chapterEnd: 143, source: 'comicvine' },
      { number: 13, chapterStart: 122, chapterEnd: 132, source: 'comicvine+wikipedia' },
      { number: 15, chapterStart: 144, chapterEnd: 159, source: 'reconciliation' },
      { number: 16, chapterStart: 160, chapterEnd: 170, source: 'interpolated' },
      { number: 17, chapterStart: 171, chapterEnd: 180, source: 'wikipedia' },
      { number: 18, chapterStart: 181, chapterEnd: 190 },
    ];
    expect(comicVineAttestedVolumes(stored).map(v => v['number'])).toEqual([14, 13]);
  });

  it('drops attested rows without a range', () => {
    expect(comicVineAttestedVolumes([{ number: 3, source: 'comicvine' }])).toEqual([]);
  });
});
