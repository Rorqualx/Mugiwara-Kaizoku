/**
 * Segment Extractor for LLM Training Data
 *
 * Extracts paragraph and section-level segments from linearized tokens.
 * Converts token sequences to Markdown and plain text for LLM consumption.
 *
 * @module segment-extractor
 */

import { v4 as uuidv4 } from 'uuid';

import type { LinearizedToken, SectionType } from './dom-linearizer';

// ============================================================================
// Types
// ============================================================================

export interface Paragraph {
  id: string;
  tokens: LinearizedToken[];
  text: string;
  markdown: string;
  startIndex: number;
  endIndex: number;
  sectionType: SectionType;
}

export interface Section {
  id: string;
  level: number;
  title: string;
  titleTokens: LinearizedToken[];
  paragraphs: Paragraph[];
  subsections: Section[];
  startIndex: number;
  endIndex: number;
}

export interface SegmentationResult {
  paragraphs: Paragraph[];
  sections: Section[];
  markdown: string;
  plainText: string;
  stats: SegmentationStats;
}

export interface SegmentationStats {
  paragraphCount: number;
  sectionCount: number;
  wordCount: number;
  markdownLength: number;
  plainTextLength: number;
}

interface HeaderInfo {
  token: LinearizedToken;
  index: number;
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract segments from linearized tokens
 */
export function extractSegments(tokens: LinearizedToken[]): SegmentationResult {
  if (tokens.length === 0) {
    return createEmptyResult();
  }

  const paragraphs = groupIntoParagraphs(tokens);
  const sections = buildSectionHierarchy(tokens, paragraphs);
  const markdown = tokensToMarkdown(tokens);
  const plainText = tokensToPlainText(tokens);

  return {
    paragraphs,
    sections,
    markdown,
    plainText,
    stats: {
      paragraphCount: paragraphs.length,
      sectionCount: countSections(sections),
      wordCount: tokens.filter(t => t.tokenType === 'word').length,
      markdownLength: markdown.length,
      plainTextLength: plainText.length,
    },
  };
}

function createEmptyResult(): SegmentationResult {
  return {
    paragraphs: [],
    sections: [],
    markdown: '',
    plainText: '',
    stats: { paragraphCount: 0, sectionCount: 0, wordCount: 0, markdownLength: 0, plainTextLength: 0 },
  };
}

// ============================================================================
// Paragraph Grouping
// ============================================================================

function groupIntoParagraphs(tokens: LinearizedToken[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let currentTokens: LinearizedToken[] = [];
  let startIndex = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || token.tokenType === 'image') continue;

    currentTokens.push(token);

    if (isParagraphEnd(token, tokens[i + 1] ?? undefined)) {
      const paragraph = createParagraph(currentTokens, startIndex, i);
      if (paragraph) paragraphs.push(paragraph);
      currentTokens = [];
      startIndex = i + 1;
    }
  }

  // Handle remaining tokens
  const finalParagraph = createParagraph(currentTokens, startIndex, tokens.length - 1);
  if (finalParagraph) paragraphs.push(finalParagraph);

  return paragraphs;
}

function isParagraphEnd(token: LinearizedToken, nextToken?: LinearizedToken): boolean {
  return token.isLastInElement || (nextToken?.isHeader === true && !token.isHeader);
}

function createParagraph(
  tokens: LinearizedToken[],
  startIndex: number,
  endIndex: number
): Paragraph | null {
  if (tokens.length === 0) return null;

  const text = tokens.map(t => t.text).join(' ').trim();
  if (text.length === 0) return null;

  return {
    id: uuidv4(),
    tokens: [...tokens],
    text,
    markdown: tokensToMarkdown(tokens),
    startIndex,
    endIndex,
    sectionType: tokens[0]?.sectionType ?? 'unknown',
  };
}

// ============================================================================
// Section Hierarchy
// ============================================================================

function buildSectionHierarchy(tokens: LinearizedToken[], paragraphs: Paragraph[]): Section[] {
  const headers = findHeaders(tokens);

  if (headers.length === 0) {
    return createImplicitSection(paragraphs, tokens.length);
  }

  return buildSectionsFromHeaders(headers, tokens, paragraphs);
}

function findHeaders(tokens: LinearizedToken[]): HeaderInfo[] {
  const headers: HeaderInfo[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token && token.isHeader && token.headerLevel > 0) {
      headers.push({ token, index: i });
    }
  }
  return headers;
}

function createImplicitSection(paragraphs: Paragraph[], tokenCount: number): Section[] {
  if (paragraphs.length === 0) return [];

  return [{
    id: uuidv4(),
    level: 0,
    title: '',
    titleTokens: [],
    paragraphs,
    subsections: [],
    startIndex: 0,
    endIndex: tokenCount - 1,
  }];
}

function buildSectionsFromHeaders(
  headers: HeaderInfo[],
  tokens: LinearizedToken[],
  paragraphs: Paragraph[]
): Section[] {
  const sections: Section[] = [];
  const sectionStack: Section[] = [];

  for (let i = 0; i < headers.length; i++) {
    const currentHeader = headers[i];
    const nextHeader = headers[i + 1];
    if (!currentHeader) continue;

    const nextHeaderIndex = nextHeader ? nextHeader.index : tokens.length;
    const section = createSection(currentHeader, nextHeaderIndex, tokens, paragraphs);

    insertIntoHierarchy(section, sections, sectionStack);
  }

  return sections;
}

function createSection(
  header: HeaderInfo,
  nextHeaderIndex: number,
  tokens: LinearizedToken[],
  paragraphs: Paragraph[]
): Section {
  const titleTokens = collectTitleTokens(header, nextHeaderIndex, tokens);
  const titleEndIndex = header.index + titleTokens.length - 1;

  return {
    id: uuidv4(),
    level: header.token.headerLevel,
    title: titleTokens.map(t => t.text).join(' ').trim(),
    titleTokens,
    paragraphs: paragraphs.filter(p => p.startIndex > titleEndIndex && p.startIndex < nextHeaderIndex),
    subsections: [],
    startIndex: header.index,
    endIndex: nextHeaderIndex - 1,
  };
}

function collectTitleTokens(header: HeaderInfo, nextHeaderIndex: number, tokens: LinearizedToken[]): LinearizedToken[] {
  const titleTokens: LinearizedToken[] = [header.token];

  for (let j = header.index + 1; j < nextHeaderIndex; j++) {
    const tok = tokens[j];
    if (tok && tok.isHeader && tok.headerLevel === header.token.headerLevel) {
      titleTokens.push(tok);
    } else {
      break;
    }
  }

  return titleTokens;
}

function insertIntoHierarchy(section: Section, sections: Section[], sectionStack: Section[]): void {
  while (sectionStack.length > 0) {
    const top = sectionStack.at(-1);
    if (!top || top.level < section.level) break;
    sectionStack.pop();
  }

  const parent = sectionStack.at(-1);
  if (parent) {
    parent.subsections.push(section);
  } else {
    sections.push(section);
  }

  sectionStack.push(section);
}

// ============================================================================
// Markdown Conversion
// ============================================================================

export function tokensToMarkdown(tokens: LinearizedToken[]): string {
  if (tokens.length === 0) return '';

  const state = { headerLevel: 0, inList: false, inTable: false, lastTableRow: -1 };
  const parts: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;
    const prevToken = i > 0 ? tokens[i - 1] ?? null : null;

    processMarkdownToken(token, prevToken, parts, state);
  }

  return normalizeMarkdown(parts.join(''));
}

interface MarkdownState {
  headerLevel: number;
  inList: boolean;
  inTable: boolean;
  lastTableRow: number;
}

function processMarkdownToken(
  token: LinearizedToken,
  prevToken: LinearizedToken | null,
  parts: string[],
  state: MarkdownState
): void {
  handleHeaderTransition(token, parts, state);
  handleListTransition(token, parts, state);
  handleTableTransition(token, prevToken, parts, state);

  if (token.tokenType === 'image' && token.imageSrc) {
    parts.push(`![${token.imageAlt ?? ''}](${token.imageSrc})`);
    return;
  }

  parts.push(formatTokenText(token));
  addTokenSpacing(token, parts, state);
}

function handleHeaderTransition(token: LinearizedToken, parts: string[], state: MarkdownState): void {
  if (token.isHeader && token.headerLevel !== state.headerLevel) {
    const lastPart = parts.at(-1);
    if (parts.length > 0 && lastPart && !lastPart.endsWith('\n\n')) {
      parts.push('\n\n');
    }
    parts.push('#'.repeat(token.headerLevel) + ' ');
    state.headerLevel = token.headerLevel;
  } else if (!token.isHeader && state.headerLevel > 0) {
    parts.push('\n\n');
    state.headerLevel = 0;
  }
}

function handleListTransition(token: LinearizedToken, parts: string[], state: MarkdownState): void {
  if (token.isInList && !state.inList) {
    const lastPart = parts.at(-1);
    if (parts.length > 0 && lastPart && !lastPart.endsWith('\n')) {
      parts.push('\n');
    }
    parts.push('- ');
    state.inList = true;
  } else if (!token.isInList && state.inList) {
    parts.push('\n');
    state.inList = false;
  }
}

function handleTableTransition(
  token: LinearizedToken,
  prevToken: LinearizedToken | null,
  parts: string[],
  state: MarkdownState
): void {
  if (token.isInTable && token.tableRow !== null) {
    if (!state.inTable) {
      const lastPart = parts.at(-1);
      if (parts.length > 0 && lastPart && !lastPart.endsWith('\n')) {
        parts.push('\n');
      }
      state.inTable = true;
      state.lastTableRow = token.tableRow;
    } else if (token.tableRow !== state.lastTableRow) {
      parts.push(' |\n| ');
      state.lastTableRow = token.tableRow;
    } else if (prevToken?.tableCol !== token.tableCol) {
      parts.push(' | ');
    }
  } else if (!token.isInTable && state.inTable) {
    parts.push(' |\n\n');
    state.inTable = false;
    state.lastTableRow = -1;
  }
}

function formatTokenText(token: LinearizedToken): string {
  let text = token.text;

  if (token.isBold && token.isItalic) {
    text = `***${text}***`;
  } else if (token.isBold) {
    text = `**${text}**`;
  } else if (token.isItalic) {
    text = `*${text}*`;
  }

  if (token.isLink && token.linkHref) {
    text = `[${text}](${token.linkHref})`;
  }

  return text;
}

function addTokenSpacing(token: LinearizedToken, parts: string[], state: MarkdownState): void {
  if (token.isLastInElement && !token.isHeader) {
    if (state.inList) {
      parts.push('\n- ');
    } else if (!state.inTable) {
      parts.push('\n');
    }
  } else if (!state.inTable) {
    parts.push(' ');
  }
}

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/gm, '')
    .trim();
}

/**
 * Convert tokens to plain text (no formatting)
 */
export function tokensToPlainText(tokens: LinearizedToken[]): string {
  return tokens
    .filter(t => t.tokenType !== 'image')
    .map(t => t.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Helpers
// ============================================================================

function countSections(sections: Section[]): number {
  let count = sections.length;
  for (const section of sections) {
    count += countSections(section.subsections);
  }
  return count;
}

export function getAllParagraphs(sections: Section[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  collectParagraphsRecursive(sections, paragraphs);
  return paragraphs;
}

function collectParagraphsRecursive(sectionList: Section[], paragraphs: Paragraph[]): void {
  for (const section of sectionList) {
    paragraphs.push(...section.paragraphs);
    collectParagraphsRecursive(section.subsections, paragraphs);
  }
}

export function findSectionByTitle(sections: Section[], title: string): Section | undefined {
  const normalizedTitle = title.toLowerCase().trim();
  return searchSectionByTitle(sections, normalizedTitle);
}

function searchSectionByTitle(sectionList: Section[], normalizedTitle: string): Section | undefined {
  for (const section of sectionList) {
    if (section.title.toLowerCase().trim() === normalizedTitle) {
      return section;
    }
    const found = searchSectionByTitle(section.subsections, normalizedTitle);
    if (found) return found;
  }
  return undefined;
}

export function getSectionsByLevel(sections: Section[], level: number): Section[] {
  const result: Section[] = [];
  collectSectionsByLevel(sections, level, result);
  return result;
}

function collectSectionsByLevel(sectionList: Section[], level: number, result: Section[]): void {
  for (const section of sectionList) {
    if (section.level === level) {
      result.push(section);
    }
    collectSectionsByLevel(section.subsections, level, result);
  }
}
