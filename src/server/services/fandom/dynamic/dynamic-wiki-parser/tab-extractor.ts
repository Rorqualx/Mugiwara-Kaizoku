/**
 * Dynamic Wiki Parser - Tab Extractor Module
 *
 * Extracts volume and chapter data from tabbed list pages, trying in order:
 *
 * 1. Volume bands — the shape every modern tabbed list page renders to: one
 *    table where each volume's "Japanese"/"English" cover tabber row is
 *    followed by its chapter row. Delegated to the adaptive band parser.
 * 2. Volume-labelled tabs — tabs named "Volume 3" or "Volumes 1-10"
 *    (`.wds-tabber` or legacy `.tabbertab`).
 * 3. Volume headings — "Volume 3" section headings, or `<h4>` volume
 *    headings inside table cells.
 *
 * Submodules live in ./tab-extractor/.
 */

import { logger } from '@/utils/logger';

import { extractTabGallery, type TabGalleryImage } from './tab-extractor/gallery';
import { extractVolumesUnderHeadings } from './tab-extractor/heading-sections';
import { extractFromLabelledTabs } from './tab-extractor/labelled-tabs';
import { extractVolumeBandData } from './tab-extractor/volume-band-adapter';

import type { ChapterData, PageStructure, VolumeData } from './types';
import type { CheerioAPI } from 'cheerio';

export { extractVolumeDataFromContent } from './tab-extractor/volume-content';
export { extractVolumeBandData, type VolumeBandData } from './tab-extractor/volume-band-adapter';

const log = logger.child('TabExtractor', { service: 'DynamicWikiParser' });

/** The raw page, when the caller has it (avoids re-serialising the DOM). */
export interface TabSource {
  html: string;
  url: string;
}

export type TabExtractionMethod = 'volume_bands' | 'labelled_tabs' | 'volume_headings' | 'none';

export interface TabExtractionResult {
  volumes: VolumeData[];
  chapters: ChapterData[];
  gallery?: TabGalleryImage[];
  method: TabExtractionMethod;
}

function withMethod(volumes: VolumeData[], method: TabExtractionMethod): Omit<TabExtractionResult, 'gallery'> {
  return { volumes, chapters: volumes.flatMap(v => v.chapters), method };
}

/** Volumes and chapters from the first strategy that finds any. */
function extractVolumes($: CheerioAPI, source: TabSource): Omit<TabExtractionResult, 'gallery'> {
  const bands = extractVolumeBandData(source.html, source.url);
  if (bands) return { ...bands, method: 'volume_bands' };

  const tabbed = extractFromLabelledTabs($);
  if (tabbed.length > 0) return withMethod(tabbed, 'labelled_tabs');

  const $root = $('.mw-parser-output').first();
  const headed = extractVolumesUnderHeadings($, $root.length > 0 ? $root : $.root());
  if (headed.length > 0) return withMethod(headed, 'volume_headings');

  return withMethod([], 'none');
}

/**
 * Extract data from tabbed interfaces
 */
export function extractFromTabs(
  $: CheerioAPI,
  _structure: PageStructure,
  source?: TabSource,
): Promise<TabExtractionResult> {
  const result: TabExtractionResult = extractVolumes($, source ?? { html: $.html(), url: '' });
  log.debug('Tab extraction', { method: result.method, volumes: result.volumes.length, chapters: result.chapters.length });

  const gallery = extractTabGallery($);
  if (gallery.length > 0) result.gallery = gallery;
  return Promise.resolve(result);
}
