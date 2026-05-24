/**
 * @jest-environment node
 *
 * ComicVine Volume Mapper Tests
 *
 * Validates that the ComicVine volume mapper correctly:
 * 1. Preserves explicit chapter ranges from "Chapters X-Y" patterns
 * 2. Falls back to cumulative computation for volumes without explicit ranges
 * 3. Validates explicit ranges for consistency
 * 4. Handles mixed explicit + cumulative correctly
 */

import { mapComicVineIssuesToVolumes } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/comicvine-volume-mapper';
import type { ComicVineIssue } from '@/server/services/comicvine/service';

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

jest.mock('@/utils/comicvine-chapter-parser', () => ({
  parseChaptersFromDescription: jest.fn(() => []),
}));

// ============================================================================
// Helpers
// ============================================================================

function makeIssue(
  issueNumber: string,
  description?: string,
  name?: string,
): ComicVineIssue {
  return {
    id: parseInt(issueNumber, 10),
    issue_number: issueNumber,
    description: description ?? null,
    name: name ?? null,
    image: null,
    cover_date: null,
  } as unknown as ComicVineIssue;
}

// ============================================================================
// Tests
// ============================================================================

describe('mapComicVineIssuesToVolumes', () => {
  it('should preserve explicit ranges from "Chapters X-Y" descriptions', () => {
    const issues = [
      makeIssue('1', '<p>Contains Chapters 1-7</p>'),
      makeIssue('2', '<p>Contains Chapters 8-16</p>'),
      makeIssue('3', '<p>Contains Chapters 17-25</p>'),
    ];

    const volumes = mapComicVineIssuesToVolumes(issues);

    expect(volumes).toHaveLength(3);

    // Vol 1: explicit range ch 1-7
    expect(volumes[0]!['startChapter']).toBe('1');
    expect(volumes[0]!['endChapter']).toBe('7');
    expect(volumes[0]!['hasExplicitRange']).toBe(true);

    // Vol 2: explicit range ch 8-16
    expect(volumes[1]!['startChapter']).toBe('8');
    expect(volumes[1]!['endChapter']).toBe('16');
    expect(volumes[1]!['hasExplicitRange']).toBe(true);

    // Vol 3: explicit range ch 17-25
    expect(volumes[2]!['startChapter']).toBe('17');
    expect(volumes[2]!['endChapter']).toBe('25');
    expect(volumes[2]!['hasExplicitRange']).toBe(true);
  });

  it('should use cumulative ranges when no explicit range available', () => {
    // Mock parseChaptersFromDescription to return chapters for count
    const parser = require('@/utils/comicvine-chapter-parser');
    parser.parseChaptersFromDescription
      .mockReturnValueOnce([{ chapterNumber: 1 }, { chapterNumber: 2 }, { chapterNumber: 3 }])
      .mockReturnValueOnce([{ chapterNumber: 4 }, { chapterNumber: 5 }]);

    const issues = [
      makeIssue('1', '<p>Chapter 1: Title A</p><p>Chapter 2: Title B</p><p>Chapter 3: Title C</p>'),
      makeIssue('2', '<p>Chapter 4: Title D</p><p>Chapter 5: Title E</p>'),
    ];

    const volumes = mapComicVineIssuesToVolumes(issues);

    expect(volumes).toHaveLength(2);

    // Vol 1: cumulative range ch 1-3 (3 chapters parsed)
    expect(volumes[0]!['startChapter']).toBe('1');
    expect(volumes[0]!['endChapter']).toBe('3');
    expect(volumes[0]!['hasExplicitRange']).toBeUndefined();

    // Vol 2: cumulative range ch 4-5 (2 chapters parsed)
    expect(volumes[1]!['startChapter']).toBe('4');
    expect(volumes[1]!['endChapter']).toBe('5');
  });

  it('should handle mixed explicit and cumulative ranges', () => {
    const parser = require('@/utils/comicvine-chapter-parser');
    // Vol 1's regex matches so parser is never called.
    // Only vol 2 falls back to the parser — one mock needed.
    parser.parseChaptersFromDescription
      .mockReturnValueOnce([{ chapterNumber: 1 }, { chapterNumber: 2 }, { chapterNumber: 3 }, { chapterNumber: 4 }, { chapterNumber: 5 }]);

    const issues = [
      makeIssue('1', '<p>Chapters 1-7</p>'),
      makeIssue('2', '<p>Five chapters with titles listed</p>'),
    ];

    const volumes = mapComicVineIssuesToVolumes(issues);

    expect(volumes).toHaveLength(2);

    // Vol 1: explicit range
    expect(volumes[0]!['startChapter']).toBe('1');
    expect(volumes[0]!['endChapter']).toBe('7');
    expect(volumes[0]!['hasExplicitRange']).toBe(true);

    // Vol 2: cumulative starting after vol 1's explicit end (8)
    expect(volumes[1]!['startChapter']).toBe('8');
    expect(volumes[1]!['endChapter']).toBe('12'); // 8 + 5 - 1
  });

  it('should skip invalid issue numbers', () => {
    const issues = [
      makeIssue('0'),
      makeIssue('-1'),
      makeIssue('abc'),
      makeIssue('1', '<p>Chapters 1-7</p>'),
    ];

    const volumes = mapComicVineIssuesToVolumes(issues);

    expect(volumes).toHaveLength(1);
    expect(volumes[0]!['volumeNumber']).toBe('1');
  });

  it('should sort volumes by volume number', () => {
    const issues = [
      makeIssue('3', '<p>Chapters 17-25</p>'),
      makeIssue('1', '<p>Chapters 1-7</p>'),
      makeIssue('2', '<p>Chapters 8-16</p>'),
    ];

    const volumes = mapComicVineIssuesToVolumes(issues);

    expect(volumes.map(v => v['volumeNumber'])).toEqual(['1', '2', '3']);
  });

  it('preserves correct explicit ranges in the fallback path when one bad range trips validation', () => {
    // Repro of OP Colored Vol 88 = 1767-1776 bug: most vols have correct
    // explicit ranges from their description, but validateExplicitRanges sees
    // a gap (one vol's range is wrong/missing) and trips the fallback. The
    // OLD computeFullCumulative wiped EVERY explicit range and rebuilt from
    // chapterCount starting at 1 — turning vol 88 ch 880-889 into ch 1767-1776.
    const parser = require('@/utils/comicvine-chapter-parser');
    parser.parseChaptersFromDescription.mockReset();
    // Vol 1: chs 1-8 (good explicit)
    parser.parseChaptersFromDescription.mockReturnValueOnce(
      Array.from({ length: 8 }, (_, i) => ({ chapterNumber: i + 1, hasRealNumber: true, title: `T${i + 1}` })),
    );
    // Vol 2: chs 9-17 (good explicit)
    parser.parseChaptersFromDescription.mockReturnValueOnce(
      Array.from({ length: 9 }, (_, i) => ({ chapterNumber: i + 9, hasRealNumber: true, title: `T${i + 9}` })),
    );
    // Vol 3: chs 50-58 — INTENTIONAL GAP from vol 2 (ends at 17) → triggers
    // validateExplicitRanges to return false → computeFullCumulative fallback.
    parser.parseChaptersFromDescription.mockReturnValueOnce(
      Array.from({ length: 9 }, (_, i) => ({ chapterNumber: i + 50, hasRealNumber: true, title: `T${i + 50}` })),
    );
    // Vol 4: chs 59-67 (good explicit, sequential with vol 3)
    parser.parseChaptersFromDescription.mockReturnValueOnce(
      Array.from({ length: 9 }, (_, i) => ({ chapterNumber: i + 59, hasRealNumber: true, title: `T${i + 59}` })),
    );

    const issues = [
      makeIssue('1', '<p>desc</p>'),
      makeIssue('2', '<p>desc</p>'),
      makeIssue('3', '<p>desc</p>'),
      makeIssue('4', '<p>desc</p>'),
    ];

    const volumes = mapComicVineIssuesToVolumes(issues);

    // Vols 1, 2, 4 have correct explicit ranges in their descriptions.
    // The new fallback preserves all explicit ranges (only cumulative-fills
    // missing ones). Even with vol 3 creating a gap, vols 1/2/4 stay correct.
    expect(volumes[0]!['startChapter']).toBe('1');
    expect(volumes[0]!['endChapter']).toBe('8');
    expect(volumes[1]!['startChapter']).toBe('9');
    expect(volumes[1]!['endChapter']).toBe('17');
    expect(volumes[2]!['startChapter']).toBe('50');
    expect(volumes[2]!['endChapter']).toBe('58');
    expect(volumes[3]!['startChapter']).toBe('59');
    expect(volumes[3]!['endChapter']).toBe('67');
  });
});
