/**
 * Which numberless volume-archive rows take which provider chapter number.
 *
 * A whole-volume archive (`Vol 03.cbz`) is one Chapter row with a file and no
 * chapter number. In a library that holds only archives, that row is paired
 * with the first chapter of its volume so the merge does not create a
 * duplicate PENDING row for it (Chainsaw Man Colored). Pairing is by position:
 * the first archive row of a volume with the volume's first chapter, the
 * second with the second.
 */

import type { ProviderChapter } from '../types';

/** The fields of an existing Chapter row the pairing reads. */
export interface PairableChapter {
  id: number;
  index: number;
  chapterNumber: number | null;
  filePath: string | null;
  volume: number | null;
}

export interface PhantomPair<T extends PairableChapter> {
  phantom: T;
  providerChapter: ProviderChapter;
}

function indexPhantomsByVolume<T extends PairableChapter>(existing: T[]): Map<number, T[]> {
  const byVolume = new Map<number, T[]>();
  for (const ch of existing) {
    if (ch.chapterNumber !== null || ch.filePath === null || ch.volume === null) continue;
    const rows = byVolume.get(ch.volume) ?? [];
    rows.push(ch);
    byVolume.set(ch.volume, rows);
  }
  return byVolume;
}

/**
 * Plan the pairs. An archive row whose positional chapter number already has
 * a row stays numberless: the library also holds that chapter on its own, and
 * the archive is the volume, not a chapter. It must not slide to the next
 * free number — that labelled Attack on Titan's volume 34 archive "chapter
 * 144" and SPY x FAMILY's volume 1 archive "Chapter 5.5".
 */
export function planPhantomPairs<T extends PairableChapter>(
  existing: T[],
  providerChapters: ProviderChapter[],
): Array<PhantomPair<T>> {
  const taken = new Set(existing.flatMap(ch => (ch.chapterNumber === null ? [] : [ch.chapterNumber])));
  const pairs: Array<PhantomPair<T>> = [];
  for (const [volume, phantoms] of indexPhantomsByVolume(existing)) {
    phantoms.sort((a, b) => a.index - b.index);
    const volumeChapters = providerChapters
      .filter(p => p.volume === volume)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
    phantoms.forEach((phantom, position) => {
      const providerChapter = volumeChapters[position];
      if (!providerChapter || taken.has(providerChapter.chapterNumber)) return;
      taken.add(providerChapter.chapterNumber);
      pairs.push({ phantom, providerChapter });
    });
  }
  return pairs;
}
