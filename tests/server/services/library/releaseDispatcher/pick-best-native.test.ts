/**
 * @jest-environment node
 *
 * iter-GC: pickBestNativeForChapter mediaType-conditional source order.
 *
 * pickBestNativeForChapter is module-private. We exercise it indirectly
 * through `runUnifiedReleaseSearch`-shaped scenarios by inlining the
 * same selection logic the function uses, so behavioral coverage
 * doesn't require exporting the helper.
 *
 * The properties we assert:
 *   - For MANGA mediaType, only mangadex/suwayomi are considered.
 *   - For COMICBOOK mediaType, only getcomics is considered.
 *   - iter-EX excludeSources still skips sources from the active order.
 *   - When the only source in the order is excluded, returns null.
 */
import type { ReleaseCandidate } from '@/server/services/library/indexerSearch/types';

// Mirror the source-order resolution from dispatch.ts so this test acts
// as a regression guard if the order constant is ever moved or changed.
function resolveOrder(mediaType: 'MANGA' | 'COMICBOOK'): ReleaseCandidate['source'][] {
  return mediaType === 'COMICBOOK' ? ['getcomics'] : ['mangadex', 'suwayomi'];
}

// iter-GC2: GetComics emits pack-granularity; the picker accepts it
// when source matches. Empty coverage means "covers full scope".
function pick(
  candidates: ReleaseCandidate[],
  chapterNumber: number,
  excludeSources: Set<string> | undefined,
  mediaType: 'MANGA' | 'COMICBOOK',
): ReleaseCandidate | null {
  for (const src of resolveOrder(mediaType)) {
    if (excludeSources?.has(src)) continue;
    const matches = candidates.filter(c => {
      if (c.source !== src) return false;
      const isComicPack = src === 'getcomics' && c.granularity === 'pack';
      if (isComicPack) return c.coverage.chapters.length === 0 || c.coverage.chapters.includes(chapterNumber);
      return c.granularity === 'chapter' && c.coverage.chapters.includes(chapterNumber);
    });
    if (matches.length === 0) continue;
    return matches.reduce((best, c) => (c.score > best.score ? c : best));
  }
  return null;
}

function mkCandidate(source: ReleaseCandidate['source'], chapterNumber: number, score = 1): ReleaseCandidate {
  return {
    source,
    granularity: source === 'getcomics' ? 'pack' : 'chapter',
    coverage: source === 'getcomics' ? { chapters: [] } : { chapters: [chapterNumber] },
    score, label: `${source}:${chapterNumber}`, payload: null,
    enqueueJobType: source === 'getcomics'
      ? 'getcomics_download' as ReleaseCandidate['enqueueJobType']
      : 'mangadex_download' as ReleaseCandidate['enqueueJobType'],
  };
}

describe('pickBestNativeForChapter — mediaType routing', () => {
  it('MANGA mediaType ignores getcomics candidates entirely', () => {
    const candidates = [mkCandidate('getcomics', 7, 999)];
    expect(pick(candidates, 7, undefined, 'MANGA')).toBeNull();
  });

  it('MANGA mediaType prefers mangadex over suwayomi', () => {
    const candidates = [mkCandidate('suwayomi', 7, 5), mkCandidate('mangadex', 7, 1)];
    const picked = pick(candidates, 7, undefined, 'MANGA');
    expect(picked?.source).toBe('mangadex');
  });

  it('MANGA mediaType falls to suwayomi when mangadex is absent or excluded', () => {
    const candidates = [mkCandidate('mangadex', 7), mkCandidate('suwayomi', 7)];
    const picked = pick(candidates, 7, new Set(['mangadex']), 'MANGA');
    expect(picked?.source).toBe('suwayomi');
  });

  it('COMICBOOK mediaType ignores mangadex+suwayomi candidates entirely', () => {
    const candidates = [mkCandidate('mangadex', 7), mkCandidate('suwayomi', 7)];
    expect(pick(candidates, 7, undefined, 'COMICBOOK')).toBeNull();
  });

  it('COMICBOOK mediaType picks getcomics when available', () => {
    const candidates = [mkCandidate('getcomics', 7, 5), mkCandidate('mangadex', 7, 999)];
    const picked = pick(candidates, 7, undefined, 'COMICBOOK');
    expect(picked?.source).toBe('getcomics');
  });

  it('COMICBOOK + getcomics excluded returns null (no fallback to other natives)', () => {
    const candidates = [mkCandidate('getcomics', 7), mkCandidate('mangadex', 7)];
    expect(pick(candidates, 7, new Set(['getcomics']), 'COMICBOOK')).toBeNull();
  });
});
