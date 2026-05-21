/**
 * Pattern Detection Functions
 *
 * Implements detection for various HTML structural patterns.
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import { LABEL_TO_ENTITY } from './label-mapping';
import { PATTERN_CONFIDENCE_BOOSTS, type PatternSignal } from './types';

// ============================================================================
// Label:Value Pattern Detection
// ============================================================================

export function detectLabelColonValuePatterns(tokens: LinearizedToken[]): PatternSignal[] {
  const patterns: PatternSignal[] = [];

  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (!token) continue;

    const colonPattern = detectColonEndingPattern(tokens, token, i);
    if (colonPattern) patterns.push(colonPattern);

    const spacedPattern = detectSpacedColonPattern(tokens, token, i);
    if (spacedPattern) patterns.push(spacedPattern);
  }

  return patterns;
}

function detectColonEndingPattern(
  tokens: LinearizedToken[],
  token: LinearizedToken,
  index: number
): PatternSignal | null {
  const text = token.text.trim();
  if (!text.endsWith(':')) return null;

  const labelText = text.slice(0, -1).toLowerCase().trim();
  const entityType = LABEL_TO_ENTITY[labelText] ?? null;
  if (!entityType) return null;

  // Skip "Story:" when preceded by "Side" or "Bonus" - these are chapter titles, not author credits
  // The fandom-list-page-side-story rule handles these as CHAPTER_TITLE
  if (labelText === 'story' && index > 0) {
    const prevToken = tokens[index - 1];
    if (prevToken && /^(side|bonus)$/i.test(prevToken.text.trim())) {
      return null;
    }
  }

  const valueIndices = collectValueTokenIndices(tokens, index + 1, 5);
  if (valueIndices.length === 0) return null;

  return {
    type: 'label_colon_value',
    labelText,
    entityType,
    valueTokenIndices: valueIndices,
    confidence: PATTERN_CONFIDENCE_BOOSTS.label_colon_value,
    source: `colon_pattern:${labelText}`,
  };
}

function detectSpacedColonPattern(
  tokens: LinearizedToken[],
  token: LinearizedToken,
  index: number
): PatternSignal | null {
  if (index >= tokens.length - 2) return null;

  const nextToken = tokens[index + 1];
  if (nextToken?.text.trim() !== ':') return null;

  const labelText = token.text.toLowerCase().trim();
  const entityType = LABEL_TO_ENTITY[labelText] ?? null;
  if (!entityType) return null;

  // Skip "Story :" when preceded by "Side" or "Bonus" - these are chapter titles, not author credits
  // The fandom-list-page-side-story rule handles these as CHAPTER_TITLE
  if (labelText === 'story' && index > 0) {
    const prevToken = tokens[index - 1];
    if (prevToken && /^(side|bonus)$/i.test(prevToken.text.trim())) {
      return null;
    }
  }

  const valueIndices = collectValueTokenIndices(tokens, index + 2, 5);
  if (valueIndices.length === 0) return null;

  return {
    type: 'label_colon_value',
    labelText,
    entityType,
    valueTokenIndices: valueIndices,
    confidence: PATTERN_CONFIDENCE_BOOSTS.label_colon_value,
    source: `spaced_colon_pattern:${labelText}`,
  };
}

// Articles and prepositions that should not be labeled as entity values
const SKIP_ARTICLES = new Set(['the', 'a', 'an', 'is', 'as', 'or', 'and', 'in', 'on', 'of', 'to', 'for', 'with', 'by']);

function collectValueTokenIndices(
  tokens: LinearizedToken[],
  startIndex: number,
  maxTokens: number
): number[] {
  const valueIndices: number[] = [];
  const endIndex = Math.min(startIndex + maxTokens, tokens.length);

  for (let j = startIndex; j < endIndex; j++) {
    const valueToken = tokens[j];
    if (!valueToken) continue;

    const valueText = valueToken.text.trim();
    if (valueText.endsWith(':')) break;
    if (valueText.length === 0) continue;
    // Skip common articles and prepositions - these shouldn't be labeled as values
    if (SKIP_ARTICLES.has(valueText.toLowerCase())) continue;

    valueIndices.push(j);
  }

  return valueIndices;
}

// ============================================================================
// Table Header Pattern Detection
// ============================================================================

export function detectTableHeaderPatterns(tokens: LinearizedToken[]): PatternSignal[] {
  const patterns: PatternSignal[] = [];
  const tableTokens = tokens.filter((t) => t.isInTable);
  if (tableTokens.length === 0) return patterns;

  const byTable = groupTokensByTable(tableTokens);

  for (const tableGroup of byTable.values()) {
    patterns.push(...detectColumnBasedPatterns(tableGroup, tokens));
    patterns.push(...detectRowBasedPatterns(tableGroup, tokens));
  }

  return patterns;
}

function detectColumnBasedPatterns(
  tableGroup: LinearizedToken[],
  allTokens: LinearizedToken[]
): PatternSignal[] {
  const patterns: PatternSignal[] = [];
  const headers = tableGroup.filter((t) => t.isTableHeader);

  for (const header of headers) {
    const pattern = createColumnPattern(header, tableGroup, allTokens);
    if (pattern) patterns.push(pattern);
  }

  return patterns;
}

function createColumnPattern(
  header: LinearizedToken,
  tableGroup: LinearizedToken[],
  allTokens: LinearizedToken[]
): PatternSignal | null {
  const labelText = header.text.toLowerCase().trim();
  const entityType = LABEL_TO_ENTITY[labelText] ?? null;
  if (!entityType || header.tableCol === null) return null;

  const valueCells = tableGroup.filter(
    (t) => !t.isTableHeader && t.tableCol === header.tableCol && t.tableRow !== header.tableRow
  );

  const valueIndices = valueCells.map((t) => allTokens.indexOf(t)).filter((idx) => idx >= 0);
  if (valueIndices.length === 0) return null;

  return {
    type: 'table_header_value',
    labelText,
    entityType,
    valueTokenIndices: valueIndices,
    confidence: PATTERN_CONFIDENCE_BOOSTS.table_header_value,
    source: `table_header:${labelText}:col${header.tableCol}`,
  };
}

function detectRowBasedPatterns(
  tableGroup: LinearizedToken[],
  allTokens: LinearizedToken[]
): PatternSignal[] {
  const patterns: PatternSignal[] = [];
  const byRow = groupTokensByRow(tableGroup);

  for (const rowTokens of byRow.values()) {
    const pattern = createRowPattern(rowTokens, allTokens);
    if (pattern) patterns.push(pattern);
  }

  return patterns;
}

function groupTokensByRow(tokens: LinearizedToken[]): Map<number, LinearizedToken[]> {
  const byRow = new Map<number, LinearizedToken[]>();

  for (const token of tokens) {
    if (token.tableRow === null) continue;
    const row = byRow.get(token.tableRow) ?? [];
    row.push(token);
    byRow.set(token.tableRow, row);
  }

  return byRow;
}

function createRowPattern(
  rowTokens: LinearizedToken[],
  allTokens: LinearizedToken[]
): PatternSignal | null {
  const headers = rowTokens.filter((t) => t.isTableHeader);
  const cells = rowTokens.filter((t) => !t.isTableHeader);

  if (headers.length !== 1 || cells.length === 0) return null;

  const header = headers[0];
  if (!header) return null;

  const labelText = header.text.toLowerCase().trim();
  const entityType = LABEL_TO_ENTITY[labelText] ?? null;
  if (!entityType) return null;

  const valueIndices = cells.map((t) => allTokens.indexOf(t)).filter((idx) => idx >= 0);
  if (valueIndices.length === 0) return null;

  return {
    type: 'table_header_value',
    labelText,
    entityType,
    valueTokenIndices: valueIndices,
    confidence: PATTERN_CONFIDENCE_BOOSTS.table_header_value,
    source: `table_row:${labelText}:row${header.tableRow}`,
  };
}

function groupTokensByTable(tokens: LinearizedToken[]): Map<string, LinearizedToken[]> {
  const groups = new Map<string, LinearizedToken[]>();

  for (const token of tokens) {
    const tableId = token.xpath.match(/\/table\[\d+\]/)?.[0] ?? 'default';
    const existing = groups.get(tableId) ?? [];
    existing.push(token);
    groups.set(tableId, existing);
  }

  return groups;
}

// ============================================================================
// Infobox Pattern Detection
// ============================================================================

const LABEL_CLASS_INDICATORS = ['label', 'header', 'title', 'data-label', 'pi-data-label'];
const VALUE_CLASS_INDICATORS = ['value', 'data-value', 'pi-data-value'];

export function detectInfoboxPatterns(tokens: LinearizedToken[]): PatternSignal[] {
  const patterns: PatternSignal[] = [];
  const infoboxTokens = tokens.filter((t) => t.isInInfobox);
  if (infoboxTokens.length === 0) return patterns;

  patterns.push(...detectLabelBasedInfoboxPatterns(infoboxTokens, tokens));
  patterns.push(...detectDataSourcePatterns(infoboxTokens, tokens, patterns));

  return patterns;
}

function detectLabelBasedInfoboxPatterns(
  infoboxTokens: LinearizedToken[],
  allTokens: LinearizedToken[]
): PatternSignal[] {
  const patterns: PatternSignal[] = [];

  for (let i = 0; i < infoboxTokens.length; i++) {
    const token = infoboxTokens[i];
    if (!token) continue;

    const isLabel = hasClassIndicator(token.classes, LABEL_CLASS_INDICATORS);
    if (!isLabel) continue;

    const pattern = createInfoboxPattern(token, infoboxTokens, allTokens, i);
    if (pattern) patterns.push(pattern);
  }

  return patterns;
}

function hasClassIndicator(classes: string[], indicators: string[]): boolean {
  return classes.some((c) => indicators.some((ind) => c.toLowerCase().includes(ind)));
}

function createInfoboxPattern(
  labelToken: LinearizedToken,
  infoboxTokens: LinearizedToken[],
  allTokens: LinearizedToken[],
  labelIndex: number
): PatternSignal | null {
  const labelText = labelToken.text.toLowerCase().trim();
  const entityType = LABEL_TO_ENTITY[labelText] ?? null;
  if (!entityType) return null;

  const valueIndices = findInfoboxValueTokens(infoboxTokens, allTokens, labelIndex);
  if (valueIndices.length === 0) return null;

  return {
    type: 'infobox_pair',
    labelText,
    entityType,
    valueTokenIndices: valueIndices,
    confidence: PATTERN_CONFIDENCE_BOOSTS.infobox_pair,
    source: `infobox:${labelText}`,
  };
}

/**
 * Check if a token text is a label suffix (like "(JP)", "(EN)", "(US)")
 * These are often part of the label but split into separate tokens.
 */
function isLabelSuffix(text: string): boolean {
  const trimmed = text.trim();
  // Match patterns like "(JP)", "(EN)", "(US)", "(UK)"
  return /^\([A-Z]{2,3}\)$/.test(trimmed);
}

function findInfoboxValueTokens(
  infoboxTokens: LinearizedToken[],
  allTokens: LinearizedToken[],
  labelIndex: number
): number[] {
  const valueIndices: number[] = [];
  const maxLookahead = 6; // Increased to account for label suffixes
  const endIndex = Math.min(labelIndex + maxLookahead, infoboxTokens.length);

  for (let j = labelIndex + 1; j < endIndex; j++) {
    const valueToken = infoboxTokens[j];
    if (!valueToken) continue;

    // Skip label suffix tokens (like "(JP)", "(EN)") - they're part of the label, not values
    if (isLabelSuffix(valueToken.text)) continue;

    // Stop at next label (but not suffixes)
    if (hasClassIndicator(valueToken.classes, LABEL_CLASS_INDICATORS)) break;

    const isValue = hasClassIndicator(valueToken.classes, VALUE_CLASS_INDICATORS);
    if (isValue || valueToken.text.trim().length > 0) {
      const globalIndex = allTokens.indexOf(valueToken);
      if (globalIndex >= 0) valueIndices.push(globalIndex);
    }
  }

  return valueIndices;
}

function detectDataSourcePatterns(
  infoboxTokens: LinearizedToken[],
  allTokens: LinearizedToken[],
  existingPatterns: PatternSignal[]
): PatternSignal[] {
  const patterns: PatternSignal[] = [];

  for (const token of infoboxTokens) {
    const isValue = token.classes.some(
      (c) => c.includes('pi-data-value') || c.includes('data-value')
    );
    if (!isValue) continue;

    const pattern = findDataSourcePattern(token, allTokens, existingPatterns);
    if (pattern) patterns.push(pattern);
  }

  return patterns;
}

function findDataSourcePattern(
  valueToken: LinearizedToken,
  allTokens: LinearizedToken[],
  existingPatterns: PatternSignal[]
): PatternSignal | null {
  const tokenIndex = allTokens.indexOf(valueToken);
  if (tokenIndex < 0) return null;

  const searchStart = Math.max(0, tokenIndex - 3);
  for (let i = tokenIndex - 1; i >= searchStart; i--) {
    const prevToken = allTokens[i];
    if (!prevToken) continue;

    const isLabel = prevToken.classes.some(
      (c) => c.includes('pi-data-label') || c.includes('data-label')
    );
    if (!isLabel) continue;

    return createDataSourcePatternSignal(prevToken, tokenIndex, existingPatterns);
  }

  return null;
}

function isPatternAlreadyDetected(
  existingPatterns: PatternSignal[],
  labelText: string,
  valueTokenIndex: number
): boolean {
  return existingPatterns.some(
    (p) =>
      p.type === 'infobox_pair' &&
      p.labelText === labelText &&
      p.valueTokenIndices.includes(valueTokenIndex)
  );
}

function createDataSourcePatternSignal(
  labelToken: LinearizedToken,
  valueTokenIndex: number,
  existingPatterns: PatternSignal[]
): PatternSignal | null {
  const labelText = labelToken.text.toLowerCase().trim();
  const entityType = LABEL_TO_ENTITY[labelText] ?? null;
  if (!entityType) return null;

  if (isPatternAlreadyDetected(existingPatterns, labelText, valueTokenIndex)) return null;

  return {
    type: 'infobox_pair',
    labelText,
    entityType,
    valueTokenIndices: [valueTokenIndex],
    confidence: PATTERN_CONFIDENCE_BOOSTS.infobox_pair,
    source: `infobox_data_source:${labelText}`,
  };
}

// ============================================================================
// Definition List Pattern Detection
// ============================================================================

export function detectDefinitionListPatterns(tokens: LinearizedToken[]): PatternSignal[] {
  const patterns: PatternSignal[] = [];

  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (token?.tagName !== 'dt') continue;

    const pattern = createDefinitionListPattern(tokens, token, i);
    if (pattern) patterns.push(pattern);
  }

  return patterns;
}

function createDefinitionListPattern(
  tokens: LinearizedToken[],
  dtToken: LinearizedToken,
  dtIndex: number
): PatternSignal | null {
  const labelText = dtToken.text.toLowerCase().trim();
  const entityType = LABEL_TO_ENTITY[labelText] ?? null;
  if (!entityType) return null;

  const valueIndices = collectDdIndices(tokens, dtIndex + 1);
  if (valueIndices.length === 0) return null;

  return {
    type: 'definition_list',
    labelText,
    entityType,
    valueTokenIndices: valueIndices,
    confidence: PATTERN_CONFIDENCE_BOOSTS.definition_list,
    source: `dl:${labelText}`,
  };
}

function collectDdIndices(tokens: LinearizedToken[], startIndex: number): number[] {
  const valueIndices: number[] = [];

  for (let j = startIndex; j < tokens.length; j++) {
    const nextToken = tokens[j];
    if (!nextToken) continue;
    if (nextToken.tagName === 'dt') break;
    if (nextToken.tagName === 'dd') valueIndices.push(j);
  }

  return valueIndices;
}

// ============================================================================
// Section Header Pattern Detection
// ============================================================================

/**
 * Section header labels that indicate content sections (without colons)
 * These are typically h2/h3 headers on wiki pages
 */
const SECTION_HEADER_LABELS: Record<string, string> = {
  synopsis: 'SERIES_SUMMARY',
  summary: 'SERIES_SUMMARY',
  plot: 'SERIES_SUMMARY',
  'plot summary': 'SERIES_SUMMARY',
  storyline: 'SERIES_SUMMARY',
  overview: 'SERIES_SUMMARY',
  description: 'SERIES_SUMMARY',
  premise: 'SERIES_SUMMARY',
  story: 'SERIES_SUMMARY',
};

/**
 * Detect section header patterns (h2/h3 headers without colons)
 * These are common on wiki pages where a header like "Synopsis" is followed by content paragraphs
 */
export function detectSectionHeaderPatterns(tokens: LinearizedToken[]): PatternSignal[] {
  const patterns: PatternSignal[] = [];

  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (!token) continue;

    // Must be a header element
    if (!token.isHeader) continue;

    const pattern = createSectionHeaderPattern(tokens, token, i);
    if (pattern) patterns.push(pattern);
  }

  return patterns;
}

/**
 * Create a pattern from a section header and its following content
 */
function createSectionHeaderPattern(
  tokens: LinearizedToken[],
  headerToken: LinearizedToken,
  headerIndex: number
): PatternSignal | null {
  // Normalize header text - remove edit brackets [], whitespace
  const headerText = headerToken.text
    .toLowerCase()
    .replace(/\[.*?\]/g, '') // Remove [edit] or [] brackets
    .trim();

  // Check if it's a known section label
  const entityType = SECTION_HEADER_LABELS[headerText];
  if (!entityType) return null;

  // Collect following content tokens (paragraphs after the header)
  const valueIndices = collectSectionContentIndices(tokens, headerIndex + 1);
  if (valueIndices.length === 0) return null;

  return {
    type: 'label_colon_value', // Reuse type for compatibility
    labelText: headerText,
    entityType: entityType as 'SERIES_SUMMARY',
    valueTokenIndices: valueIndices,
    confidence: PATTERN_CONFIDENCE_BOOSTS.label_colon_value * 0.9, // Slightly lower than explicit colon patterns
    source: `section_header:${headerText}`,
  };
}

/**
 * Collect token indices for content following a section header
 * Stops at the next header or after max tokens
 */
function collectSectionContentIndices(
  tokens: LinearizedToken[],
  startIndex: number
): number[] {
  const valueIndices: number[] = [];
  const maxTokens = 100; // Allow more tokens for summary content
  const endIndex = Math.min(startIndex + maxTokens, tokens.length);

  // Track if we've exited the header's edit section (brackets like "[edit]" are inside the h2)
  let exitedHeaderEditSection = false;

  for (let j = startIndex; j < endIndex; j++) {
    const token = tokens[j];
    if (!token) continue;

    const text = token.text.trim();

    // Skip edit link tokens (they're often inside the header element)
    // These include "[", "]", "edit", "Edit", and similar navigation tokens
    if (isEditLinkToken(text)) {
      continue;
    }

    // Once we find a non-header token, we've exited the header's edit section
    if (!token.isHeader) {
      exitedHeaderEditSection = true;
    }

    // Stop at next header ONLY if we've already found content
    // This prevents stopping at header tokens that are part of the [edit] link
    if (token.isHeader && exitedHeaderEditSection) {
      break;
    }

    // Skip tokens that are still in header (part of [edit] link) without content text
    if (token.isHeader) {
      continue;
    }

    // Stop at next section (navigation, footer, etc.)
    if (token.sectionType !== 'main_content' && token.sectionType !== 'unknown') break;

    // Only include text content (skip empty tokens)
    if (text.length === 0) continue;

    valueIndices.push(j);
  }

  return valueIndices;
}

/**
 * Check if a token text is part of an edit link (wiki navigation)
 */
function isEditLinkToken(text: string): boolean {
  const editLinkTokens = ['[', ']', 'edit', 'Edit', 'source', 'Source'];
  return editLinkTokens.includes(text);
}
