/**
 * CBZ Bundler
 *
 * Creates CBZ (Comic Book ZIP) archives from downloaded chapter images.
 * Includes ComicInfo.xml metadata for compatible comic readers.
 *
 * @module server/services/native-download/downloaders/cbz-bundler
 */

import { createWriteStream, existsSync, mkdirSync } from 'fs';
import path from 'path';

import archiver from 'archiver';

import { logger } from '@/utils/logger';

const log = logger.child('CBZBundler');

/**
 * ComicInfo metadata for CBZ files
 */
export interface ComicInfoMetadata {
  title?: string | undefined;
  series?: string | undefined;
  number?: string | undefined;
  volume?: string | undefined;
  summary?: string | undefined;
  publisher?: string | undefined;
  genre?: string | undefined;
  pageCount?: number | undefined;
  language?: string | undefined;
  year?: number | undefined;
  month?: number | undefined;
  day?: number | undefined;
  writer?: string | undefined;
  penciller?: string | undefined;
  inker?: string | undefined;
  colorist?: string | undefined;
  letterer?: string | undefined;
  coverArtist?: string | undefined;
  editor?: string | undefined;
  translator?: string | undefined;
  teams?: string[] | undefined;
  web?: string | undefined;
  manga?: 'Yes' | 'No' | 'YesAndRightToLeft' | undefined;
}

/**
 * Page entry for CBZ bundling
 */
export interface PageEntry {
  /** Full path to the image file */
  filePath: string;
  /** Name for the file in the archive (e.g., "001.jpg") */
  archiveName: string;
}

/**
 * CBZ bundle options
 */
export interface CBZBundleOptions {
  /** Output path for the CBZ file */
  outputPath: string;
  /** Pages to include */
  pages: PageEntry[];
  /** Optional ComicInfo metadata */
  metadata?: ComicInfoMetadata;
  /** Compression level (0 = none/store, 9 = max). Default: 0 for images */
  compressionLevel?: number;
}

/**
 * Generate ComicInfo.xml content
 */
function generateComicInfoXml(metadata: ComicInfoMetadata): string {
  const escapeXml = (str: string | undefined): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const addTag = (name: string, value: string | number | undefined): string => {
    if (value === undefined || value === '') return '';
    return `  <${name}>${escapeXml(String(value))}</${name}>\n`;
  };

  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n';

  xml += addTag('Title', metadata.title);
  xml += addTag('Series', metadata.series);
  xml += addTag('Number', metadata.number);
  xml += addTag('Volume', metadata.volume);
  xml += addTag('Summary', metadata.summary);
  xml += addTag('Publisher', metadata.publisher);
  xml += addTag('Genre', metadata.genre);
  xml += addTag('PageCount', metadata.pageCount);
  xml += addTag('LanguageISO', metadata.language);
  xml += addTag('Year', metadata.year);
  xml += addTag('Month', metadata.month);
  xml += addTag('Day', metadata.day);
  xml += addTag('Writer', metadata.writer);
  xml += addTag('Penciller', metadata.penciller);
  xml += addTag('Inker', metadata.inker);
  xml += addTag('Colorist', metadata.colorist);
  xml += addTag('Letterer', metadata.letterer);
  xml += addTag('CoverArtist', metadata.coverArtist);
  xml += addTag('Editor', metadata.editor);
  xml += addTag('Translator', metadata.translator);
  xml += addTag('Web', metadata.web);
  xml += addTag('Manga', metadata.manga);

  if (metadata.teams && metadata.teams.length > 0) {
    xml += `  <Teams>${metadata.teams.map(t => escapeXml(t)).join(', ')}</Teams>\n`;
  }

  xml += '</ComicInfo>';

  return xml;
}

/**
 * Create a CBZ archive from downloaded pages
 */
export async function createCBZ(options: CBZBundleOptions): Promise<{
  success: boolean;
  outputPath: string;
  size: number;
  pageCount: number;
  error?: string;
}> {
  const { outputPath, pages, metadata, compressionLevel = 0 } = options;

  log.info('Creating CBZ archive', {
    outputPath,
    pageCount: pages.length,
    hasMetadata: !!metadata
  });

  return new Promise((resolve) => {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // Create output stream
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: compressionLevel }
      });

      let finalSize = 0;

      output.on('close', () => {
        finalSize = archive.pointer();
        log.info('CBZ archive created', {
          outputPath,
          size: finalSize,
          pageCount: pages.length
        });
        resolve({
          success: true,
          outputPath,
          size: finalSize,
          pageCount: pages.length
        });
      });

      output.on('error', (err) => {
        log.error('Output stream error', { error: err.message });
        resolve({
          success: false,
          outputPath,
          size: 0,
          pageCount: 0,
          error: err.message
        });
      });

      archive.on('error', (err) => {
        log.error('Archiver error', { error: err.message });
        resolve({
          success: false,
          outputPath,
          size: 0,
          pageCount: 0,
          error: err.message
        });
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          log.warn('Archiver warning', { error: err.message });
        } else {
          throw err;
        }
      });

      archive.pipe(output);

      // Add ComicInfo.xml if metadata provided
      if (metadata) {
        const comicInfoContent = generateComicInfoXml({
          ...metadata,
          pageCount: pages.length,
          manga: metadata.manga ?? 'YesAndRightToLeft'
        });
        archive.append(comicInfoContent, { name: 'ComicInfo.xml' });
      }

      // Add pages
      for (const page of pages) {
        if (existsSync(page.filePath)) {
          archive.file(page.filePath, { name: page.archiveName });
        } else {
          log.warn('Page file not found', { filePath: page.filePath });
        }
      }

      // Finalize the archive - void is intentional as resolution happens via events
      void archive.finalize();
    } catch (error) {
      log.error('Failed to create CBZ', {
        error: error instanceof Error ? error.message : String(error)
      });
      resolve({
        success: false,
        outputPath,
        size: 0,
        pageCount: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

/**
 * Generate standard page naming (001.jpg, 002.jpg, etc.)
 */
export function generatePageName(index: number, extension: string): string {
  const paddedIndex = String(index + 1).padStart(3, '0');
  return `${paddedIndex}.${extension}`;
}

/**
 * Extract extension from URL or filename
 */
export function getImageExtension(urlOrPath: string): string {
  const match = urlOrPath.match(/\.([a-zA-Z]+)(?:\?|$)/);
  if (match?.[1]) {
    const ext = match[1].toLowerCase();
    // Normalize common extensions
    if (ext === 'jpeg') return 'jpg';
    return ext;
  }
  return 'jpg'; // Default to jpg
}
