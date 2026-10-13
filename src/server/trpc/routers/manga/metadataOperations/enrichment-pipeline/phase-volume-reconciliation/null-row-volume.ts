/**
 * Filename helpers for volume reconciliation: whole-volume archive detection and the
 * volume a NULL-numbered file row belongs to.
 */

/** Detect if a chapter record is actually a volume-only file (not a chapter file with volume label).
 *  Matches "Manga V01", "Title Vol.3" but NOT "Manga V01 C001" or "Title V01 Chapter 5". */
export function isVolumeFileName(fileName: string | null): boolean {
  if (fileName === null) return false;
  // Must have a volume indicator
  if (!/\bv(?:ol(?:ume)?)?[.\s-]*\d+/i.test(fileName)) return false;
  // Must NOT also have a chapter indicator (C001, Ch.5, Chapter 3, etc.)
  return !/\bc(?:h(?:apter)?)?[.\s-]*\d+/i.test(fileName);
}

/** Extract volume number from a volume filename (e.g., "Manga V03" → 3) */
export function extractVolumeNumberFromFileName(fileName: string): number | null {
  const match = fileName.match(/\bv(?:ol(?:ume)?)?[.\s-]*(\d+)/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

export interface VolumeRange { id: number; number: number; chapterStart: number | null; chapterEnd: number | null }

/**
 * Resolve the real volume for a NULL-numbered file row.
 *
 * A whole-volume archive ("v20.zip") maps by its filename volume number. A chapter file
 * ("Chapter 167.75.cbz") maps by the volume range containing floor(its filename number). Returns
 * null when no existing volume fits — we never invent a volume from a filename.
 */
export function resolveNullRowVolume(
  fileName: string,
  volumes: VolumeRange[],
  volIdByNumber: Map<number, number>,
): { id: number; number: number } | null {
  if (isVolumeFileName(fileName)) {
    const fileVol = extractVolumeNumberFromFileName(fileName);
    const volId = fileVol !== null ? volIdByNumber.get(fileVol) : undefined;
    return fileVol !== null && volId !== undefined ? { id: volId, number: fileVol } : null;
  }
  // A chapter token ("C251", "Chapter 167.75") names the chapter; the first number in the name can be
  // a scanlation volume label: "Sakamoto Days V26 C251.cbz" was homed to the volume holding chapter 26.
  const match = fileName.match(/\bc(?:h(?:apter)?)?[.\s_-]*(\d+(?:\.\d+)?)/i) ?? fileName.match(/(\d+(?:\.\d+)?)/);
  if (!match?.[1]) return null;
  const floor = Math.floor(parseFloat(match[1]));
  for (const v of volumes) {
    if (v.chapterStart === null || v.chapterEnd === null) continue;
    if (floor >= v.chapterStart && floor <= v.chapterEnd) return { id: v.id, number: v.number };
  }
  return null;
}
