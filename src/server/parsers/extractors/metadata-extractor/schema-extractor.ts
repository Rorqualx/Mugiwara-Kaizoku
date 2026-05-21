/**
 * Schema.org Metadata Extractor
 *
 * Extracts metadata from schema.org structured data (JSON-LD and microdata).
 *
 * Extracted from: MetadataExtractor.ts (lines 255-347)
 */

import { isRecord, isString, isArray } from '@/utils/type-guards/index';

import { splitNames, extractPersons } from './utils';

import type { ExtractedMetadata } from './types';
import type { CheerioAPI } from 'cheerio';

/**
 * Extract metadata from schema.org structured data
 * Checks JSON-LD and microdata formats
 */
export function extractFromSchema($: CheerioAPI): Partial<ExtractedMetadata> {
  let metadata: Partial<ExtractedMetadata> = {};

  // Look for JSON-LD
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const htmlContent = $(script).html();
      const data: unknown = JSON.parse(htmlContent ?? '{}');

      if (!isRecord(data)) return;

      const schemaData = extractFromSchemaData(data);
      metadata = { ...metadata, ...schemaData };
    } catch (_e: unknown) {
      // Invalid JSON, skip
    }
  });

  // Look for microdata
  $('[itemscope][itemtype*="schema.org"]').each((_, element) => {
    const $el = $(element);
    const type = $el.attr('itemtype');
    if (type && (type.includes('Book') || type.includes('CreativeWork'))) {
      const title = $el.find('[itemprop="name"]').text().trim();
      if (title) metadata.title = title;
      const author = $el.find('[itemprop="author"]').text().trim();
      if (author) metadata.author = splitNames(author);
      const publisher = $el.find('[itemprop="publisher"]').text().trim();
      if (publisher) metadata.publisher = publisher;
    }
  });

  return metadata;
}

/**
 * Extract metadata from parsed schema.org JSON-LD data
 */
export function extractFromSchemaData(data: Record<string, unknown>): Partial<ExtractedMetadata> {
  const metadata: Partial<ExtractedMetadata> = {};
  const dataType = data['@type'];

  if (dataType !== 'Book' && dataType !== 'CreativeWork' && dataType !== 'ComicSeries') {
    return metadata;
  }

  const name = data['name'];
  if (isString(name)) {
    metadata.title = name;
  }

  const description = data['description'];
  if (isString(description)) {
    metadata.description = description;
  }

  const author = data['author'];
  if (author !== undefined) {
    metadata.author = extractPersons(author);
  }

  const illustrator = data['illustrator'];
  if (illustrator !== undefined) {
    metadata.artist = extractPersons(illustrator);
  }

  const publisher = data['publisher'];
  if (isString(publisher)) {
    metadata.publisher = publisher;
  } else if (isRecord(publisher)) {
    const publisherName = publisher['name'];
    if (isString(publisherName)) {
      metadata.publisher = publisherName;
    }
  }

  const isbn = data['isbn'];
  if (isArray(isbn)) {
    metadata.isbn = isbn.filter(isString);
  } else if (isString(isbn)) {
    metadata.isbn = [isbn];
  }

  const genre = data['genre'];
  if (isArray(genre)) {
    metadata.genres = genre.filter(isString);
  } else if (isString(genre)) {
    metadata.genres = [genre];
  }

  const datePublished = data['datePublished'];
  if (isString(datePublished)) {
    metadata.startDate = datePublished;
  }

  return metadata;
}
