/**
 * @jest-environment node
 *
 * Guards the shared title-aware phantom classifier used by both the live pipeline
 * (chapter-level phantom prune) and the cleanup survey script.
 *
 * The caller pre-filters `beyond` to rows past the real extent
 * (max(scalar, highest downloaded chapter)), so real downloads past a stale
 * scalar are never passed in. Regression targets (prod):
 *   - Berserk: files through 390 (scalar 384), then generic 391-395 -> drop generics.
 *   - One Piece: real through 1185, then generic ERROR 1186-1207 -> drop generics.
 *   - Naruto: real titled 701-710 (Gaiden) past 700 -> skip whole title (>2 real).
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
  it('drops generic beyond-extent rows, keeps decimals', () => {
    const beyond = [ch(386, 'Chapter 386'), ch(387, 'Chapter 387'), ch(388.5, 'Special')];
    expect(nums(classifyPhantomChapters(beyond, new Set()))).toEqual([386, 387]);
  });

  it('Berserk: drops the generic tail past the downloads', () => {
    const beyond = [391, 392, 393, 394, 395].map(n => ch(n, `Chapter ${n}`));
    expect(nums(classifyPhantomChapters(beyond, new Set()))).toEqual([391, 392, 393, 394, 395]);
  });

  it('One Piece: drops generic ERROR placeholders past the downloads', () => {
    const beyond = [1186, 1187, 1188].map(n => ch(n, `Chapter ${n}`));
    expect(nums(classifyPhantomChapters(beyond, new Set()))).toEqual([1186, 1187, 1188]);
  });

  it('keeps a real-titled beyond-extent chapter (within the distinct-real tolerance)', () => {
    const beyond = [ch(386, 'The Dawn of Better Fortune'), ch(387, 'Chapter 387')];
    expect(nums(classifyPhantomChapters(beyond, new Set()))).toEqual([387]);
  });

  it('Naruto: skips the whole title when >2 distinct real titles continue past the scalar', () => {
    const beyond = [
      ch(701, 'Sarada Uchiha'), ch(702, 'The Boy with the Sharingan'),
      ch(703, 'A Chance Meeting'), ch(711, 'Chapter 711'),
    ];
    expect(classifyPhantomChapters(beyond, new Set())).toEqual([]);
  });

  it('drops a superset-duplicate finale title (AoT 144 superset of ch 139)', () => {
    const inRange = new Set(['toward the tree on that hill']);
    const beyond = [ch(144, 'Final Episode: Toward the Tree on That Hill')];
    expect(nums(classifyPhantomChapters(beyond, inRange))).toEqual([144]);
  });

  it('never drops a file-backed beyond-extent row', () => {
    const beyond = [ch(386, 'Chapter 386', { pageCount: 20, filePath: '/x/386.cbz' })];
    expect(classifyPhantomChapters(beyond, new Set())).toEqual([]);
  });
});
