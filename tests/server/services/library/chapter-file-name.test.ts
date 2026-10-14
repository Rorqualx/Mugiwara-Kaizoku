/**
 * @jest-environment node
 *
 * A file named for one chapter holds that chapter only. Fixtures are real
 * library paths and rows (production copy, 2026-10-14).
 */
import { describe, it, expect } from '@jest/globals';

import {
  chapterNumberFromFileName,
  findChapterFileSquatters,
  isSingleChapterFile,
} from '@/server/services/library/chapter-file-name';

const LIB = '/library/Manga chapters';
const SPY_C119 = `${LIB}/SPY x FAMILY/Chapters/Volume 17/SPY x FAMILY V17 C119.cbz`;
const LAGOON_C085 = `${LIB}/Black Lagoon/Chapters/Volume 12/Black Lagoon V12 C085.cbz`;

describe('chapterNumberFromFileName', () => {
  it.each([
    [SPY_C119, 119],
    [LAGOON_C085, 85],
    [`${LIB}/SPY x FAMILY/Chapters/Volume 16/SPY x FAMILY V16 C112.1.cbz`, 112.1],
    [`${LIB}/Yofukashi no Uta/Chapters/Volume 20/Chapter 200.5.cbz`, 200.5],
    [`${LIB}/Onmyoji/Chapter 0087.cbz`, 87],
    ['/lib/Blue Exorcist/c039.cbz', 39],
    [`${LIB}/The Promised Neverland/Chapters/Volume 01/The Promised Neverland V01 C001`, 1],
    ['/lib/Akira Ch.12.cbz', 12],
    ['/lib/Before Chainsaw Man_ 22-26 V02 C004.jpg', 4],
  ])('%s → %p', (filePath, expected) => {
    expect(chapterNumberFromFileName(filePath)).toBe(expected);
    expect(isSingleChapterFile(filePath)).toBe(true);
  });

  it.each([
    `${LIB}/One Piece/Volumes/One Piece V03.cbz`,
    `${LIB}/Kaiju No.8/Volumes/Kaiju No.8 Vol 05`,
    `${LIB}/Chainsaw Man/Volumes/Chainsaw Man Vol 13`,
    `${LIB}/Black Clover/Volumes/Black Clover V12.cbz`,
    `${LIB}/Attack on Titan No Regrets/Attack on Titan No Regrets v01 (2021).cbz`,
    '/lib/Mob Psycho 100 V01.cbz',
    '/lib/Akira V01.cbr',
    // A range is a multi-chapter archive, not one chapter.
    '/lib/One Piece V01 C001-008.cbz',
    '/lib/Berserk c001 - c016.cbz',
  ])('%s names no single chapter', (filePath) => {
    expect(chapterNumberFromFileName(filePath)).toBeNull();
    expect(isSingleChapterFile(filePath)).toBe(false);
  });

  it('reads only the file name, not its folders', () => {
    expect(chapterNumberFromFileName('/lib/Chapter 12/Volumes/Akira V01.cbr')).toBeNull();
    expect(isSingleChapterFile(null)).toBe(false);
    expect(isSingleChapterFile('')).toBe(false);
  });
});

describe('findChapterFileSquatters', () => {
  it('SPY x FAMILY (83): every numbered row on V17 C119.cbz except chapter 119', () => {
    const rows = [
      { id: 47488, chapterNumber: null, filePath: SPY_C119 },
      { id: 48762, chapterNumber: 118.5, filePath: SPY_C119 },
      { id: 41002, chapterNumber: 119, filePath: SPY_C119 },
      { id: 48789, chapterNumber: 120.1, filePath: SPY_C119 },
      { id: 49097, chapterNumber: 120.5, filePath: SPY_C119 },
      { id: 48763, chapterNumber: 123.1, filePath: SPY_C119 },
      { id: 48792, chapterNumber: 127.3, filePath: SPY_C119 },
      { id: 48764, chapterNumber: 139.1, filePath: SPY_C119 },
      { id: 48765, chapterNumber: 139.2, filePath: SPY_C119 },
      { id: 48793, chapterNumber: 140.1, filePath: SPY_C119 },
      { id: 48766, chapterNumber: 140.5, filePath: SPY_C119 },
    ];
    expect(findChapterFileSquatters(rows).sort()).toEqual(
      [48762, 48763, 48764, 48765, 48766, 48789, 48792, 48793, 49097],
    );
  });

  it('Black Lagoon (68): chapters 92-109 on V12 C085.cbz, not chapter 85 or the numberless rows', () => {
    const rows = [
      { id: 45701, chapterNumber: null, filePath: LAGOON_C085 },
      { id: 45833, chapterNumber: null, filePath: LAGOON_C085 },
      { id: 12066, chapterNumber: 85, filePath: LAGOON_C085 },
      ...Array.from({ length: 18 }, (_, i) => ({ id: 45680 + i, chapterNumber: 92 + i, filePath: LAGOON_C085 })),
    ];
    const squatters = findChapterFileSquatters(rows);
    expect(squatters).toHaveLength(18);
    expect(squatters).not.toContain(12066);
    expect(squatters).not.toContain(45701);
  });

  it('leaves a whole-volume archive shared by its chapters alone', () => {
    const archive = '/lib/One Piece/Volumes/One Piece V03.cbz';
    const rows = [18, 19, 20, 21].map(n => ({ id: n, chapterNumber: n, filePath: archive }));
    expect(findChapterFileSquatters(rows)).toEqual([]);
  });

  it('leaves a shared file with no owning row alone (its numbering may be offset)', () => {
    // Berserk's prologue rows are numbered 0.01-0.24 against files C001-C024.
    const file = '/lib/Berserk/Berserk V01 C001.cbz';
    const rows = [{ id: 1, chapterNumber: 0.01, filePath: file }, { id: 2, chapterNumber: 0.02, filePath: file }];
    expect(findChapterFileSquatters(rows)).toEqual([]);
  });

  it('never flags a row on its own file', () => {
    expect(findChapterFileSquatters([{ id: 1, chapterNumber: 120, filePath: SPY_C119 }])).toEqual([]);
  });
});
