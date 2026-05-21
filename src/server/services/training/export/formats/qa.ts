/**
 * Q&A Format Export
 *
 * Exports training data as question-answer pairs with context.
 * Suitable for reading comprehension and extractive QA training.
 *
 * @module training/export/formats/qa
 */

import {
  extractPageData,
  extractEntitiesFromBIO,
  getContextAroundEntity,
  generateQuestionForEntity,
} from '../types';

import type { PageData, QARecord, ExportOptions, ExtractedEntity } from '../types';
import type { AnnotatedPage } from '@prisma/client';


// ============================================================================
// Types
// ============================================================================

export interface QAExportOptions extends ExportOptions {
  contextTokens?: number | undefined;
  entityTypes?: string[] | undefined;
  includeNegativeExamples?: boolean | undefined;
  questionVariants?: boolean | undefined;
}

// ============================================================================
// Single Page Export
// ============================================================================

/**
 * Transform a single page to Q&A records
 */
export function toQAFormat(
  page: AnnotatedPage,
  options: QAExportOptions = {}
): QARecord[] {
  const pageData = extractPageData(page);
  if (!pageData) return [];

  return generateQARecords(pageData, options);
}

function generateQARecords(
  pageData: PageData,
  options: QAExportOptions
): QARecord[] {
  const {
    contextTokens = 100,
    entityTypes,
    includeNegativeExamples = false,
    questionVariants = false,
    includeMetadata = true,
  } = options;

  const records: QARecord[] = [];
  const entities = extractEntitiesFromBIO(pageData.tokens, pageData.labels);

  // Filter entities by type if specified
  const filteredEntities = entityTypes
    ? entities.filter(e => entityTypes.includes(e.type))
    : entities;

  // Generate Q&A for each entity
  for (const entity of filteredEntities) {
    const primaryRecord = createQARecord(pageData, entity, contextTokens, includeMetadata);
    records.push(primaryRecord);

    // Add question variants if enabled
    if (questionVariants) {
      const variants = createQuestionVariants(pageData, entity, contextTokens, includeMetadata);
      records.push(...variants);
    }
  }

  // Add negative examples (unanswerable questions)
  if (includeNegativeExamples) {
    const negatives = createNegativeExamples(pageData, filteredEntities, contextTokens, includeMetadata);
    records.push(...negatives);
  }

  return records;
}

// ============================================================================
// Record Generators
// ============================================================================

function createQARecord(
  pageData: PageData,
  entity: ExtractedEntity,
  contextTokens: number,
  includeMetadata: boolean
): QARecord {
  const question = generateQuestionForEntity(entity.type, pageData.mangaTitle);
  const context = getContextAroundEntity(pageData.tokens, entity, contextTokens);

  const record: QARecord = {
    question,
    answer: entity.text,
    context,
  };

  if (includeMetadata) {
    record.metadata = {
      source: pageData.sourceType,
      pageId: pageData.id,
      mangaTitle: pageData.mangaTitle,
      entityType: entity.type,
      answerStart: entity.startIndex,
      answerEnd: entity.endIndex,
    };
  }

  return record;
}

function createQuestionVariants(
  pageData: PageData,
  entity: ExtractedEntity,
  contextTokens: number,
  includeMetadata: boolean
): QARecord[] {
  const variants: QARecord[] = [];
  const context = getContextAroundEntity(pageData.tokens, entity, contextTokens);
  const variantQuestions = generateVariantQuestions(entity.type, pageData.mangaTitle);

  for (const question of variantQuestions) {
    const record: QARecord = {
      question,
      answer: entity.text,
      context,
    };

    if (includeMetadata) {
      record.metadata = {
        source: pageData.sourceType,
        pageId: pageData.id,
        mangaTitle: pageData.mangaTitle,
        entityType: entity.type,
        isVariant: true,
      };
    }

    variants.push(record);
  }

  return variants;
}

function createNegativeExamples(
  pageData: PageData,
  existingEntities: ExtractedEntity[],
  contextTokens: number,
  includeMetadata: boolean
): QARecord[] {
  const negatives: QARecord[] = [];
  const existingTypeStrings = new Set(existingEntities.map(e => e.type as string));
  const allTypes = ['TITLE', 'AUTHOR', 'ARTIST', 'GENRE', 'STATUS', 'SERIES_SUMMARY', 'PUBLISHER'];

  // Find entity types NOT present in this page
  const missingTypes = allTypes.filter(t => !existingTypeStrings.has(t));

  // Get general context (first portion of document)
  const generalContext = pageData.tokens.slice(0, contextTokens * 2).map(t => t.text).join(' ');

  for (const missingType of missingTypes.slice(0, 2)) {
    const question = generateQuestionForEntity(missingType as ExtractedEntity['type'], pageData.mangaTitle);

    const record: QARecord = {
      question,
      answer: '', // Empty answer indicates unanswerable
      context: generalContext,
    };

    if (includeMetadata) {
      record.metadata = {
        source: pageData.sourceType,
        pageId: pageData.id,
        mangaTitle: pageData.mangaTitle,
        entityType: missingType,
        isNegative: true,
        isUnanswerable: true,
      };
    }

    negatives.push(record);
  }

  return negatives;
}

// ============================================================================
// Question Variants
// ============================================================================

function generateVariantQuestions(
  entityType: string,
  mangaTitle?: string | null
): string[] {
  const mangaRef = mangaTitle ? `"${mangaTitle}"` : 'the manga';
  const variants: string[] = [];

  const variantTemplates: Record<string, string[]> = {
    TITLE: [
      `What is ${mangaRef} called?`,
      `Name of ${mangaRef}?`,
    ],
    AUTHOR: [
      `Who wrote ${mangaRef}?`,
      `Who is the creator of ${mangaRef}?`,
    ],
    ARTIST: [
      `Who illustrated ${mangaRef}?`,
      `Who drew ${mangaRef}?`,
    ],
    GENRE: [
      `What type of manga is ${mangaRef}?`,
      `${mangaRef} belongs to which genre?`,
    ],
    STATUS: [
      `Is ${mangaRef} still ongoing?`,
      `What is the current status of ${mangaRef}?`,
    ],
    SUMMARY: [
      `What happens in ${mangaRef}?`,
      `Describe the plot of ${mangaRef}.`,
    ],
    PUBLISHER: [
      `Which company publishes ${mangaRef}?`,
      `Who is the publisher of ${mangaRef}?`,
    ],
  };

  const templates = variantTemplates[entityType];
  if (templates) {
    variants.push(...templates);
  }

  return variants;
}

// ============================================================================
// Batch Export
// ============================================================================

/**
 * Export multiple pages to Q&A format
 */
export function exportPagesToQA(
  pages: AnnotatedPage[],
  options: QAExportOptions = {}
): QARecord[] {
  const records: QARecord[] = [];

  for (const page of pages) {
    const pageRecords = toQAFormat(page, options);
    records.push(...pageRecords);
  }

  return records;
}

/**
 * Export to Q&A JSONL format
 */
export function exportToQAJSONL(
  pages: AnnotatedPage[],
  options: QAExportOptions = {}
): string {
  const records = exportPagesToQA(pages, options);
  return records.map(r => JSON.stringify(r)).join('\n') + (records.length > 0 ? '\n' : '');
}

/**
 * Export to SQuAD-like format
 */
export function exportToSQuADFormat(
  pages: AnnotatedPage[],
  _options: QAExportOptions = {}
): { data: Array<{ title: string; paragraphs: Array<{ context: string; qas: Array<{ id: string; question: string; answers: Array<{ text: string; answer_start: number }> }> }> }> } {
  const squadData: Array<{
    title: string;
    paragraphs: Array<{
      context: string;
      qas: Array<{
        id: string;
        question: string;
        answers: Array<{ text: string; answer_start: number }>;
      }>;
    }>;
  }> = [];

  for (const page of pages) {
    const pageData = extractPageData(page);
    if (!pageData) continue;

    const entities = extractEntitiesFromBIO(pageData.tokens, pageData.labels);
    const context = pageData.segments?.plainText ?? pageData.tokens.map(t => t.text).join(' ');

    const qas = entities.map((entity, idx) => ({
      id: `${pageData.id}-${idx}`,
      question: generateQuestionForEntity(entity.type, pageData.mangaTitle),
      answers: [{
        text: entity.text,
        answer_start: context.indexOf(entity.text),
      }],
    }));

    squadData.push({
      title: pageData.mangaTitle ?? pageData.id,
      paragraphs: [{ context, qas }],
    });
  }

  return { data: squadData };
}

/**
 * Async generator for streaming Q&A export
 */
export async function* exportAsQAStream(
  pages: AsyncIterable<AnnotatedPage>,
  options: QAExportOptions = {}
): AsyncGenerator<string> {
  for await (const page of pages) {
    const records = toQAFormat(page, options);
    for (const record of records) {
      yield JSON.stringify(record) + '\n';
    }
  }
}
