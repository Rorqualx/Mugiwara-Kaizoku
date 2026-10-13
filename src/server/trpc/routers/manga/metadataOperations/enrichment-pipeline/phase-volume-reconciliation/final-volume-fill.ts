/**
 * The final volume of a finished series, when no provider gives it a range.
 *
 * Dr. STONE's volume 27 collects chapters 233-236 (an epilogue and "4D
 * Science"). No provider numbers them: Wikipedia lists "One-shot" and
 * "1D"-"3D", MangaDex stops at volume 23, and ComicVine's issue has no
 * description. The series' stored chapter count (236, kept by the
 * collected-chapter floor) and volume 26's end (232) bound it, so the range is
 * 233-236, written with source 'interpolated', never under a provider's name.
 */

/** A volume row as the gap filler reads it. */
export interface FinalFillVolumeRow { id: number; number: number; chapterStart: number | null; chapterEnd: number | null }

/** The stored series facts the fill relies on. */
export interface FinalFillSeries { status: string; chapters: number | null; volumes: number | null }

/**
 * The range for the last volume, or null. Only when the series is finished,
 * its stored volume count names this volume, the volume right before it has a
 * range, and the stored chapter count lies past that range.
 */
export function finalVolumeFill(
  volumes: FinalFillVolumeRow[],
  series: FinalFillSeries | null,
): { id: number; volNumber: number; chapterStart: number; chapterEnd: number } | null {
  if (series?.status !== 'COMPLETED') return null;
  const last = volumes.at(-1);
  const before = volumes.at(-2);
  if (!last || !before || last.chapterStart !== null || last.chapterEnd !== null) return null;
  if (series.volumes === null || last.number !== series.volumes || before.number !== last.number - 1) return null;
  if (before.chapterEnd === null || series.chapters === null) return null;
  const start = Math.floor(before.chapterEnd) + 1;
  if (series.chapters < start) return null;
  return { id: last.id, volNumber: last.number, chapterStart: start, chapterEnd: series.chapters };
}
