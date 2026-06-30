/**
 * @jest-environment node
 *
 * Guards the shared title-aware phantom classifier used by both the live pipeline
 * (chapter-level loose-phantom prune) and the cleanup survey script.
 *
 * Regression target: a reidentify of Berserk (finished by stored endDate but
 * RELEASING on live AniList) regenerated loose generic chapters 386-441 past the
 * real final chapter; the classifier must drop those generics while keeping real
 * recent titled chapters (384/385), decimals, and downloads — and skip the whole
 * title when the scalar is untrustworthy.
 */
import { classifyPhantomChapters, type PhantomClassifiableChapter } from '../types';

let nextId = 1;
function ch(
  chapterNumber: number | null,
  title: string,
  opts: { pageCount?: number | null; filePath?: string | null } = {},
): PhantomClassifiableChapter {
  return {
    id: nextId++,
    chapterNumber,
    title,
    pageCount: opts.pageCount ?? null,
    filePath: opts.filePath ?? null,
  };
}

const nums = (rows: PhantomClassifiableChapter[]): number[] =>
  rows.map(r => r.chapterNumber as number).sort((a, b) => a - b);

describe('classifyPhantomChapters', () => {
  it('drops generic over-ceiling rows, keeps decimals', () => {
    const beyond = [ch(386, 'Chapter 386'), ch(387, 'Chapter 387'), ch(388.5, 'Special')];
    const dropped = classifyPhantomChapters(beyond, new Set(), 300, 385);
    expect(nums(dropped)).toEqual([386, 387]); // 388.5 decimal kept
  });

  it('keeps a real-titled over-ceiling chapter (within the distinct-real tolerance)', () => {
    const beyond = [ch(386, 'The Dawn of Better Fortune'), ch(387, 'Chapter 387')];
    const dropped = classifyPhantomChapters(beyond, new Set(), 300, 385);
    expect(nums(dropped)).toEqual([387]); // 386 has a real title → kept
  });

  it('drops a superset-duplicate finale title (AoT 144 ⊇ ch 139)', () => {
    const inRange = new Set(['toward the tree on that hill']);
    const beyond = [ch(144, 'Final Episode: Toward the Tree on That Hill')];
    const dropped = classifyPhantomChapters(beyond, inRange, 130, 139);
    expect(nums(dropped)).toEqual([144]);
  });

  it('skips the whole title when a download sits beyond the ceiling (scalar undercounts)', () => {
    const beyond = [ch(400, 'Chapter 400')];
    const dropped = classifyPhantomChapters(beyond, new Set(), 420, 385); // maxFileBacked 420 > 385
    expect(dropped).toEqual([]);
  });

  it('skips the whole title when >2 distinct-real-titled rows sit beyond the ceiling', () => {
    const beyond = [
      ch(386, 'Real Chapter A'), ch(387, 'Real Chapter B'),
      ch(388, 'Real Chapter C'), ch(389, 'Chapter 389'),
    ];
    const dropped = classifyPhantomChapters(beyond, new Set(), 300, 385);
    expect(dropped).toEqual([]); // even the generic 389 is spared — title untrusted
  });

  it('never drops a file-backed over-ceiling row (kept via undercount guard)', () => {
    const beyond = [ch(386, 'Chapter 386', { pageCount: 20, filePath: '/x/386.cbz' })];
    // a file-backed beyond row means maxFileBacked > ceiling → skip all
    const dropped = classifyPhantomChapters(beyond, new Set(), 386, 385);
    expect(dropped).toEqual([]);
  });
});
