/**
 * @jest-environment node
 *
 * library-scanner resolveIndex/classifyFile tests — construct-aware
 * synthetic-volume gate (iter-IH).
 *
 * Background: the library scanner walks a manga's library folder and
 * creates Chapter rows for untracked files. When a file parses to a
 * volume number (and no chapter number), the scanner picks a
 * deterministic synthetic index `100000 + volumeNumber`. For JP
 * tankobon this is the correct shape (volume packs are real release
 * units). For KR webtoons it's a disaster — a fan-bundled
 * "Lookism Vol.1.cbz" file would inject a fake-volume row that
 * doesn't correspond to any real chapter grouping.
 *
 * iter-IH adds a construct-aware guard at resolveIndex: when
 * construct='webtoon' AND the file has only a volumeNumber, refuse
 * to create a synthetic-volume row (return null, which surfaces as
 * action='error' upstream).
 *
 * Regression-safety: the default-undefined construct path MUST behave
 * exactly like the legacy code — pre-iter-IH consumers don't pass a
 * construct and shouldn't see any change in classification.
 */

import { resolveIndex, classifyFile } from '@/server/services/packImport/library-scanner';

const mkFile = (overrides: Partial<{ fileName: string; volumeNumber: number | null; chapterNumber: number | null }> = {}) => ({
  fileName: overrides.fileName ?? 'Lookism 001.cbz',
  filePath: '/lib/Lookism/' + (overrides.fileName ?? 'Lookism 001.cbz'),
  size: 12345,
  volumeNumber: overrides.volumeNumber ?? null,
  chapterNumber: overrides.chapterNumber ?? null,
  isValidChapter: true,
});

describe('resolveIndex — construct-aware', () => {
  it('chapter file → chapter number, regardless of construct', () => {
    const file = mkFile({ chapterNumber: 42 });
    expect(resolveIndex(file)).toBe(42);
    expect(resolveIndex(file, 'manga')).toBe(42);
    expect(resolveIndex(file, 'webtoon')).toBe(42);
    expect(resolveIndex(file, 'manhua')).toBe(42);
  });

  it('volume-only file + manga construct → synthetic 100000+volume (legacy preserved)', () => {
    const file = mkFile({ volumeNumber: 5 });
    expect(resolveIndex(file, 'manga')).toBe(100005);
  });

  it('volume-only file + manhwa construct → synthetic (traditional print volumes)', () => {
    const file = mkFile({ volumeNumber: 5 });
    expect(resolveIndex(file, 'manhwa')).toBe(100005);
  });

  it('volume-only file + manhua construct → synthetic (legacy print volumes; webtoon manhua handled at parser)', () => {
    const file = mkFile({ volumeNumber: 5 });
    expect(resolveIndex(file, 'manhua')).toBe(100005);
  });

  it('volume-only file + unknown construct → synthetic (legacy fallback)', () => {
    const file = mkFile({ volumeNumber: 5 });
    expect(resolveIndex(file, 'unknown')).toBe(100005);
    expect(resolveIndex(file)).toBe(100005);
  });

  it('volume-only file + webtoon construct → null (REFUSE synthetic — iter-IH guard)', () => {
    const file = mkFile({ volumeNumber: 5 });
    expect(resolveIndex(file, 'webtoon')).toBeNull();
  });

  it('no vol/no chapter → null in every construct', () => {
    const file = mkFile();
    expect(resolveIndex(file)).toBeNull();
    expect(resolveIndex(file, 'webtoon')).toBeNull();
    expect(resolveIndex(file, 'manga')).toBeNull();
  });
});

describe('classifyFile — construct-aware', () => {
  it('volume-only file + webtoon construct → action=error (gate fires)', () => {
    const file = mkFile({ volumeNumber: 1 });
    const result = classifyFile(file, new Set(), new Map(), 'webtoon');
    expect(result.action).toBe('error');
    expect(result.error).toMatch(/Could not determine index/i);
  });

  it('volume-only file + manga construct → action=create with synthetic index', () => {
    const file = mkFile({ volumeNumber: 1 });
    const result = classifyFile(file, new Set(), new Map(), 'manga');
    expect(result.action).toBe('create');
    expect(result.index).toBe(100001);
  });

  it('chapter file + webtoon construct → action=create with chapter index', () => {
    const file = mkFile({ chapterNumber: 42 });
    const result = classifyFile(file, new Set(), new Map(), 'webtoon');
    expect(result.action).toBe('create');
    expect(result.index).toBe(42);
  });

  it('omitted construct preserves legacy behavior (synthetic for volume-only)', () => {
    const file = mkFile({ volumeNumber: 1 });
    const result = classifyFile(file, new Set(), new Map());
    expect(result.action).toBe('create');
    expect(result.index).toBe(100001);
  });
});
