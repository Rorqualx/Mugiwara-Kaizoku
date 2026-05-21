/**
 * Result Converters for Adaptive Parser
 *
 * Converts parser-specific result types to the standard VolumeData/ChapterData format
 * used by the orchestrator.
 *
 * @module orchestrator/result-converters
 */

import type { ChapterData, VolumeData } from '@/server/services/metadata/utils/fandom-table-parser/fandom-types';

import type { AlternatingRowParseResult } from '../alternating-row-parser';
import type { ArcBasedParseResult } from '../arc-based-parser';
import type { BulletedParseResult } from '../bulleted-list-parser';
import type { CategoryPageResult } from '../category-page-parser';
import type { CollapsibleTableResult } from '../collapsible-table-parser';
import type { IdVolumeTableResult } from '../id-volume-table-parser';
import type { JoJoParseResult } from '../jojo-parser';
import type { NumberedRowParseResult } from '../numbered-row-parser';
import type { ParagraphLinkParseResult } from '../paragraph-link-parser';
import type { PerVolumeIteratorResult } from '../per-volume-iterator';
import type { PlainTableParseResult } from '../plain-table-parser';
import type { ShiftedColumnParseResult } from '../shifted-column-parser';

/** Standard parsed data format */
export interface StandardParsedData {
  volumes: VolumeData[];
  chapters: ChapterData[];
}

/**
 * Converts bulleted list parse result to standard format.
 */
export function convertBulletedToStandard(result: BulletedParseResult): StandardParsedData {
  return {
    volumes: result.volumes.map((v) => {
      const vol: VolumeData = { number: v.number };
      if (v.title) vol.title = v.title;
      if (v.coverImage) vol.coverImage = v.coverImage;
      return vol;
    }),
    chapters: result.chapters.map((ch) => {
      const chapter: ChapterData = {
        number: ch.number,
        volume: ch.volumeNumber,
      };
      if (ch.title) chapter.title = ch.title;
      if (ch.url) chapter.url = ch.url;
      return chapter;
    }),
  };
}

/**
 * Converts plain table parse result to standard format.
 */
export function convertPlainTableToStandard(result: PlainTableParseResult): StandardParsedData {
  return {
    volumes: result.volumes.map((v) => {
      const vol: VolumeData = { number: v.number };
      if (v.title) vol.title = v.title;
      if (v.coverImage) vol.coverImage = v.coverImage;
      if (v.releaseDate) vol.releaseDate = v.releaseDate;
      if (v.isbn) vol.isbn = v.isbn;
      if (v.pages) vol.pageCount = v.pages;
      return vol;
    }),
    chapters: result.chapters.map((ch) => {
      const chapter: ChapterData = {
        number: ch.number,
        volume: ch.volumeNumber,
      };
      if (ch.title) chapter.title = ch.title;
      if (ch.url) chapter.url = ch.url;
      if (ch.releaseDate) chapter.releaseDate = ch.releaseDate;
      return chapter;
    }),
  };
}

/**
 * Converts an arc volume to standard VolumeData format.
 */
function convertArcVolumeToStandard(arcVol: ArcBasedParseResult['arcs'][number]['volumes'][number]): VolumeData {
  const volNumber = arcVol.globalVolumeNumber ?? arcVol.volumeNumber;
  const vol: VolumeData = { number: volNumber };
  if (arcVol.coverImage) vol.coverImage = arcVol.coverImage;
  return vol;
}

/**
 * Extracts chapters from an arc volume into standard ChapterData format.
 */
function extractChaptersFromArcVolume(
  arcVol: ArcBasedParseResult['arcs'][number]['volumes'][number]
): ChapterData[] {
  const volNumber = arcVol.globalVolumeNumber ?? arcVol.volumeNumber;
  return arcVol.chapters.map((arcCh) => {
    const chapter: ChapterData = { number: arcCh.chapterNumber, volume: volNumber };
    if (arcCh.title) chapter.title = arcCh.title;
    if (arcCh.url) chapter.url = arcCh.url;
    return chapter;
  });
}

/**
 * Converts arc-based parse result to standard format.
 * Flattens the arc → volume → chapter hierarchy.
 */
export function convertArcBasedToStandard(result: ArcBasedParseResult): StandardParsedData {
  const volumes: VolumeData[] = [];
  const chapters: ChapterData[] = [];

  for (const arc of result.arcs) {
    for (const arcVol of arc.volumes) {
      volumes.push(convertArcVolumeToStandard(arcVol));
      chapters.push(...extractChaptersFromArcVolume(arcVol));
    }
  }

  return { volumes, chapters };
}

/**
 * Maps a numbered row volume to VolumeData, including nested chapters.
 */
function mapNumberedRowVolume(v: NumberedRowParseResult['volumes'][number]): VolumeData {
  const vol: VolumeData = { number: v.number };
  if (v.title) vol.title = v.title;
  if (v.description) vol.description = v.description;
  if (v.coverImage) vol.coverImage = v.coverImage;
  if (v.releaseDate) vol.releaseDate = v.releaseDate;
  if (v.releaseDateEn) vol.releaseDateEn = v.releaseDateEn;
  if (v.isbn) vol.isbn = v.isbn;
  if (v.isbnEn) vol.isbnEn = v.isbnEn;
  if (v.chapters.length > 0) {
    vol.chapters = v.chapters.map((ch) => ({
      number: ch.number,
      title: ch.title,
      url: ch.url,
    }));
  }
  if (v.url) vol.url = v.url;
  if (v.pages) vol.pageCount = v.pages;
  return vol;
}

/**
 * Converts numbered row parse result to standard format.
 */
export function convertNumberedRowToStandard(result: NumberedRowParseResult): StandardParsedData {
  return {
    volumes: result.volumes.map(mapNumberedRowVolume),
    chapters: result.chapters.map((ch) => {
      const chapter: ChapterData = { number: ch.number, volume: ch.volumeNumber };
      if (ch.title) chapter.title = ch.title;
      if (ch.url) chapter.url = ch.url;
      return chapter;
    }),
  };
}

/**
 * Converts alternating row parse result to standard format.
 */
export function convertAlternatingRowToStandard(result: AlternatingRowParseResult): StandardParsedData {
  return {
    volumes: result.volumes.map((v) => {
      const vol: VolumeData = { number: v.number };
      if (v.title) vol.title = v.title;
      if (v.coverImage) vol.coverImage = v.coverImage;
      if (v.releaseDate) vol.releaseDate = v.releaseDate;
      return vol;
    }),
    chapters: result.chapters.map((ch) => {
      const chapter: ChapterData = { number: ch.number, volume: ch.volumeNumber };
      if (ch.title) chapter.title = ch.title;
      if (ch.url) chapter.url = ch.url;
      return chapter;
    }),
  };
}

/**
 * Maps a category page volume to VolumeData.
 */
function mapCategoryVolume(v: CategoryPageResult['volumes'][number]): VolumeData {
  const vol: VolumeData = { number: v.number };
  if (v.title) vol.title = v.title;
  if (v.coverImage) vol.coverImage = v.coverImage;
  return vol;
}

/**
 * Maps a category page chapter to ChapterData.
 */
function mapCategoryChapter(ch: CategoryPageResult['chapters'][number]): ChapterData {
  const chapter: ChapterData = { number: ch.number };
  if (ch.volumeNumber !== undefined) chapter.volume = ch.volumeNumber;
  if (ch.title) chapter.title = ch.title;
  if (ch.url) chapter.url = ch.url;
  return chapter;
}

/**
 * Converts category page parse result to standard format.
 */
export function convertCategoryPageToStandard(result: CategoryPageResult): StandardParsedData {
  return {
    volumes: result.volumes.map(mapCategoryVolume),
    chapters: result.chapters.map(mapCategoryChapter),
  };
}

/**
 * Maps a collapsible table volume to VolumeData.
 */
function mapCollapsibleVolume(v: CollapsibleTableResult['volumes'][number]): VolumeData {
  const vol: VolumeData = { number: v.number };
  if (v.title) vol.title = v.title;
  if (v.coverImage) vol.coverImage = v.coverImage;
  if (v.releaseDate) vol.releaseDate = v.releaseDate;
  return vol;
}

/**
 * Maps a collapsible table chapter to ChapterData.
 */
function mapCollapsibleChapter(ch: CollapsibleTableResult['chapters'][number]): ChapterData {
  const chapter: ChapterData = { number: ch.number, volume: ch.volumeNumber };
  if (ch.title) chapter.title = ch.title;
  if (ch.url) chapter.url = ch.url;
  return chapter;
}

/**
 * Converts collapsible table parse result to standard format.
 */
export function convertCollapsibleTableToStandard(result: CollapsibleTableResult): StandardParsedData {
  return {
    volumes: result.volumes.map(mapCollapsibleVolume),
    chapters: result.chapters.map(mapCollapsibleChapter),
  };
}

/**
 * Converts per-volume iterator chapters to standard ChapterData format.
 */
export function convertPerVolumeChaptersToStandard(result: PerVolumeIteratorResult): ChapterData[] {
  const chapters: ChapterData[] = [];

  for (const vol of result.volumes) {
    for (const ch of vol.chapters) {
      const chapter: ChapterData = {
        number: ch.number,
        volume: ch.volumeNumber,
      };
      if (ch.title) chapter.title = ch.title;
      if (ch.url) chapter.url = ch.url;
      if (ch.coverImage) chapter.coverImage = ch.coverImage;
      if (ch.summary) chapter.summary = ch.summary;
      chapters.push(chapter);
    }
  }

  return chapters;
}

/**
 * Converts per-volume iterator volumes to standard VolumeData format.
 * Includes description from Publisher Summary sections on individual volume pages.
 */
export function convertPerVolumeVolumesToStandard(result: PerVolumeIteratorResult): VolumeData[] {
  return result.volumes.map((v) => {
    const vol: VolumeData = { number: v.volumeNumber };
    if (v.title) vol.title = v.title;
    if (v.description) vol.description = v.description;
    if (v.coverImage) vol.coverImage = v.coverImage;
    if (v.releaseDate) vol.releaseDate = v.releaseDate;
    if (v.pageCount) vol.pageCount = v.pageCount;
    if (v.chapters.length > 0) {
      vol.chapters = v.chapters.map((ch) => ({
        number: ch.number,
        title: ch.title,
        url: ch.url,
        coverImage: ch.coverImage,
        summary: ch.summary,
      }));
    }
    return vol;
  });
}

/**
 * Converts per-volume iterator result to full standard format.
 */
export function convertPerVolumeToStandard(result: PerVolumeIteratorResult): StandardParsedData {
  return {
    volumes: convertPerVolumeVolumesToStandard(result),
    chapters: convertPerVolumeChaptersToStandard(result),
  };
}

/**
 * Converts paragraph link parse result to standard format.
 */
export function convertParagraphLinkToStandard(result: ParagraphLinkParseResult): StandardParsedData {
  return {
    volumes: result.volumes.map((v) => {
      const vol: VolumeData = { number: v.number };
      if (v.title) vol.title = v.title;
      if (v.coverImage) vol.coverImage = v.coverImage;
      return vol;
    }),
    chapters: result.chapters.map((ch) => {
      const chapter: ChapterData = { number: ch.number };
      if (ch.volume !== undefined) chapter.volume = ch.volume;
      if (ch.title) chapter.title = ch.title;
      if (ch.url) chapter.url = ch.url;
      return chapter;
    }),
  };
}

/**
 * Converts shifted column parse result to standard format.
 */
export function convertShiftedColumnToStandard(result: ShiftedColumnParseResult): StandardParsedData {
  return {
    volumes: result.volumes.map((v) => {
      const vol: VolumeData = { number: v.number };
      if (v.title) vol.title = v.title;
      // Note: VolumeData doesn't have url property, but chapters do
      return vol;
    }),
    chapters: result.chapters.map((ch) => {
      const chapter: ChapterData = { number: ch.number };
      if (ch.volumeNumber !== undefined) chapter.volume = ch.volumeNumber;
      if (ch.title) chapter.title = ch.title;
      if (ch.url) chapter.url = ch.url;
      return chapter;
    }),
  };
}

/**
 * Converts id-based volume table parse result to standard format.
 */
export function convertIdVolumeTableToStandard(result: IdVolumeTableResult): StandardParsedData {
  return {
    volumes: result.volumes.map((v) => {
      const vol: VolumeData = { number: v.number };
      if (v.title) vol.title = v.title;
      if (v.coverImage) vol.coverImage = v.coverImage;
      return vol;
    }),
    chapters: result.chapters.map((ch) => {
      const chapter: ChapterData = { number: ch.number, volume: ch.volumeNumber };
      if (ch.title) chapter.title = ch.title;
      if (ch.url) chapter.url = ch.url;
      return chapter;
    }),
  };
}

/**
 * Converts JoJo parse result to standard format.
 */
export function convertJoJoToStandard(result: JoJoParseResult): StandardParsedData {
  return {
    volumes: result.volumes.map((v) => {
      const vol: VolumeData = { number: v.number };
      if (v.title) vol.title = v.title;
      return vol;
    }),
    chapters: result.chapters.map((ch) => {
      const chapter: ChapterData = { number: ch.number, volume: ch.volumeNumber };
      if (ch.title) chapter.title = ch.title;
      return chapter;
    }),
  };
}
