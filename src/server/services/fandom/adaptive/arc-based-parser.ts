/**
 * Arc-Based Parser for Fandom Wikis
 *
 * Handles wikis with arc-based manga series like Re:Zero, where
 * the manga is split into multiple arc adaptations (Arc 1, Arc 2, etc.),
 * each with its own set of volumes and chapters.
 *
 * @module arc-based-parser
 */

import { load } from 'cheerio';

import { logger } from '@/utils/logger';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

/** Represents a single arc in an arc-based manga series. */
export interface ArcInfo {
  arcNumber: number;
  title: string;
  arcPageUrl?: string;
  volumes: ArcVolume[];
}

/** Represents a volume within an arc. */
export interface ArcVolume {
  volumeNumber: number;
  globalVolumeNumber?: number;
  volumePageUrl?: string;
  coverImage?: string;
  chapters: ArcChapter[];
}

/** Represents a chapter within a volume. */
export interface ArcChapter {
  chapterNumber: number;
  title?: string;
  url?: string;
  arcNumber: number;
  volumeNumber: number;
}

/** Result of arc-based parsing. */
export interface ArcBasedParseResult {
  seriesTitle: string;
  arcs: ArcInfo[];
  totalVolumes: number;
  totalChapters: number;
  success: boolean;
}

function extractArcNumber(text: string): number | null {
  const match = text.match(/Arc\s*(\d+)/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

function extractVolumeNumber(text: string): number | null {
  const match = text.match(/(?:Volume|Vol\.?)\s*(\d+)/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

function createVolumeFromLink(volNum: number, href: string, coverImage?: string): ArcVolume {
  const volume: ArcVolume = { volumeNumber: volNum, chapters: [] };
  if (href.startsWith('/wiki/')) volume.volumePageUrl = href;
  if (coverImage) volume.coverImage = coverImage;
  return volume;
}

function processVolumeLink(
  $link: Cheerio<Element>,
  volumePattern: RegExp,
  seenVolumes: Set<number>
): ArcVolume | null {
  const text = $link.text().trim();
  const title = $link.attr('title') ?? '';
  const href = $link.attr('href') ?? '';

  const textMatch = text.match(volumePattern) ?? title.match(volumePattern);
  if (!textMatch?.[1]) return null;

  const volNum = parseInt(textMatch[1], 10);
  if (seenVolumes.has(volNum)) return null;

  seenVolumes.add(volNum);
  const $img = $link.find('img').first();
  const coverImage = $img.attr('data-src') ?? $img.attr('src');

  return createVolumeFromLink(volNum, href, coverImage);
}

function extractVolumesFromGallery(
  $: CheerioAPI,
  arcNum: number,
  seenVolumes: Set<number>
): ArcVolume[] {
  const volumes: ArcVolume[] = [];
  const volumePattern = new RegExp(`Arc\\s*${arcNum}\\s*(?:Volume|Vol\\.?)\\s*(\\d+)`, 'i');

  $('a').each((_, link) => {
    const volume = processVolumeLink($(link), volumePattern, seenVolumes);
    if (volume) volumes.push(volume);
  });

  return volumes;
}

function extractVolumesFromElement(
  $: CheerioAPI,
  $element: Cheerio<Element>,
  seenVolumes: Set<number>
): ArcVolume[] {
  const volumes: ArcVolume[] = [];

  $element.find('a[href*="/wiki/"]').each((_, link) => {
    const $link = $(link);
    const volNum = extractVolumeNumber($link.text().trim());

    if (volNum !== null && !seenVolumes.has(volNum)) {
      seenVolumes.add(volNum);
      const href = $link.attr('href') ?? '';
      volumes.push(createVolumeFromLink(volNum, href));
    }
  });

  return volumes;
}

function extractVolumesFromArcSection(
  $: CheerioAPI,
  arcNum: number,
  seenVolumes: Set<number>
): ArcVolume[] {
  const volumes: ArcVolume[] = [];

  $(`h2:contains("Arc ${arcNum}"), h3:contains("Arc ${arcNum}")`).each((_, header) => {
    let $next = $(header).next();
    let attempts = 0;

    while ($next.length && attempts < 10) {
      if ($next.is('h2, h3') && extractArcNumber($next.text()) !== null) break;
      volumes.push(...extractVolumesFromElement($, $next, seenVolumes));
      $next = $next.next();
      attempts++;
    }
  });

  return volumes;
}

function extractVolumesFromSection($: CheerioAPI, arcNum: number): ArcVolume[] {
  const seenVolumes = new Set<number>();
  const galleryVolumes = extractVolumesFromGallery($, arcNum, seenVolumes);
  const sectionVolumes = extractVolumesFromArcSection($, arcNum, seenVolumes);
  const allVolumes = [...galleryVolumes, ...sectionVolumes];
  allVolumes.sort((a, b) => a.volumeNumber - b.volumeNumber);
  return allVolumes;
}

function detectArcSections($: CheerioAPI): ArcInfo[] {
  const arcs: ArcInfo[] = [];
  const seenArcs = new Set<number>();

  $('h2, h3').each((_, header) => {
    const $header = $(header);
    const text = $header.text().trim();
    const arcNum = extractArcNumber(text);

    if (arcNum === null || seenArcs.has(arcNum)) return;
    seenArcs.add(arcNum);

    const titleMatch = text.match(/Arc\s*\d+[:\s-]*(.+)/i);
    const title = titleMatch?.[1]?.trim() ?? `Arc ${arcNum}`;
    const $link = $header.find('a').first();
    const arcPageUrl = $link.attr('href');

    const arc: ArcInfo = { arcNumber: arcNum, title, volumes: [] };
    if (arcPageUrl?.startsWith('/wiki/')) arc.arcPageUrl = arcPageUrl;
    arcs.push(arc);
  });

  arcs.sort((a, b) => a.arcNumber - b.arcNumber);
  return arcs;
}

/** Parses arc-based structure from HTML. */
export function parseArcBasedStructure(html: string): ArcBasedParseResult {
  const $ = load(html);
  const seriesTitle = $('#firstHeading').text().trim() || $('h1').first().text().trim() || 'Unknown';
  const arcs = detectArcSections($);

  if (arcs.length === 0) {
    logger.debug('[arc-based-parser] No arc sections found');
    return { seriesTitle, arcs: [], totalVolumes: 0, totalChapters: 0, success: false };
  }

  logger.info(`[arc-based-parser] Found ${arcs.length} arcs`);

  for (const arc of arcs) {
    arc.volumes = extractVolumesFromSection($, arc.arcNumber);
    logger.debug(`[arc-based-parser] Arc ${arc.arcNumber}: ${arc.volumes.length} volumes`);
  }

  const totalVolumes = arcs.reduce((sum, arc) => sum + arc.volumes.length, 0);
  const totalChapters = arcs.reduce(
    (sum, arc) => sum + arc.volumes.reduce((vSum, vol) => vSum + vol.chapters.length, 0),
    0
  );

  let globalVolNum = 0;
  for (const arc of arcs) {
    for (const volume of arc.volumes) {
      globalVolNum++;
      volume.globalVolumeNumber = globalVolNum;
    }
  }

  return { seriesTitle, arcs, totalVolumes, totalChapters, success: arcs.length > 0 };
}

/** Checks if a page uses arc-based structure. */
export function isArcBasedStructure(html: string): boolean {
  const $ = load(html);
  const seenArcs = new Set<number>();

  $('h2, h3').each((_, header) => {
    const arcNum = extractArcNumber($(header).text());
    if (arcNum !== null) seenArcs.add(arcNum);
  });

  return seenArcs.size >= 2;
}

/** Parses chapters from a volume page. */
export function parseChaptersFromVolumePage(
  $: CheerioAPI,
  arcNumber: number,
  volumeNumber: number
): ArcChapter[] {
  const chapters: ArcChapter[] = [];
  const seenChapters = new Set<number>();

  $('a[href*="/wiki/Chapter"], a[title*="Chapter"]').each((_, link) => {
    const $link = $(link);
    const text = $link.text().trim();
    const title = $link.attr('title') ?? '';
    const href = $link.attr('href') ?? '';

    const numMatch = text.match(/Chapter\s*(\d+)/i) ??
      title.match(/Chapter\s*(\d+)/i) ??
      text.match(/^(\d+)$/);

    if (!numMatch?.[1]) return;

    const chapterNum = parseInt(numMatch[1], 10);
    if (seenChapters.has(chapterNum)) return;
    seenChapters.add(chapterNum);

    const chapter: ArcChapter = { chapterNumber: chapterNum, arcNumber, volumeNumber };
    const titleMatch = title.match(/Chapter\s*\d+[:\s-]*(.+)/i);
    if (titleMatch?.[1]) chapter.title = titleMatch[1].trim();
    if (href.startsWith('/wiki/')) chapter.url = href;
    chapters.push(chapter);
  });

  chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  return chapters;
}
