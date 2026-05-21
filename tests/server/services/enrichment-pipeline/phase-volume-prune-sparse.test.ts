/**
 * @jest-environment node
 *
 * detectSparseLeadingRange — pure detection logic for iter-B1. Tests
 * the conservative heuristic (2+ leading single-chapter vols followed
 * by a dense tail with median span >= 5) against representative
 * library shapes including the Frieren baseline.
 */

import { detectSparseLeadingRange, detectInterleavedSparseRuns } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-prune-sparse';

const mkVol = (number: number, start: number, end: number) =>
  ({ id: number * 100, number, chapterStart: start, chapterEnd: end });

describe('detectSparseLeadingRange', () => {
  it('Frieren shape — Vols 1-3 single-ch + Vols 4-10 ten-ch + Vols 11-14 single-ch (ongoing)', () => {
    const volumes = [
      mkVol(1, 1, 1), mkVol(2, 2, 2), mkVol(3, 3, 3),
      mkVol(4, 28, 37), mkVol(5, 38, 47), mkVol(6, 48, 57), mkVol(7, 58, 67),
      mkVol(8, 68, 77), mkVol(9, 78, 87), mkVol(10, 88, 97),
      mkVol(11, 98, 98), mkVol(12, 99, 99), mkVol(13, 100, 100), mkVol(14, 101, 101),
    ];
    expect(detectSparseLeadingRange(volumes)).toEqual([100, 200, 300]);
  });

  it('healthy manga — Vols 1-N all multi-chapter → no pruning', () => {
    const volumes = [
      mkVol(1, 1, 10), mkVol(2, 11, 20), mkVol(3, 21, 30),
      mkVol(4, 31, 40), mkVol(5, 41, 50),
    ];
    expect(detectSparseLeadingRange(volumes)).toEqual([]);
  });

  it('1 leading single-chapter vol — below threshold, no pruning', () => {
    const volumes = [
      mkVol(1, 1, 1),
      mkVol(2, 2, 11), mkVol(3, 12, 21), mkVol(4, 22, 31), mkVol(5, 32, 41),
    ];
    expect(detectSparseLeadingRange(volumes)).toEqual([]);
  });

  it('5 leading single-chapter vols + dense tail → prune all 5', () => {
    const volumes = [
      mkVol(1, 1, 1), mkVol(2, 2, 2), mkVol(3, 3, 3), mkVol(4, 4, 4), mkVol(5, 5, 5),
      mkVol(6, 50, 60), mkVol(7, 61, 71), mkVol(8, 72, 82),
    ];
    expect(detectSparseLeadingRange(volumes)).toEqual([100, 200, 300, 400, 500]);
  });

  it('leading sparse but rest median < 5 → no pruning (not the bogus pattern)', () => {
    const volumes = [
      mkVol(1, 1, 1), mkVol(2, 2, 2),
      mkVol(3, 3, 5), mkVol(4, 6, 8), mkVol(5, 9, 11), mkVol(6, 12, 14),
    ];
    expect(detectSparseLeadingRange(volumes)).toEqual([]);
  });

  it('only 3 volumes total → below sample threshold, no pruning', () => {
    const volumes = [
      mkVol(1, 1, 1), mkVol(2, 2, 2), mkVol(3, 3, 20),
    ];
    expect(detectSparseLeadingRange(volumes)).toEqual([]);
  });

  it('trailing sparse only (manga ongoing) → no pruning of trailing', () => {
    const volumes = [
      mkVol(1, 1, 10), mkVol(2, 11, 20), mkVol(3, 21, 30), mkVol(4, 31, 40),
      mkVol(5, 41, 41), mkVol(6, 42, 42),
    ];
    expect(detectSparseLeadingRange(volumes)).toEqual([]);
  });

  it('Slime-class — 4 leading sparse + 5 dense → prune 4', () => {
    const volumes = [
      mkVol(1, 1, 1), mkVol(2, 2, 2), mkVol(3, 3, 3), mkVol(4, 4, 4),
      mkVol(5, 50, 60), mkVol(6, 61, 71), mkVol(7, 72, 82), mkVol(8, 83, 93), mkVol(9, 94, 104),
    ];
    expect(detectSparseLeadingRange(volumes)).toEqual([100, 200, 300, 400]);
  });
});

describe('detectInterleavedSparseRuns (iter-B3)', () => {
  it('Slime actual shape — leading sparse Vols 1-4 + sandwiched Vols 9-16 → prune both', () => {
    const volumes = [
      // Leading sparse
      mkVol(1, 1, 1), mkVol(2, 2, 2), mkVol(3, 3, 3), mkVol(4, 4, 4),
      // Dense block
      mkVol(5, 5, 13), mkVol(6, 14, 22), mkVol(7, 23, 31), mkVol(8, 32, 40),
      // Interior sparse (sandwiched)
      mkVol(9, 41, 41), mkVol(10, 42, 42), mkVol(11, 43, 43), mkVol(12, 44, 44),
      mkVol(13, 45, 45), mkVol(14, 46, 46), mkVol(15, 47, 47), mkVol(16, 48, 48),
      // Semi-dense follower (span 4)
      mkVol(17, 75, 79),
    ];
    // Expect IDs 100,200,300,400 (Vols 1-4) + 900..1600 (Vols 9-16)
    expect(detectInterleavedSparseRuns(volumes)).toEqual([
      100, 200, 300, 400,
      900, 1000, 1100, 1200, 1300, 1400, 1500, 1600,
    ]);
  });

  it('Frieren-class — leading sparse 1-3 + dense 4-10 + TRAILING sparse 11-14 (ongoing) → prune ONLY leading 1-3', () => {
    const volumes = [
      mkVol(1, 1, 1), mkVol(2, 2, 2), mkVol(3, 3, 3),
      mkVol(4, 28, 37), mkVol(5, 38, 47), mkVol(6, 48, 57), mkVol(7, 58, 67),
      mkVol(8, 68, 77), mkVol(9, 78, 87), mkVol(10, 88, 97),
      mkVol(11, 98, 98), mkVol(12, 99, 99), mkVol(13, 100, 100), mkVol(14, 101, 101),
    ];
    // Trailing sparse stays untouched (no `next` neighbor)
    expect(detectInterleavedSparseRuns(volumes)).toEqual([100, 200, 300]);
  });

  it('healthy manga — all multi-chapter vols → no pruning', () => {
    const volumes = [
      mkVol(1, 1, 10), mkVol(2, 11, 20), mkVol(3, 21, 30), mkVol(4, 31, 40),
    ];
    expect(detectInterleavedSparseRuns(volumes)).toEqual([]);
  });

  it('isolated single sparse vol between dense (run length = 1) → no pruning', () => {
    const volumes = [
      mkVol(1, 1, 10), mkVol(2, 11, 11), mkVol(3, 12, 21), mkVol(4, 22, 31),
    ];
    expect(detectInterleavedSparseRuns(volumes)).toEqual([]);
  });

  it('interior sparse with one dense + one single neighbor → no pruning (needs both dense)', () => {
    const volumes = [
      mkVol(1, 1, 10), mkVol(2, 11, 11), mkVol(3, 12, 12),
      mkVol(4, 13, 13), mkVol(5, 14, 14), // single neighbors
    ];
    // Vols 2-3 are sandwiched between Vol 1 (dense) and Vol 4 (single).
    // Vol 4 fails the prev/next ≥3 check → don't prune.
    expect(detectInterleavedSparseRuns(volumes)).toEqual([]);
  });

  it('relaxed dense threshold (3) catches Slime\'s Vol 17 (span 4) as a valid neighbor', () => {
    // span ≥ 3 means chapterEnd - chapterStart ≥ 3, i.e. at least 4 chapters
    const volumes = [
      mkVol(1, 1, 4), // span 3 — barely dense
      mkVol(2, 5, 5), mkVol(3, 6, 6), // sparse run
      mkVol(4, 7, 10), // span 3 — barely dense
    ];
    expect(detectInterleavedSparseRuns(volumes)).toEqual([200, 300]);
  });
});
