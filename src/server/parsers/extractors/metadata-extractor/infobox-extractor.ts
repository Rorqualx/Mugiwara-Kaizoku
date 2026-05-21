/**
 * Infobox Metadata Extractor
 *
 * Extracts metadata from wiki infoboxes (portable and traditional formats).
 *
 * Extracted from: MetadataExtractor.ts (lines 351-462)
 */

import { isString } from '@/utils/type-guards/index';

import { findFieldMapping } from './utils';

import type { CheerioElement, ExtractedMetadata, MetadataExtractionOptions } from './types';
import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

/**
 * Extract metadata from wiki infobox
 * Supports both portable (Fandom) and traditional (Wikipedia) formats
 */
export function extractFromInfobox(
  $: CheerioAPI,
  options: MetadataExtractionOptions = {}
): Partial<ExtractedMetadata> {
  const metadata: Partial<ExtractedMetadata> = {};
  const rawData: Record<string, unknown> = {};

  // Find infobox
  const $infobox: CheerioElement = $('.portable-infobox, .infobox').first();
  if ($infobox.length === 0) return metadata;

  // Extract based on infobox type
  if ($infobox.hasClass('portable-infobox')) {
    const portableData = extractFromPortableInfobox($, $infobox);
    Object.assign(rawData, portableData.rawData);
    Object.assign(metadata, portableData.metadata);
  } else {
    const traditionalData = extractFromTraditionalInfobox($, $infobox);
    Object.assign(rawData, traditionalData.rawData);
    Object.assign(metadata, traditionalData.metadata);
  }

  // Apply field mappings
  for (const [key, value] of Object.entries(rawData)) {
    const mapping = findFieldMapping(key);
    if (mapping && isString(value)) {
      const processed = mapping.processor ? mapping.processor(value) : value;
      if (processed !== null && processed !== undefined) {
        // Use type-safe property assignment
        const typedMetadata = metadata as Record<string, unknown>;
        typedMetadata[mapping.target] = processed;
      }
    }
  }

  if (options.includeRaw) {
    metadata.rawInfobox = rawData;
  }

  return metadata;
}

/**
 * Extract from Fandom portable infobox format
 */
export function extractFromPortableInfobox(
  $: CheerioAPI,
  $infobox: CheerioElement
): { metadata: Partial<ExtractedMetadata>; rawData: Record<string, unknown> } {
  const metadata: Partial<ExtractedMetadata> = {};
  const rawData: Record<string, unknown> = {};
  const infobox = $infobox;

  // Extract title
  const title = infobox.find('.pi-title').text().trim();
  if (title) {
    metadata.title = title;
    rawData['title'] = title;
  }

  // Extract data fields
  infobox.find('.pi-data').each((_: number, item: AnyNode) => {
    const $item = $(item);
    const label = $item.find('.pi-data-label').text().trim().toLowerCase();
    const value = $item.find('.pi-data-value').text().trim();
    if (label && value) {
      rawData[label] = value;
    }
  });

  // Extract groups
  infobox.find('.pi-group').each((_: number, group: AnyNode) => {
    const $group = $(group);
    const groupTitle = $group.find('.pi-header').text().trim().toLowerCase();
    $group.find('.pi-data').each((_: number, item: AnyNode) => {
      const $item = $(item);
      const label = $item.find('.pi-data-label').text().trim().toLowerCase();
      const value = $item.find('.pi-data-value').text().trim();
      if (label && value) {
        const key = groupTitle ? `${groupTitle}_${label}` : label;
        rawData[key] = value;
      }
    });
  });

  return { metadata, rawData };
}

/**
 * Extract from Wikipedia-style traditional infobox
 */
export function extractFromTraditionalInfobox(
  $: CheerioAPI,
  $infobox: CheerioElement
): { metadata: Partial<ExtractedMetadata>; rawData: Record<string, unknown> } {
  const metadata: Partial<ExtractedMetadata> = {};
  const rawData: Record<string, unknown> = {};
  const infobox = $infobox;

  // Extract title from caption
  const caption = infobox.find('caption, .infobox-title').text().trim();
  if (caption) {
    metadata.title = caption;
    rawData['title'] = caption;
  }

  // Extract from table rows
  infobox.find('tr').each((_: number, row: AnyNode) => {
    const $row = $(row);
    const $header = $row.find('th');
    const $data = $row.find('td');
    if ($header.length > 0 && $data.length > 0) {
      const label = $header.text().trim().toLowerCase();
      const value = $data.text().trim();
      if (label && value) {
        rawData[label] = value;
      }
    }
  });

  return { metadata, rawData };
}
