/**
 * Volume details for a band parse
 *
 * The band parser reads which chapters each volume holds, not the volume's
 * own fields. The older table parser reads those from the same page (Sakamoto
 * Days: "Tenkyu vs. Shin", cover, release dates, ISBNs), and without them a
 * refresh wiped the titles stored for volumes 22-28. A volume takes the other
 * parse's fields only when that parse filed mostly the same chapters under
 * the same number: on SPY x FAMILY the table parser's volumes are the
 * spin-off novels, one volume off, and their titles must not be copied.
 *
 * @module volume-band-parser/volume-details
 */

import type { ChapterData, VolumeData } from '@/server/services/metadata/utils/fandom-table-parser/fandom-types';

interface ParsedPage {
  volumes: VolumeData[];
  chapters: ChapterData[];
}

/** Share of a band volume's chapters the other parse must also file under that number. */
const MIN_AGREEMENT = 0.5;

const DETAIL_FIELDS = [
  'title', 'alternativeTitle', 'description', 'coverImage', 'releaseDate', 'releaseDateEn',
  'isbn', 'isbnEn', 'url', 'pageCount',
] as const;

function chaptersByVolume(page: ParsedPage): Map<number, Set<number>> {
  const byVolume = new Map<number, Set<number>>();
  const add = (volume: number, chapter: number): void => {
    const set = byVolume.get(volume) ?? new Set<number>();
    set.add(chapter);
    byVolume.set(volume, set);
  };
  for (const ch of page.chapters) if (ch.volume !== undefined) add(ch.volume, ch.number);
  for (const vol of page.volumes) {
    for (const ch of vol.chapters ?? []) {
      const n = typeof ch === 'number' ? ch : Number((ch as { number?: unknown }).number);
      if (Number.isFinite(n)) add(vol.number, n);
    }
  }
  return byVolume;
}

/** The band volumes with missing fields filled from `other` where the two parses agree. */
export function withVolumeDetails(band: ParsedPage, other: ParsedPage): VolumeData[] {
  const bandChapters = chaptersByVolume(band);
  const otherChapters = chaptersByVolume(other);
  const otherVolumes = new Map(other.volumes.map(v => [v.number, v]));

  return band.volumes.map(volume => {
    const source = otherVolumes.get(volume.number);
    const mine = bandChapters.get(volume.number);
    const theirs = otherChapters.get(volume.number);
    if (!source || !mine || !theirs || mine.size === 0) return volume;
    const shared = [...mine].filter(n => theirs.has(n)).length;
    if (shared / mine.size < MIN_AGREEMENT) return volume;

    const filled: VolumeData = { ...volume };
    for (const field of DETAIL_FIELDS) {
      const value = source[field];
      if (value === undefined || value === '' || filled[field] !== undefined) continue;
      if (field === 'title' && /^Volume\s*\d+$/i.test(String(value))) continue;
      Object.assign(filled, { [field]: value });
    }
    return filled;
  });
}
