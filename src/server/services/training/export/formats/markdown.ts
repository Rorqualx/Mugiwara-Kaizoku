/**
 * Markdown Export Format
 *
 * Exports training data as clean Markdown for general LLM consumption.
 * Uses cached segments if available, otherwise generates from tokens.
 *
 * @module training/export/formats/markdown
 */


import { tokensToMarkdown, tokensToPlainText } from '@/server/ml/features/segment-extractor';

import { extractPageData, extractEntitiesFromBIO } from '../types';

import type { PageData, ExportOptions, ExtractedEntity } from '../types';
import type { AnnotatedPage } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface MarkdownExportOptions extends ExportOptions {
  includeYamlFrontmatter?: boolean | undefined;
  includeEntityHighlights?: boolean | undefined;
  plainTextOnly?: boolean | undefined;
}

export interface MarkdownExportResult {
  id: string;
  mangaTitle?: string | undefined;
  markdown: string;
  plainText: string;
  frontmatter?: Record<string, unknown> | undefined;
}

// ============================================================================
// Single Page Export
// ============================================================================

/**
 * Transform a single page to Markdown
 */
export function toMarkdownFormat(
  page: AnnotatedPage,
  options: MarkdownExportOptions = {}
): MarkdownExportResult | null {
  const pageData = extractPageData(page);
  if (!pageData) return null;

  return generateMarkdownResult(pageData, options);
}

function generateMarkdownResult(
  pageData: PageData,
  options: MarkdownExportOptions
): MarkdownExportResult {
  const {
    includeYamlFrontmatter = false,
    includeEntityHighlights = false,
    plainTextOnly = false,
  } = options;

  // Use cached segments if available, otherwise generate
  let markdown: string;
  let plainText: string;

  if (pageData.segments) {
    markdown = pageData.segments.markdown;
    plainText = pageData.segments.plainText;
  } else {
    markdown = tokensToMarkdown(pageData.tokens);
    plainText = tokensToPlainText(pageData.tokens);
  }

  // Add entity highlights if requested
  if (includeEntityHighlights && !plainTextOnly) {
    const entities = extractEntitiesFromBIO(pageData.tokens, pageData.labels);
    markdown = addEntityHighlights(markdown, entities);
  }

  const result: MarkdownExportResult = {
    id: pageData.id,
    mangaTitle: pageData.mangaTitle ?? undefined,
    markdown: plainTextOnly ? plainText : markdown,
    plainText,
  };

  // Add YAML frontmatter if requested
  if (includeYamlFrontmatter) {
    result.frontmatter = buildFrontmatter(pageData);
  }

  return result;
}

// ============================================================================
// Entity Highlighting
// ============================================================================

function addEntityHighlights(markdown: string, entities: ExtractedEntity[]): string {
  let highlighted = markdown;

  // Sort entities by text length descending to handle overlapping matches correctly
  const sortedEntities = [...entities].sort((a, b) => b.text.length - a.text.length);

  for (const entity of sortedEntities) {
    // Use word boundary-aware replacement to avoid partial matches
    const escapedText = escapeRegExp(entity.text);
    const pattern = new RegExp(`\\b${escapedText}\\b`, 'g');
    highlighted = highlighted.replace(pattern, `**[${entity.text}]** _(${formatEntityType(entity.type)})_`);
  }

  return highlighted;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatEntityType(type: string): string {
  return type.toLowerCase().replace(/_/g, ' ');
}

// ============================================================================
// Frontmatter Generation
// ============================================================================

function buildFrontmatter(pageData: PageData): Record<string, unknown> {
  const entities = extractEntitiesFromBIO(pageData.tokens, pageData.labels);

  const frontmatter: Record<string, unknown> = {
    id: pageData.id,
    source: pageData.sourceType,
    url: pageData.url,
  };

  if (pageData.mangaTitle) {
    frontmatter['title'] = pageData.mangaTitle;
  }

  // Extract key metadata from entities
  const title = entities.find(e => e.type === 'TITLE');
  const author = entities.find(e => e.type === 'AUTHOR');
  const artist = entities.find(e => e.type === 'ARTIST');
  const status = entities.find(e => e.type === 'STATUS');
  const genres = entities.filter(e => e.type === 'GENRE');

  if (title && !pageData.mangaTitle) frontmatter['title'] = title.text;
  if (author) frontmatter['author'] = author.text;
  if (artist) frontmatter['artist'] = artist.text;
  if (status) frontmatter['status'] = status.text;
  if (genres.length > 0) frontmatter['genres'] = genres.map(g => g.text);

  if (pageData.autoQualityScore !== undefined) {
    frontmatter['quality_score'] = pageData.autoQualityScore;
  }

  if (pageData.qualityTier) {
    frontmatter['quality_tier'] = pageData.qualityTier;
  }

  return frontmatter;
}

// ============================================================================
// Full Document Export
// ============================================================================

/**
 * Export page as complete Markdown document with optional frontmatter
 */
export function toMarkdownDocument(
  page: AnnotatedPage,
  options: MarkdownExportOptions = {}
): string | null {
  const result = toMarkdownFormat(page, { ...options, includeYamlFrontmatter: true });
  if (!result) return null;

  const parts: string[] = [];

  // Add YAML frontmatter
  if (result.frontmatter) {
    parts.push('---');
    parts.push(formatYaml(result.frontmatter));
    parts.push('---');
    parts.push('');
  }

  // Add content
  parts.push(result.markdown);

  return parts.join('\n');
}

function formatYaml(obj: Record<string, unknown>, indent: number = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${prefix}${key}:`);
      for (const item of value) {
        lines.push(`${prefix}  - ${String(item)}`);
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${prefix}${key}:`);
      lines.push(formatYaml(value as Record<string, unknown>, indent + 1));
    } else {
      const formattedValue = typeof value === 'string' && value.includes(':')
        ? `"${value}"`
        : String(value);
      lines.push(`${prefix}${key}: ${formattedValue}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Batch Export
// ============================================================================

/**
 * Export multiple pages to Markdown results
 */
export function exportPagesToMarkdown(
  pages: AnnotatedPage[],
  options: MarkdownExportOptions = {}
): MarkdownExportResult[] {
  const results: MarkdownExportResult[] = [];

  for (const page of pages) {
    const result = toMarkdownFormat(page, options);
    if (result) results.push(result);
  }

  return results;
}

/**
 * Export as Markdown JSONL (each line contains id, title, markdown, plainText)
 */
export function exportToMarkdownJSONL(
  pages: AnnotatedPage[],
  options: MarkdownExportOptions = {}
): string {
  const results = exportPagesToMarkdown(pages, options);
  return results.map(r => JSON.stringify(r)).join('\n') + (results.length > 0 ? '\n' : '');
}

/**
 * Export as concatenated Markdown documents (separated by horizontal rules)
 */
export function exportToConcatenatedMarkdown(
  pages: AnnotatedPage[],
  options: MarkdownExportOptions = {}
): string {
  const documents: string[] = [];

  for (const page of pages) {
    const doc = toMarkdownDocument(page, options);
    if (doc) documents.push(doc);
  }

  return documents.join('\n\n---\n\n');
}

/**
 * Async generator for streaming Markdown export
 */
export async function* exportAsMarkdownStream(
  pages: AsyncIterable<AnnotatedPage>,
  options: MarkdownExportOptions = {}
): AsyncGenerator<string> {
  for await (const page of pages) {
    const result = toMarkdownFormat(page, options);
    if (result) {
      yield JSON.stringify(result) + '\n';
    }
  }
}
