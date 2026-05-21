/**
 * @jest-environment node
 *
 * Volume Cross-Validation Tests
 *
 * Validates that cross-validation correctly:
 * 1. Resolves conflicts between ComicVine, Wikipedia, and Fandom proposals
 * 2. Detects anomalous ranges and drops them
 * 3. Handles consensus (sources agreeing within tolerance)
 * 4. Validates sequential constraints
 * 5. Produces correct output for real manga scenarios
 */

import {
  crossValidateVolumeRanges,
  collectVolumeRangeProposals,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation';
import type { VolumeRangeProposal } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation';

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
}));

// ============================================================================
// Tests: crossValidateVolumeRanges
// ============================================================================

describe('crossValidateVolumeRanges', () => {
  it('should return empty array for empty proposals', () => {
    const result = crossValidateVolumeRanges([], null);
    expect(result).toEqual([]);
  });

  it('should accept single-source proposals with reduced confidence', () => {
    const proposals: VolumeRangeProposal[] = [
      { volumeNumber: 1, chapterStart: 1, chapterEnd: 7, source: 'comicvine', confidence: 0.95, extractionMethod: 'explicit-range' },
      { volumeNumber: 2, chapterStart: 8, chapterEnd: 16, source: 'comicvine', confidence: 0.95, extractionMethod: 'explicit-range' },
    ];

    const result = crossValidateVolumeRanges(proposals, null);

    expect(result).toHaveLength(2);
    expect(result[0]!.chapterStart).toBe(1);
    expect(result[0]!.chapterEnd).toBe(7);
    // Single source: confidence reduced by 0.2
    expect(result[0]!.confidence).toBe(0.75);
    expect(result[0]!.sources).toEqual(['comicvine']);
  });

  it('should reach consensus when two sources agree within 2 chapters', () => {
    const proposals: VolumeRangeProposal[] = [
      { volumeNumber: 1, chapterStart: 1, chapterEnd: 7, source: 'comicvine', confidence: 0.9, extractionMethod: 'explicit-range' },
      { volumeNumber: 1, chapterStart: 1, chapterEnd: 8, source: 'wikipedia', confidence: 0.8, extractionMethod: 'table-parse' },
    ];

    const result = crossValidateVolumeRanges(proposals, null);

    expect(result).toHaveLength(1);
    // Consensus: min start, higher-confidence source's end
    expect(result[0]!.chapterStart).toBe(1);
    expect(result[0]!.chapterEnd).toBe(7); // comicvine has higher confidence (0.9 > 0.8)
    // Consensus boost: max confidence + 0.1
    expect(result[0]!.confidence).toBe(1.0);
    expect(result[0]!.sources).toContain('comicvine');
    expect(result[0]!.sources).toContain('wikipedia');
  });

  it('should prefer higher confidence when no consensus', () => {
    const proposals: VolumeRangeProposal[] = [
      { volumeNumber: 1, chapterStart: 1, chapterEnd: 7, source: 'comicvine', confidence: 0.95, extractionMethod: 'explicit-range' },
      { volumeNumber: 1, chapterStart: 1, chapterEnd: 20, source: 'fandom', confidence: 0.5, extractionMethod: 'table-parse' },
    ];

    const result = crossValidateVolumeRanges(proposals, null);

    expect(result).toHaveLength(1);
    expect(result[0]!.chapterStart).toBe(1);
    expect(result[0]!.chapterEnd).toBe(7); // ComicVine wins
    expect(result[0]!.sources).toEqual(['comicvine']);
  });

  it('should drop anomalous volumes with > 3x median chapter count', () => {
    const proposals: VolumeRangeProposal[] = [
      { volumeNumber: 1, chapterStart: 1, chapterEnd: 9, source: 'comicvine', confidence: 0.9, extractionMethod: 'explicit-range' },
      { volumeNumber: 2, chapterStart: 10, chapterEnd: 18, source: 'comicvine', confidence: 0.9, extractionMethod: 'explicit-range' },
      { volumeNumber: 3, chapterStart: 19, chapterEnd: 27, source: 'comicvine', confidence: 0.9, extractionMethod: 'explicit-range' },
      { volumeNumber: 4, chapterStart: 28, chapterEnd: 36, source: 'comicvine', confidence: 0.9, extractionMethod: 'explicit-range' },
      // Anomalous: 100 chapters when median is ~9
      { volumeNumber: 5, chapterStart: 37, chapterEnd: 136, source: 'fandom', confidence: 0.5, extractionMethod: 'table-parse' },
    ];

    const result = crossValidateVolumeRanges(proposals, null);

    // Vol 5 should be dropped as anomalous
    expect(result).toHaveLength(4);
    expect(result.map(r => r.volumeNumber)).toEqual([1, 2, 3, 4]);
  });

  it('should fix overlapping ranges', () => {
    const proposals: VolumeRangeProposal[] = [
      { volumeNumber: 1, chapterStart: 1, chapterEnd: 10, source: 'comicvine', confidence: 0.9, extractionMethod: 'explicit-range' },
      // Overlaps with vol 1 (starts at 5, should be adjusted to 11)
      { volumeNumber: 2, chapterStart: 5, chapterEnd: 20, source: 'wikipedia', confidence: 0.7, extractionMethod: 'table-parse' },
    ];

    const result = crossValidateVolumeRanges(proposals, null);

    expect(result).toHaveLength(2);
    expect(result[0]!.chapterEnd).toBe(10);
    expect(result[1]!.chapterStart).toBe(11); // Adjusted to avoid overlap
  });

  it('should handle Chainsaw Man scenario: 23 ComicVine volumes', () => {
    // Chainsaw Man: ComicVine has explicit ranges, Wikipedia agrees
    const proposals: VolumeRangeProposal[] = [];
    const chainsawRanges = [
      [1, 7], [8, 16], [17, 25], [26, 34], [35, 43],
      [44, 52], [53, 61], [62, 70], [71, 79], [80, 88],
    ];

    for (let i = 0; i < chainsawRanges.length; i++) {
      const [start, end] = chainsawRanges[i]!;
      // ComicVine proposal
      proposals.push({
        volumeNumber: i + 1,
        chapterStart: start!,
        chapterEnd: end!,
        source: 'comicvine',
        confidence: 0.95,
        extractionMethod: 'explicit-range',
      });
      // Wikipedia proposal (agrees within 1)
      proposals.push({
        volumeNumber: i + 1,
        chapterStart: start!,
        chapterEnd: end!,
        source: 'wikipedia',
        confidence: 0.8,
        extractionMethod: 'table-parse',
      });
    }

    const result = crossValidateVolumeRanges(proposals, 230);

    expect(result).toHaveLength(10);
    // Vol 1 should be ch 1-7
    expect(result[0]!.chapterStart).toBe(1);
    expect(result[0]!.chapterEnd).toBe(7);
    // Consensus should boost confidence
    expect(result[0]!.confidence).toBeGreaterThan(0.9);
    expect(result[0]!.sources).toContain('comicvine');
    expect(result[0]!.sources).toContain('wikipedia');
  });
});

// ============================================================================
// Tests: collectVolumeRangeProposals
// ============================================================================

describe('collectVolumeRangeProposals', () => {
  it('should extract ComicVine proposals with explicit ranges', () => {
    const comicvineVolumes: Array<Record<string, unknown>> = [
      { volumeNumber: '1', startChapter: '1', endChapter: '7', hasExplicitRange: true },
      { volumeNumber: '2', startChapter: '8', endChapter: '16', hasExplicitRange: false },
    ];

    const proposals = collectVolumeRangeProposals(comicvineVolumes, [], []);

    expect(proposals).toHaveLength(2);
    expect(proposals[0]!.source).toBe('comicvine');
    expect(proposals[0]!.confidence).toBe(0.95); // Explicit
    expect(proposals[0]!.extractionMethod).toBe('explicit-range');
    expect(proposals[1]!.confidence).toBe(0.7); // Cumulative
    expect(proposals[1]!.extractionMethod).toBe('cumulative');
  });

  it('should extract Wikipedia proposals from chapters array', () => {
    const wikiVolumes = [
      {
        number: 1,
        chapters: [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 7 }],
      },
    ];

    const proposals = collectVolumeRangeProposals([], wikiVolumes, []);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.source).toBe('wikipedia');
    expect(proposals[0]!.chapterStart).toBe(1);
    expect(proposals[0]!.chapterEnd).toBe(7);
  });

  it('should extract Fandom proposals', () => {
    const fandomVolumes = [
      { number: 1, chapterStart: 1, chapterEnd: 7 },
      { number: 2, chapterStart: 8, chapterEnd: 16 },
    ];

    const proposals = collectVolumeRangeProposals([], [], fandomVolumes);

    expect(proposals).toHaveLength(2);
    expect(proposals[0]!.source).toBe('fandom');
    expect(proposals[0]!.confidence).toBe(0.85);
  });

  it('should skip invalid volumes (number <= 0, missing ranges)', () => {
    const comicvineVolumes: Array<Record<string, unknown>> = [
      { volumeNumber: '0', startChapter: '1', endChapter: '7' }, // vol 0
      { volumeNumber: '1' }, // no range
    ];
    const wikiVolumes = [{ number: -1, chapters: [{ number: 1 }] }];
    const fandomVolumes = [{ number: 1 }]; // no range

    const proposals = collectVolumeRangeProposals(comicvineVolumes, wikiVolumes, fandomVolumes as Array<{ number: number; chapterStart?: number; chapterEnd?: number }>);

    expect(proposals).toHaveLength(0);
  });

  it('should combine proposals from all three sources', () => {
    const cv = [{ volumeNumber: '1', startChapter: '1', endChapter: '7', hasExplicitRange: true }];
    const wiki = [{ number: 1, chapters: [{ number: 1 }, { number: 7 }] }];
    const fandom = [{ number: 1, chapterStart: 1, chapterEnd: 7 }];

    const proposals = collectVolumeRangeProposals(cv, wiki, fandom);

    expect(proposals).toHaveLength(3);
    const sources = proposals.map(p => p.source);
    expect(sources).toContain('comicvine');
    expect(sources).toContain('wikipedia');
    expect(sources).toContain('fandom');
  });
});

// ============================================================================
// iter-PVM-4: membership-consensus routing
// ============================================================================

describe('crossValidateVolumeRanges — membership consensus path', () => {
  it('uses per-chapter consensus when proposals carry chapters[]', () => {
    // CV says vol 1 = ch 1..2 (the Sweat-and-Soap-class bug); MDX per-chapter
    // signal says ch 1-8 all belong to vol 1. Consensus should win.
    const proposals: VolumeRangeProposal[] = [
      { volumeNumber: 1, chapterStart: 1, chapterEnd: 2, source: 'comicvine', confidence: 0.95, extractionMethod: 'explicit-range',
        chapters: [1, 2, 3, 4, 5, 6, 7, 8] },
      { volumeNumber: 1, chapterStart: 1, chapterEnd: 8, source: 'mangadex', confidence: 0.9, extractionMethod: 'explicit-range',
        chapters: [1, 2, 3, 4, 5, 6, 7, 8] },
    ];
    const result = crossValidateVolumeRanges(proposals, 8);
    expect(result).toHaveLength(1);
    expect(result[0]!.chapterStart).toBe(1);
    expect(result[0]!.chapterEnd).toBe(8);
  });

  it('floors MDX release-parts when integer floor is present in any source', () => {
    // MDX emits 34.1/34.2 as release-parts; CV has integer 34 in its corpus.
    // Resolver should normalize 34.1/34.2 → 34, putting ch 34 in vol 4 cleanly.
    const proposals: VolumeRangeProposal[] = [
      { volumeNumber: 4, chapterStart: 27, chapterEnd: 34, source: 'comicvine', confidence: 0.95, extractionMethod: 'explicit-range',
        chapters: [27, 28, 29, 30, 31, 32, 33, 34] },
      { volumeNumber: 4, chapterStart: 34.1, chapterEnd: 34.2, source: 'mangadex', confidence: 0.9, extractionMethod: 'explicit-range',
        chapters: [34.1, 34.2] },
    ];
    const result = crossValidateVolumeRanges(proposals, 34);
    expect(result).toHaveLength(1);
    expect(result[0]!.chapterStart).toBe(27);
    expect(result[0]!.chapterEnd).toBe(34);
  });

  it('falls back to legacy range resolution when no proposals carry chapters[]', () => {
    // No chapters[] field → legacy path. Verifies the bail-out condition works.
    const proposals: VolumeRangeProposal[] = [
      { volumeNumber: 1, chapterStart: 1, chapterEnd: 7, source: 'comicvine', confidence: 0.95, extractionMethod: 'explicit-range' },
    ];
    const result = crossValidateVolumeRanges(proposals, 7);
    expect(result).toHaveLength(1);
    expect(result[0]!.chapterStart).toBe(1);
    expect(result[0]!.chapterEnd).toBe(7);
  });
});
