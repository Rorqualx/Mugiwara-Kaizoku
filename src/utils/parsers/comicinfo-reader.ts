/**
 * ComicInfo.xml Reader
 *
 * Extracts metadata from ComicInfo.xml embedded in CBZ/ZIP archives.
 * Used by the library scanner to get series name, year, and other
 * metadata directly from files when available.
 *
 * @module utils/parsers/comicinfo-reader
 */

import * as fs from 'fs/promises';

import JSZip from 'jszip';

import { serverLogger } from '@/utils/serverLogger';

/**
 * Metadata extracted from a ComicInfo.xml file
 */
export interface ComicInfoData {
  /** Series name (most reliable title source) */
  series?: string;
  /** Issue/chapter title */
  title?: string;
  /** Volume number */
  volume?: number;
  /** Chapter/issue number */
  number?: number;
  /** Publication year */
  year?: number;
  /** Publisher name */
  publisher?: string;
  /** Summary/description */
  summary?: string;
  /** Writer/author */
  writer?: string;
  /** Genre tags */
  genre?: string;
  /** Language code */
  languageISO?: string;
  /** Page count */
  pageCount?: number;
  /** Web URL for the series */
  web?: string;
}

/**
 * Extract a text value from an XML element.
 * Simple regex-based extraction (avoids heavy XML parser dependency).
 */
function extractXmlValue(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const match = xml.match(re);
  return match?.[1]?.trim() ?? undefined;
}

/**
 * Extract a numeric value from an XML element.
 */
function extractXmlNumber(xml: string, tag: string): number | undefined {
  const text = extractXmlValue(xml, tag);
  if (text === undefined) return undefined;
  const num = parseFloat(text);
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Parse ComicInfo.xml content into structured data
 */
export function parseComicInfoXml(xmlContent: string): ComicInfoData {
  const data: ComicInfoData = {};

  const series = extractXmlValue(xmlContent, 'Series');
  if (series !== undefined) data.series = series;

  const title = extractXmlValue(xmlContent, 'Title');
  if (title !== undefined) data.title = title;

  const volume = extractXmlNumber(xmlContent, 'Volume');
  if (volume !== undefined) data.volume = volume;

  const number = extractXmlNumber(xmlContent, 'Number');
  if (number !== undefined) data.number = number;

  const year = extractXmlNumber(xmlContent, 'Year');
  if (year !== undefined) data.year = year;

  const publisher = extractXmlValue(xmlContent, 'Publisher');
  if (publisher !== undefined) data.publisher = publisher;

  const summary = extractXmlValue(xmlContent, 'Summary');
  if (summary !== undefined) data.summary = summary;

  const writer = extractXmlValue(xmlContent, 'Writer');
  if (writer !== undefined) data.writer = writer;

  const genre = extractXmlValue(xmlContent, 'Genre');
  if (genre !== undefined) data.genre = genre;

  const languageISO = extractXmlValue(xmlContent, 'LanguageISO');
  if (languageISO !== undefined) data.languageISO = languageISO;

  const pageCount = extractXmlNumber(xmlContent, 'PageCount');
  if (pageCount !== undefined) data.pageCount = pageCount;

  const web = extractXmlValue(xmlContent, 'Web');
  if (web !== undefined) data.web = web;

  return data;
}

/**
 * Read ComicInfo.xml from a CBZ/ZIP archive file.
 * Returns null if the file doesn't contain ComicInfo.xml or can't be read.
 */
export async function readComicInfoFromArchive(archivePath: string): Promise<ComicInfoData | null> {
  try {
    const buffer = await fs.readFile(archivePath);
    const zip = await JSZip.loadAsync(buffer);

    // Look for ComicInfo.xml (case-insensitive)
    const comicInfoEntry = Object.keys(zip.files).find(
      (name) => name.toLowerCase() === 'comicinfo.xml'
    );

    if (!comicInfoEntry) return null;

    const file = zip.files[comicInfoEntry];
    if (!file || file.dir) return null;

    const xmlContent = await file.async('text');
    return parseComicInfoXml(xmlContent);
  } catch (error) {
    serverLogger.debug('[ComicInfoReader] Failed to read archive', {
      path: archivePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Read ComicInfo.xml from the first CBZ/ZIP file in a list of files.
 * Tries files in order and returns the first successful result.
 */
export async function readComicInfoFromFirstArchive(files: string[]): Promise<ComicInfoData | null> {
  const archiveFiles = files.filter((f) =>
    /\.(?:cbz|zip)$/i.test(f)
  );

  if (archiveFiles.length === 0) return null;

  // Try the first archive file (usually Vol 01 or Chapter 001)
  const result = await readComicInfoFromArchive(archiveFiles[0] ?? '');
  if (result) {
    serverLogger.info('[ComicInfoReader] Found embedded metadata', {
      file: archiveFiles[0],
      series: result.series,
      year: result.year,
    });
  }

  return result;
}
