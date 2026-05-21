/**
 * Alpaca Format Export
 *
 * Exports training data in Alpaca instruction-tuning format.
 * Format: { instruction, input, output, metadata? }
 *
 * @module training/export/formats/alpaca
 */

import {
  extractPageData,
  extractEntitiesFromBIO,
  getContextAroundEntity,
  generateExtractionInstruction,
} from '../types';

import type {
  PageData,
  AlpacaRecord,
  ExportOptions,
  ExtractedEntity,
} from '../types';
import type { AnnotatedPage } from '@prisma/client';


// ============================================================================
// Types
// ============================================================================

export interface AlpacaExportOptions extends ExportOptions {
  maxInputLength?: number | undefined;
  includeSummaryTask?: boolean | undefined;
  includeClassificationTask?: boolean | undefined;
  entityTypes?: string[] | undefined;
}

// ============================================================================
// Single Page Export
// ============================================================================

/**
 * Transform a single page to Alpaca records
 * Generates multiple instruction-output pairs per page
 */
export function toAlpacaFormat(
  page: AnnotatedPage,
  options: AlpacaExportOptions = {}
): AlpacaRecord[] {
  const pageData = extractPageData(page);
  if (!pageData) return [];

  return generateAlpacaRecords(pageData, options);
}

function generateAlpacaRecords(
  pageData: PageData,
  options: AlpacaExportOptions
): AlpacaRecord[] {
  const {
    maxInputLength = 2000,
    includeSummaryTask = true,
    includeClassificationTask = true,
    entityTypes,
    includeMetadata = true,
  } = options;

  const records: AlpacaRecord[] = [];
  const entities = extractEntitiesFromBIO(pageData.tokens, pageData.labels);

  // Filter entities by type if specified
  const filteredEntities = entityTypes
    ? entities.filter(e => entityTypes.includes(e.type))
    : entities;

  // Generate extraction instructions for each entity
  for (const entity of filteredEntities) {
    const record = createExtractionRecord(pageData, entity, maxInputLength, includeMetadata);
    records.push(record);
  }

  // Add summary task if available
  if (includeSummaryTask) {
    const summaryRecord = createSummaryRecord(pageData, entities, maxInputLength, includeMetadata);
    if (summaryRecord) records.push(summaryRecord);
  }

  // Add classification task if genres/tags available
  if (includeClassificationTask) {
    const classificationRecord = createClassificationRecord(pageData, entities, maxInputLength, includeMetadata);
    if (classificationRecord) records.push(classificationRecord);
  }

  return records;
}

// ============================================================================
// Record Generators
// ============================================================================

function createExtractionRecord(
  pageData: PageData,
  entity: ExtractedEntity,
  maxInputLength: number,
  includeMetadata: boolean
): AlpacaRecord {
  const instruction = generateExtractionInstruction(entity.type, pageData.mangaTitle);
  const input = getContextAroundEntity(pageData.tokens, entity, 75);
  const truncatedInput = truncateText(input, maxInputLength);

  const record: AlpacaRecord = {
    instruction,
    input: truncatedInput,
    output: entity.text,
  };

  if (includeMetadata) {
    record.metadata = {
      source: pageData.sourceType,
      pageId: pageData.id,
      mangaTitle: pageData.mangaTitle,
      entityType: entity.type,
    };
  }

  return record;
}

function createSummaryRecord(
  pageData: PageData,
  entities: ExtractedEntity[],
  maxInputLength: number,
  includeMetadata: boolean
): AlpacaRecord | null {
  const summaryEntity = entities.find(e => e.type === 'SERIES_SUMMARY');
  if (!summaryEntity) return null;

  const input = getDocumentInput(pageData, maxInputLength);
  const mangaRef = pageData.mangaTitle ? `"${pageData.mangaTitle}"` : 'this manga';

  const record: AlpacaRecord = {
    instruction: `Summarize the following manga description for ${mangaRef}.`,
    input,
    output: summaryEntity.text,
  };

  if (includeMetadata) {
    record.metadata = {
      source: pageData.sourceType,
      pageId: pageData.id,
      mangaTitle: pageData.mangaTitle,
      taskType: 'summarization',
    };
  }

  return record;
}

function createClassificationRecord(
  pageData: PageData,
  entities: ExtractedEntity[],
  maxInputLength: number,
  includeMetadata: boolean
): AlpacaRecord | null {
  const genres = entities.filter(e => e.type === 'GENRE');
  const tags = entities.filter(e => e.type === 'TAGS' || e.type === 'THEMES');

  if (genres.length === 0 && tags.length === 0) return null;

  const input = getDocumentInput(pageData, maxInputLength);
  const mangaRef = pageData.mangaTitle ? `"${pageData.mangaTitle}"` : 'this manga';

  const outputParts: string[] = [];
  if (genres.length > 0) {
    outputParts.push(`Genres: ${genres.map(g => g.text).join(', ')}`);
  }
  if (tags.length > 0) {
    outputParts.push(`Tags: ${tags.map(t => t.text).join(', ')}`);
  }

  const record: AlpacaRecord = {
    instruction: `Classify ${mangaRef} by identifying its genres and themes from the following description.`,
    input,
    output: outputParts.join('\n'),
  };

  if (includeMetadata) {
    record.metadata = {
      source: pageData.sourceType,
      pageId: pageData.id,
      mangaTitle: pageData.mangaTitle,
      taskType: 'classification',
    };
  }

  return record;
}

// ============================================================================
// Helpers
// ============================================================================

function getDocumentInput(pageData: PageData, maxLength: number): string {
  if (pageData.segments?.markdown) {
    return truncateText(pageData.segments.markdown, maxLength);
  }

  const fullText = pageData.tokens.map(t => t.text).join(' ');
  return truncateText(fullText, maxLength);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Batch Export
// ============================================================================

/**
 * Export multiple pages to Alpaca format
 */
export function exportPagesToAlpaca(
  pages: AnnotatedPage[],
  options: AlpacaExportOptions = {}
): AlpacaRecord[] {
  const records: AlpacaRecord[] = [];

  for (const page of pages) {
    const pageRecords = toAlpacaFormat(page, options);
    records.push(...pageRecords);
  }

  return records;
}

/**
 * Export to Alpaca JSONL format (one record per line)
 */
export function exportToAlpacaJSONL(
  pages: AnnotatedPage[],
  options: AlpacaExportOptions = {}
): string {
  const records = exportPagesToAlpaca(pages, options);
  return records.map(r => JSON.stringify(r)).join('\n') + (records.length > 0 ? '\n' : '');
}

/**
 * Async generator for streaming Alpaca export
 */
export async function* exportAsAlpacaStream(
  pages: AsyncIterable<AnnotatedPage>,
  options: AlpacaExportOptions = {}
): AsyncGenerator<string> {
  for await (const page of pages) {
    const records = toAlpacaFormat(page, options);
    for (const record of records) {
      yield JSON.stringify(record) + '\n';
    }
  }
}
