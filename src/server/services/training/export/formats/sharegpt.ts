/**
 * ShareGPT Format Export
 *
 * Exports training data in ShareGPT conversational format.
 * Format: { conversations: [{ from: 'human'|'gpt', value: string }], metadata? }
 *
 * @module training/export/formats/sharegpt
 */

import {
  extractPageData,
  extractEntitiesFromBIO,
  generateQuestionForEntity,
} from '../types';

import type {
  PageData,
  ShareGPTRecord,
  ExportOptions,
  ExtractedEntity,
} from '../types';
import type { AnnotatedPage } from '@prisma/client';


// ============================================================================
// Types
// ============================================================================

export interface ShareGPTExportOptions extends ExportOptions {
  entityTypes?: string[] | undefined;
  includeMultiTurn?: boolean | undefined;
  maxConversationLength?: number | undefined;
}

// ============================================================================
// Single Page Export
// ============================================================================

/**
 * Transform a single page to ShareGPT records
 * Generates Q&A conversations from entities
 */
export function toShareGPTFormat(
  page: AnnotatedPage,
  options: ShareGPTExportOptions = {}
): ShareGPTRecord[] {
  const pageData = extractPageData(page);
  if (!pageData) return [];

  return generateShareGPTRecords(pageData, options);
}

function generateShareGPTRecords(
  pageData: PageData,
  options: ShareGPTExportOptions
): ShareGPTRecord[] {
  const {
    entityTypes,
    includeMultiTurn = true,
    includeMetadata = true,
  } = options;

  const records: ShareGPTRecord[] = [];
  const entities = extractEntitiesFromBIO(pageData.tokens, pageData.labels);

  // Filter entities by type if specified
  const filteredEntities = entityTypes
    ? entities.filter(e => entityTypes.includes(e.type))
    : entities;

  // Generate single-turn Q&A for each entity
  for (const entity of filteredEntities) {
    const record = createSingleTurnRecord(pageData, entity, includeMetadata);
    records.push(record);
  }

  // Generate multi-turn conversations grouping related entities
  if (includeMultiTurn && filteredEntities.length >= 2) {
    const multiTurnRecords = createMultiTurnRecords(pageData, filteredEntities, includeMetadata);
    records.push(...multiTurnRecords);
  }

  return records;
}

// ============================================================================
// Record Generators
// ============================================================================

function createSingleTurnRecord(
  pageData: PageData,
  entity: ExtractedEntity,
  includeMetadata: boolean
): ShareGPTRecord {
  const question = generateQuestionForEntity(entity.type, pageData.mangaTitle);

  const record: ShareGPTRecord = {
    conversations: [
      { from: 'human', value: question },
      { from: 'gpt', value: entity.text },
    ],
  };

  if (includeMetadata) {
    record.metadata = {
      source: pageData.sourceType,
      pageId: pageData.id,
      mangaTitle: pageData.mangaTitle,
      entityType: entity.type,
      conversationType: 'single_turn',
    };
  }

  return record;
}

function createMultiTurnRecords(
  pageData: PageData,
  entities: ExtractedEntity[],
  includeMetadata: boolean
): ShareGPTRecord[] {
  const records: ShareGPTRecord[] = [];

  // Group by category for multi-turn
  const entityGroups = groupEntitiesByCategory(entities);

  for (const [category, groupEntities] of Object.entries(entityGroups)) {
    if (groupEntities.length < 2) continue;

    const record = createGroupConversation(pageData, category, groupEntities, includeMetadata);
    records.push(record);
  }

  // Create a comprehensive overview conversation
  if (entities.length >= 3) {
    const overviewRecord = createOverviewConversation(pageData, entities, includeMetadata);
    records.push(overviewRecord);
  }

  return records;
}

function createGroupConversation(
  pageData: PageData,
  category: string,
  entities: ExtractedEntity[],
  includeMetadata: boolean
): ShareGPTRecord {
  const mangaRef = pageData.mangaTitle ? `"${pageData.mangaTitle}"` : 'this manga';
  const conversations: Array<{ from: 'human' | 'gpt'; value: string }> = [];

  // Opening question about the category
  conversations.push({
    from: 'human',
    value: `Tell me about the ${category.toLowerCase()} of ${mangaRef}.`,
  });

  // Combined answer
  const answers = entities.map(e => `${formatEntityType(e.type)}: ${e.text}`);
  conversations.push({
    from: 'gpt',
    value: answers.join('\n'),
  });

  // Follow-up for each specific entity
  for (const entity of entities.slice(0, 2)) {
    conversations.push({
      from: 'human',
      value: `Can you tell me more about the ${formatEntityType(entity.type).toLowerCase()}?`,
    });
    conversations.push({
      from: 'gpt',
      value: entity.text,
    });
  }

  const record: ShareGPTRecord = { conversations };

  if (includeMetadata) {
    record.metadata = {
      source: pageData.sourceType,
      pageId: pageData.id,
      mangaTitle: pageData.mangaTitle,
      category,
      conversationType: 'multi_turn_group',
    };
  }

  return record;
}

function createOverviewConversation(
  pageData: PageData,
  entities: ExtractedEntity[],
  includeMetadata: boolean
): ShareGPTRecord {
  const mangaRef = pageData.mangaTitle ? `"${pageData.mangaTitle}"` : 'this manga';
  const conversations: Array<{ from: 'human' | 'gpt'; value: string }> = [];

  // Initial overview question
  conversations.push({
    from: 'human',
    value: `Give me an overview of ${mangaRef}.`,
  });

  // Build comprehensive overview
  const overviewParts: string[] = [];
  const title = entities.find(e => e.type === 'TITLE');
  const author = entities.find(e => e.type === 'AUTHOR');
  const summary = entities.find(e => e.type === 'SERIES_SUMMARY');
  const genres = entities.filter(e => e.type === 'GENRE');

  if (title) overviewParts.push(`Title: ${title.text}`);
  if (author) overviewParts.push(`Author: ${author.text}`);
  if (genres.length > 0) overviewParts.push(`Genres: ${genres.map(g => g.text).join(', ')}`);
  if (summary) overviewParts.push(`\nSynopsis: ${summary.text}`);

  conversations.push({
    from: 'gpt',
    value: overviewParts.join('\n') || 'No detailed information available.',
  });

  const record: ShareGPTRecord = { conversations };

  if (includeMetadata) {
    record.metadata = {
      source: pageData.sourceType,
      pageId: pageData.id,
      mangaTitle: pageData.mangaTitle,
      conversationType: 'overview',
    };
  }

  return record;
}

// ============================================================================
// Helpers
// ============================================================================

const ENTITY_CATEGORIES: Record<string, string[]> = {
  'creators': ['AUTHOR', 'ARTIST'],
  'publication': ['PUBLISHER', 'MAGAZINE', 'STATUS', 'RELEASE_DATE'],
  'content': ['GENRE', 'TAGS', 'THEMES', 'DEMOGRAPHIC'],
  'story': ['SERIES_SUMMARY', 'CHARACTERS'],
  'metadata': ['TITLE', 'ALT_TITLE', 'VOLUME_COUNT', 'CHAPTER_COUNT'],
};

function groupEntitiesByCategory(entities: ExtractedEntity[]): Record<string, ExtractedEntity[]> {
  const groups: Record<string, ExtractedEntity[]> = {};

  for (const entity of entities) {
    const category = findCategoryForEntity(entity.type);
    groups[category] ??= [];
    groups[category].push(entity);
  }

  return groups;
}

function findCategoryForEntity(entityType: string): string {
  for (const [category, types] of Object.entries(ENTITY_CATEGORIES)) {
    if (types.includes(entityType)) return category;
  }
  return 'other';
}

function formatEntityType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// Batch Export
// ============================================================================

/**
 * Export multiple pages to ShareGPT format
 */
export function exportPagesToShareGPT(
  pages: AnnotatedPage[],
  options: ShareGPTExportOptions = {}
): ShareGPTRecord[] {
  const records: ShareGPTRecord[] = [];

  for (const page of pages) {
    const pageRecords = toShareGPTFormat(page, options);
    records.push(...pageRecords);
  }

  return records;
}

/**
 * Export to ShareGPT JSONL format
 */
export function exportToShareGPTJSONL(
  pages: AnnotatedPage[],
  options: ShareGPTExportOptions = {}
): string {
  const records = exportPagesToShareGPT(pages, options);
  return records.map(r => JSON.stringify(r)).join('\n') + (records.length > 0 ? '\n' : '');
}

/**
 * Async generator for streaming ShareGPT export
 */
export async function* exportAsShareGPTStream(
  pages: AsyncIterable<AnnotatedPage>,
  options: ShareGPTExportOptions = {}
): AsyncGenerator<string> {
  for await (const page of pages) {
    const records = toShareGPTFormat(page, options);
    for (const record of records) {
      yield JSON.stringify(record) + '\n';
    }
  }
}
