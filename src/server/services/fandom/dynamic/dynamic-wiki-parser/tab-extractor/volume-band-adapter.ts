/**
 * Dynamic Wiki Parser - Volume Band Adapter
 *
 * Tabbed Fandom list pages (Call of the Night, My Hero Academia, Demon Slayer,
 * Spy x Family, ...) render one shared table where each volume's cover-art
 * tabber ("Japanese" / "English") is followed by its chapter row. The band
 * parser in the adaptive module already reads that shape; this adapter runs it
 * and converts its flat result into the dynamic parser's shape (volume title
 * required, chapters nested in their volume, chapter number as a string).
 *
 * @module dynamic-wiki-parser/tab-extractor/volume-band-adapter
 */

import { isVolumeBandStructure, parseVolumeBands } from '@/server/services/fandom/adaptive/volume-band-parser';

import type { ChapterData, VolumeData } from '../types';

export interface VolumeBandData {
  volumes: VolumeData[];
  /** Every chapter, including those not yet collected in a volume. */
  chapters: ChapterData[];
}

/** Origin of a page URL ("https://x.fandom.com"), or '' when it is not a URL. */
function originOf(pageUrl: string): string {
  try {
    return new URL(pageUrl).origin;
  } catch {
    return '';
  }
}

/**
 * Volumes and chapters from a page's volume bands, or null when the page has
 * no volume markers or the band parse is rejected (overlapping volumes, too
 * few volumes), so the caller falls back to its own extraction.
 */
export function extractVolumeBandData(html: string, pageUrl: string): VolumeBandData | null {
  if (!isVolumeBandStructure(html)) return null;
  const result = parseVolumeBands(html, originOf(pageUrl));
  if (!result.success || result.chapters.length === 0) return null;

  const chapters: ChapterData[] = result.chapters.map(ch => {
    const chapter: ChapterData = { number: String(ch.number), title: ch.title ?? `Chapter ${ch.number}` };
    if (ch.url !== undefined) chapter.url = ch.url;
    if (ch.volume !== undefined) chapter.volume = ch.volume;
    return chapter;
  });
  const volumes: VolumeData[] = result.volumes.map(vol => ({
    number: vol.number,
    title: vol.title ?? `Volume ${vol.number}`,
    chapters: chapters.filter(ch => ch.volume === vol.number),
  }));
  return { volumes, chapters };
}
