/**
 * ComicVine numbering shifted by one
 *
 * A ComicVine volume description sometimes numbers its whole chapter list one
 * off. Bleach volume 60 lists "Chapter 532: … Op. 4" through "Chapter 541: The
 * Sword Five", while the real chapters are 531–540: chapter 531 looks missing
 * and 541 looks shared with volume 61, whose own list starts with the real
 * "Chapter 541: The Blade and Me 2".
 *
 * The sign is that both ends are off by the same one chapter in the same
 * direction: one missing chapter before the volume and one chapter shared with
 * the next (shifted up), or one shared with the previous and one missing
 * after (shifted down). Either end alone is ordinary (a skipped extra, a
 * chapter split across volumes) and is left alone.
 */

/** A volume's first and last whole chapter as a description numbers them. */
export interface NumberedVolumeRange {
  volume: number;
  start: number;
  end: number;
}

/**
 * Volumes whose numbering is shifted, mapped to the correction to add to every
 * chapter number in them (-1 when listed one too high, +1 when one too low).
 * Only volumes with both neighbouring volume numbers present are judged.
 */
export function findShiftedNumbering(ranges: NumberedVolumeRange[]): Map<number, 1 | -1> {
  const byVolume = new Map(ranges.map(r => [r.volume, r]));
  const shifts = new Map<number, 1 | -1>();
  for (const cur of ranges) {
    const prev = byVolume.get(cur.volume - 1);
    const next = byVolume.get(cur.volume + 1);
    if (!prev || !next || cur.end <= cur.start) continue;
    if (cur.start === prev.end + 2 && cur.end === next.start) shifts.set(cur.volume, -1);
    else if (cur.start === prev.end && cur.end === next.start - 2) shifts.set(cur.volume, 1);
  }
  return shifts;
}
