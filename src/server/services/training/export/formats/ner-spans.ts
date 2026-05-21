/**
 * NER Spans Export Format
 *
 * Exports training data as span-based NER format for entity recognition training.
 * Compatible with spaCy, Hugging Face NER, and other NER frameworks.
 *
 * @module training/export/formats/ner-spans
 */

import { extractPageData, extractEntitiesFromBIO, getFullText } from '../types';

import type { PageData, NERSpanRecord, ExportOptions, ExtractedEntity } from '../types';
import type { AnnotatedPage } from '@prisma/client';


// ============================================================================
// Types
// ============================================================================

export interface NERSpanExportOptions extends ExportOptions {
  entityTypes?: string[] | undefined;
  format?: 'spacy' | 'huggingface' | 'generic' | undefined;
  includeNested?: boolean | undefined;
}

export interface SpacyDocBin {
  text: string;
  ents: Array<{ start: number; end: number; label: string }>;
}

export interface HuggingFaceNER {
  id: string;
  tokens: string[];
  ner_tags: string[];
}

// ============================================================================
// Single Page Export
// ============================================================================

/**
 * Transform a single page to NER span records
 */
export function toNERSpanFormat(
  page: AnnotatedPage,
  options: NERSpanExportOptions = {}
): NERSpanRecord | null {
  const pageData = extractPageData(page);
  if (!pageData) return null;

  return generateNERSpanRecord(pageData, options);
}

function generateNERSpanRecord(
  pageData: PageData,
  options: NERSpanExportOptions
): NERSpanRecord {
  const { entityTypes, includeMetadata = true } = options;

  const fullText = getFullText(pageData.tokens);
  const entities = extractEntitiesFromBIO(pageData.tokens, pageData.labels);

  // Filter entities by type if specified
  const filteredEntities = entityTypes
    ? entities.filter(e => entityTypes.includes(e.type))
    : entities;

  // Convert entities to span format with character offsets
  const spans = computeSpansWithOffsets(fullText, filteredEntities);

  const record: NERSpanRecord = {
    text: fullText,
    entities: spans,
  };

  if (includeMetadata) {
    record.metadata = {
      source: pageData.sourceType,
      pageId: pageData.id,
      mangaTitle: pageData.mangaTitle,
      entityCount: spans.length,
    };
  }

  return record;
}

// ============================================================================
// Span Computation
// ============================================================================

interface SpanEntity {
  text: string;
  label: string;
  start: number;
  end: number;
}

function computeSpansWithOffsets(
  fullText: string,
  entities: ExtractedEntity[]
): SpanEntity[] {
  const spans: SpanEntity[] = [];
  const usedRanges: Array<{ start: number; end: number }> = [];

  for (const entity of entities) {
    const span = findEntitySpan(fullText, entity, usedRanges);
    if (span) {
      spans.push(span);
      usedRanges.push({ start: span.start, end: span.end });
    }
  }

  // Sort by start position
  return spans.sort((a, b) => a.start - b.start);
}

function findEntitySpan(
  fullText: string,
  entity: ExtractedEntity,
  usedRanges: Array<{ start: number; end: number }>
): SpanEntity | null {
  const searchText = entity.text.trim();
  if (!searchText) return null;

  // Find all occurrences
  let searchStart = 0;
  while (searchStart < fullText.length) {
    const idx = fullText.indexOf(searchText, searchStart);
    if (idx === -1) break;

    const start = idx;
    const end = idx + searchText.length;

    // Check if this range overlaps with already used ranges
    const overlaps = usedRanges.some(
      range => (start < range.end && end > range.start)
    );

    if (!overlaps) {
      return {
        text: searchText,
        label: entity.type,
        start,
        end,
      };
    }

    searchStart = idx + 1;
  }

  return null;
}

// ============================================================================
// SpaCy Format
// ============================================================================

/**
 * Export to spaCy DocBin-compatible format
 */
export function toSpacyFormat(
  page: AnnotatedPage,
  options: NERSpanExportOptions = {}
): SpacyDocBin | null {
  const pageData = extractPageData(page);
  if (!pageData) return null;

  const fullText = getFullText(pageData.tokens);
  const entities = extractEntitiesFromBIO(pageData.tokens, pageData.labels);

  const filteredEntities = options.entityTypes
    ? entities.filter(e => options.entityTypes?.includes(e.type))
    : entities;

  const spans = computeSpansWithOffsets(fullText, filteredEntities);

  return {
    text: fullText,
    ents: spans.map(s => ({ start: s.start, end: s.end, label: s.label })),
  };
}

// ============================================================================
// Hugging Face Format
// ============================================================================

/**
 * Export to Hugging Face NER format with BIO tags
 */
export function toHuggingFaceFormat(
  page: AnnotatedPage,
  options: NERSpanExportOptions = {}
): HuggingFaceNER | null {
  const pageData = extractPageData(page);
  if (!pageData) return null;

  const { entityTypes } = options;

  // Get tokens and labels
  const tokens = pageData.tokens.map(t => t.text);
  let nerTags = pageData.labels.map(l => l as string);

  // Filter entity types if specified
  if (entityTypes) {
    nerTags = nerTags.map(tag => {
      if (tag === 'O') return tag;
      const entityType = tag.replace(/^[BI]-/, '');
      return entityTypes.includes(entityType) ? tag : 'O';
    });
  }

  return {
    id: pageData.id,
    tokens,
    ner_tags: nerTags,
  };
}

// ============================================================================
// CoNLL Format
// ============================================================================

/**
 * Export to CoNLL format (token per line with BIO tag)
 */
export function toCoNLLFormat(
  page: AnnotatedPage,
  options: NERSpanExportOptions = {}
): string | null {
  const pageData = extractPageData(page);
  if (!pageData) return null;

  const { entityTypes } = options;
  const lines: string[] = [];

  for (let i = 0; i < pageData.tokens.length; i++) {
    const token = pageData.tokens[i];
    if (!token) continue;

    let tag = pageData.labels[i] ?? 'O';

    // Filter entity types if specified
    if (entityTypes && tag !== 'O') {
      const entityType = tag.replace(/^[BI]-/, '');
      if (!entityTypes.includes(entityType)) {
        tag = 'O';
      }
    }

    lines.push(`${token.text}\t${tag}`);
  }

  // Add blank line at end to separate documents
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Batch Export
// ============================================================================

/**
 * Export multiple pages to NER span format
 */
export function exportPagesToNERSpans(
  pages: AnnotatedPage[],
  options: NERSpanExportOptions = {}
): NERSpanRecord[] {
  const records: NERSpanRecord[] = [];

  for (const page of pages) {
    const record = toNERSpanFormat(page, options);
    if (record) records.push(record);
  }

  return records;
}

/**
 * Export to NER JSONL format
 */
export function exportToNERJSONL(
  pages: AnnotatedPage[],
  options: NERSpanExportOptions = {}
): string {
  const records = exportPagesToNERSpans(pages, options);
  return records.map(r => JSON.stringify(r)).join('\n') + (records.length > 0 ? '\n' : '');
}

/**
 * Export to spaCy JSONL format
 */
export function exportToSpacyJSONL(
  pages: AnnotatedPage[],
  options: NERSpanExportOptions = {}
): string {
  const records: SpacyDocBin[] = [];

  for (const page of pages) {
    const record = toSpacyFormat(page, options);
    if (record) records.push(record);
  }

  return records.map(r => JSON.stringify(r)).join('\n') + (records.length > 0 ? '\n' : '');
}

/**
 * Export to CoNLL format (all documents concatenated)
 */
export function exportToCoNLL(
  pages: AnnotatedPage[],
  options: NERSpanExportOptions = {}
): string {
  const documents: string[] = [];

  for (const page of pages) {
    const doc = toCoNLLFormat(page, options);
    if (doc) documents.push(doc);
  }

  return documents.join('\n');
}

/**
 * Export to Hugging Face datasets format
 */
export function exportToHuggingFaceJSONL(
  pages: AnnotatedPage[],
  options: NERSpanExportOptions = {}
): string {
  const records: HuggingFaceNER[] = [];

  for (const page of pages) {
    const record = toHuggingFaceFormat(page, options);
    if (record) records.push(record);
  }

  return records.map(r => JSON.stringify(r)).join('\n') + (records.length > 0 ? '\n' : '');
}

/**
 * Async generator for streaming NER export
 */
export async function* exportAsNERStream(
  pages: AsyncIterable<AnnotatedPage>,
  options: NERSpanExportOptions = {}
): AsyncGenerator<string> {
  for await (const page of pages) {
    const record = toNERSpanFormat(page, options);
    if (record) {
      yield JSON.stringify(record) + '\n';
    }
  }
}
