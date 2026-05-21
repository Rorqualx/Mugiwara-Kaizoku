/**
 * Export Types and Shared Utilities
 *
 * Common types and utilities for LLM training data export formats.
 *
 * @module training/export/types
 */


import type { BIOTag, EntityType } from '@/server/ml/features/bio-types';
import { parseBIOTag } from '@/server/ml/features/bio-types';
import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';
import type { ImageLabel } from '@/types/training/image-labels';

import type { AnnotatedPage } from '@prisma/client';

// ============================================================================
// Core Export Types
// ============================================================================

export interface ExtractedEntity {
  type: EntityType;
  text: string;
  tokens: LinearizedToken[];
  startIndex: number;
  endIndex: number;
  confidence?: number;
}

export interface ExportContext {
  mangaTitle?: string;
  sourceType: string;
  pageId: string;
  pageUrl: string;
}

export interface ExportOptions {
  includeMetadata?: boolean | undefined;
  maxContextTokens?: number | undefined;
  includeConfidence?: boolean | undefined;
}

// ============================================================================
// Format-Specific Record Types
// ============================================================================

export interface AlpacaRecord {
  instruction: string;
  input: string;
  output: string;
  metadata?: Record<string, unknown>;
}

export interface ShareGPTRecord {
  conversations: Array<{ from: 'human' | 'gpt'; value: string }>;
  metadata?: Record<string, unknown>;
}

export interface QARecord {
  question: string;
  answer: string;
  context: string;
  metadata?: Record<string, unknown>;
}

export interface NERSpanRecord {
  text: string;
  entities: Array<{
    text: string;
    label: string;
    start: number;
    end: number;
  }>;
  metadata?: Record<string, unknown>;
}

export interface JSONLRecord {
  id: string;
  url: string;
  mangaTitle?: string | undefined;
  sourceType: string;
  tokens: Array<{ text: string; label: string }>;
  entities: ExtractedEntity[];
  markdown?: string | undefined;
  plainText?: string | undefined;
  quality?: {
    autoScore?: number | undefined;
    tier?: string | undefined;
  } | undefined;
  imageLabels?: ImageLabel[] | undefined;
}

// ============================================================================
// Page Data Extraction
// ============================================================================

export interface PageData {
  id: string;
  url: string;
  mangaTitle: string | null;
  sourceType: string;
  tokens: LinearizedToken[];
  labels: BIOTag[];
  segments?: {
    markdown: string;
    plainText: string;
  } | undefined;
  autoQualityScore?: number | undefined;
  qualityTier?: string | undefined;
  imageLabels?: ImageLabel[] | undefined;
}

/**
 * Extract typed page data from AnnotatedPage
 * Uses type assertion for new schema fields that may not be in generated Prisma types yet
 */
export function extractPageData(page: AnnotatedPage): PageData | null {
  const tokens = page.tokens as unknown;
  const labels = page.labels as unknown;

  if (!Array.isArray(tokens) || !Array.isArray(labels)) {
    return null;
  }

  const segments = page.segments as { markdown?: string; plainText?: string } | null;
  const segmentsData = segments
    ? { markdown: segments.markdown ?? '', plainText: segments.plainText ?? '' }
    : undefined;

  const rawImageLabels = page.imageLabels as unknown;
  const imageLabels = Array.isArray(rawImageLabels) ? (rawImageLabels as ImageLabel[]) : undefined;

  return {
    id: page.id,
    url: page.url,
    mangaTitle: page.mangaTitle,
    sourceType: page.sourceType,
    tokens: tokens as LinearizedToken[],
    labels: labels as BIOTag[],
    segments: segmentsData,
    autoQualityScore: page.autoQualityScore ?? undefined,
    qualityTier: page.qualityTier ?? undefined,
    imageLabels,
  };
}

// ============================================================================
// BIO Entity Extraction
// ============================================================================

interface EntityBuilder {
  type: EntityType;
  tokens: LinearizedToken[];
  startIndex: number;
}

/**
 * Extract entities from BIO-tagged token sequences
 */
export function extractEntitiesFromBIO(
  tokens: LinearizedToken[],
  labels: BIOTag[]
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  let currentEntity: EntityBuilder | null = null;

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!label) continue;

    const parsed = parseBIOTag(label);
    if (!parsed) continue;

    const token = tokens[i];
    const result = processLabelForEntity(parsed, currentEntity, token, i);

    if (result.finalized) {
      entities.push(result.finalized);
    }
    currentEntity = result.current;
  }

  // Finalize last entity
  if (currentEntity) {
    entities.push(finalizeEntity(currentEntity, labels.length - 1));
  }

  return entities;
}

interface ParsedLabel {
  prefix: 'O' | 'B' | 'I';
  entity: EntityType | null;
}

interface ProcessResult {
  finalized: ExtractedEntity | null;
  current: EntityBuilder | null;
}

function processLabelForEntity(
  parsed: ParsedLabel,
  currentEntity: EntityBuilder | null,
  token: LinearizedToken | undefined,
  index: number
): ProcessResult {
  if (parsed.prefix === 'B' && parsed.entity) {
    return handleBeginTag(parsed.entity, currentEntity, token, index);
  }

  if (parsed.prefix === 'I' && parsed.entity && currentEntity) {
    return handleInsideTag(parsed.entity, currentEntity, token, index);
  }

  if (parsed.prefix === 'O' && currentEntity) {
    return { finalized: finalizeEntity(currentEntity, index - 1), current: null };
  }

  return { finalized: null, current: currentEntity };
}

function handleBeginTag(
  entityType: EntityType,
  currentEntity: EntityBuilder | null,
  token: LinearizedToken | undefined,
  index: number
): ProcessResult {
  const finalized = currentEntity ? finalizeEntity(currentEntity, index - 1) : null;
  const newEntity: EntityBuilder = {
    type: entityType,
    tokens: token ? [token] : [],
    startIndex: index,
  };
  return { finalized, current: newEntity };
}

function handleInsideTag(
  entityType: EntityType,
  currentEntity: EntityBuilder,
  token: LinearizedToken | undefined,
  index: number
): ProcessResult {
  if (entityType === currentEntity.type) {
    if (token) currentEntity.tokens.push(token);
    return { finalized: null, current: currentEntity };
  }

  // Different type - finalize current and start new
  const finalized = finalizeEntity(currentEntity, index - 1);
  const newEntity: EntityBuilder = {
    type: entityType,
    tokens: token ? [token] : [],
    startIndex: index,
  };
  return { finalized, current: newEntity };
}

function finalizeEntity(entity: EntityBuilder, endIndex: number): ExtractedEntity {
  return {
    type: entity.type,
    text: entity.tokens.map(t => t.text).join(' ').trim(),
    tokens: entity.tokens,
    startIndex: entity.startIndex,
    endIndex,
  };
}

// ============================================================================
// Context Extraction
// ============================================================================

/**
 * Get context around an entity for training data
 */
export function getContextAroundEntity(
  tokens: LinearizedToken[],
  entity: ExtractedEntity,
  contextTokens: number = 50
): string {
  const startContext = Math.max(0, entity.startIndex - contextTokens);
  const endContext = Math.min(tokens.length, entity.endIndex + contextTokens + 1);

  const contextSlice = tokens.slice(startContext, endContext);
  return contextSlice.map(t => t.text).join(' ').trim();
}

/**
 * Get full document text from tokens
 */
export function getFullText(tokens: LinearizedToken[]): string {
  return tokens.map(t => t.text).join(' ').trim();
}

// ============================================================================
// Question Generation
// ============================================================================

const ENTITY_QUESTIONS: Record<string, string> = {
  TITLE: 'What is the title of this manga?',
  ALT_TITLE: 'What are the alternative titles for this manga?',
  AUTHOR: 'Who is the author of this manga?',
  ARTIST: 'Who is the artist of this manga?',
  GENRE: 'What genre is this manga?',
  STATUS: 'What is the publication status of this manga?',
  SUMMARY: 'What is this manga about?',
  PUBLISHER: 'Who published this manga?',
  MAGAZINE: 'In which magazine was this manga serialized?',
  DEMOGRAPHIC: 'What is the target demographic for this manga?',
  RELEASE_DATE: 'When was this manga released?',
  VOLUME_COUNT: 'How many volumes does this manga have?',
  CHAPTER_COUNT: 'How many chapters does this manga have?',
  TAGS: 'What tags describe this manga?',
  THEMES: 'What themes are explored in this manga?',
  CHARACTERS: 'Who are the main characters in this manga?',
  FORMAT: 'What format is this manga?',
};

/**
 * Generate a question for extracting a specific entity type
 */
export function generateQuestionForEntity(
  entityType: EntityType,
  mangaTitle?: string | null
): string {
  const baseQuestion = ENTITY_QUESTIONS[entityType];

  if (baseQuestion && mangaTitle) {
    return baseQuestion.replace('this manga', `"${mangaTitle}"`);
  }

  return baseQuestion ?? `What is the ${entityType.toLowerCase().replace(/_/g, ' ')} of this manga?`;
}

/**
 * Generate extraction instruction for a specific entity type
 */
export function generateExtractionInstruction(
  entityType: EntityType,
  mangaTitle?: string | null
): string {
  const entityName = entityType.toLowerCase().replace(/_/g, ' ');
  const subject = mangaTitle ? `the manga "${mangaTitle}"` : 'this manga';

  return `Extract the ${entityName} from the following description of ${subject}.`;
}
