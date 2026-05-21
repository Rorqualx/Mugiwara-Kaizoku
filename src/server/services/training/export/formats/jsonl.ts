/**
 * JSONL Export Format
 *
 * Exports training data as newline-delimited JSON for streaming processing.
 * Each line is a complete, self-contained JSON record.
 *
 * @module training/export/formats/jsonl
 */

import { extractPageData, extractEntitiesFromBIO } from '../types';

import type { PageData, JSONLRecord, ExportOptions } from '../types';
import type { AnnotatedPage } from '@prisma/client';


// ============================================================================
// Types
// ============================================================================

export interface JSONLExportOptions extends ExportOptions {
  includeTokens?: boolean | undefined;
  includeEntities?: boolean | undefined;
  includeSegments?: boolean | undefined;
  includeQuality?: boolean | undefined;
  includeImageLabels?: boolean | undefined;
}

// ============================================================================
// Single Page Export
// ============================================================================

/**
 * Transform a single page to JSONL record
 */
export function toJSONLRecord(
  page: AnnotatedPage,
  options: JSONLExportOptions = {}
): JSONLRecord | null {
  const pageData = extractPageData(page);
  if (!pageData) return null;

  return transformPageToRecord(pageData, options);
}

function transformPageToRecord(
  pageData: PageData,
  options: JSONLExportOptions
): JSONLRecord {
  const {
    includeTokens = true,
    includeEntities = true,
    includeSegments = true,
    includeQuality = true,
    includeImageLabels = true,
  } = options;

  const record: JSONLRecord = {
    id: pageData.id,
    url: pageData.url,
    mangaTitle: pageData.mangaTitle ?? undefined,
    sourceType: pageData.sourceType,
    tokens: [],
    entities: [],
  };

  if (includeTokens) {
    record.tokens = pageData.tokens.map((token, i) => ({
      text: token.text,
      label: pageData.labels[i] ?? 'O',
    }));
  }

  if (includeEntities) {
    record.entities = extractEntitiesFromBIO(pageData.tokens, pageData.labels);
  }

  if (includeSegments && pageData.segments) {
    record.markdown = pageData.segments.markdown;
    record.plainText = pageData.segments.plainText;
  }

  if (includeQuality && (pageData.autoQualityScore !== undefined || pageData.qualityTier)) {
    record.quality = {
      autoScore: pageData.autoQualityScore,
      tier: pageData.qualityTier,
    };
  }

  if (includeImageLabels && pageData.imageLabels && pageData.imageLabels.length > 0) {
    record.imageLabels = pageData.imageLabels;
  }

  return record;
}

// ============================================================================
// Streaming Export
// ============================================================================

/**
 * Export pages as JSONL stream (async generator)
 * Each yield is one complete JSON line
 */
export async function* exportAsJSONL(
  pages: AsyncIterable<AnnotatedPage>,
  options: JSONLExportOptions = {}
): AsyncGenerator<string> {
  for await (const page of pages) {
    const record = toJSONLRecord(page, options);
    if (record) {
      yield JSON.stringify(record) + '\n';
    }
  }
}

/**
 * Export array of pages to JSONL string
 */
export function exportPagesToJSONL(
  pages: AnnotatedPage[],
  options: JSONLExportOptions = {}
): string {
  const lines: string[] = [];

  for (const page of pages) {
    const record = toJSONLRecord(page, options);
    if (record) {
      lines.push(JSON.stringify(record));
    }
  }

  return lines.join('\n') + (lines.length > 0 ? '\n' : '');
}

// ============================================================================
// Batch Processing
// ============================================================================

export interface JSONLBatchResult {
  content: string;
  recordCount: number;
  skippedCount: number;
}

/**
 * Export batch of pages to JSONL with stats
 */
export function exportBatchToJSONL(
  pages: AnnotatedPage[],
  options: JSONLExportOptions = {}
): JSONLBatchResult {
  const lines: string[] = [];
  let skippedCount = 0;

  for (const page of pages) {
    const record = toJSONLRecord(page, options);
    if (record) {
      lines.push(JSON.stringify(record));
    } else {
      skippedCount++;
    }
  }

  return {
    content: lines.join('\n') + (lines.length > 0 ? '\n' : ''),
    recordCount: lines.length,
    skippedCount,
  };
}
