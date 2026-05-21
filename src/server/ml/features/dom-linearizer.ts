// @file-size-justified: Core ML DOM linearization module - token creation, DOM walking, and BIO labeling are tightly coupled and must stay together for maintainability
/* eslint-disable no-param-reassign -- Mutable context/stats objects pattern for performance during DOM traversal */
/**
 * DOM Linearization Module for ML Training
 *
 * Converts HTML documents into linearized token sequences suitable for
 * sequence labeling with Transformer-CRF models.
 */

import { createHash } from 'crypto';

import { Window } from 'happy-dom';

import { type EntityType, type BIOTag } from './bio-types';

// ============================================================================
// Types
// ============================================================================

export interface LinearizedToken {
  id: string;
  text: string;
  normalizedText: string;
  tagName: string;
  xpath: string;
  cssPath: string;
  domDepth: number;
  siblingIndex: number;
  parentId: string | null;
  childIds: string[];
  isBold: boolean;
  isItalic: boolean;
  isHeader: boolean;
  headerLevel: number;
  isInTable: boolean;
  isInList: boolean;
  isInInfobox: boolean;
  isLink: boolean;
  linkHref: string | null;
  tableRow: number | null;
  tableCol: number | null;
  isTableHeader: boolean;
  documentPosition: number;
  charOffset: number;
  textLength: number;
  wordCount: number;
  sourceHtml: string;
  classes: string[];
  elementId: string | null;
  // Image fields
  isImage: boolean;
  imageSrc: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  // === NEW: Token type classification ===
  tokenType: TokenType;
  isNumeric: boolean;
  isDate: boolean;
  isPunctuation: boolean;
  isCJK: boolean;
  isAllCaps: boolean;
  // === NEW: Semantic patterns ===
  matchesDatePattern: boolean;
  matchesVolumePattern: boolean;  // "Vol.", "Volume", etc.
  matchesChapterPattern: boolean; // "Ch.", "Chapter", etc.
  matchesNamePattern: boolean;    // Capitalized words
  // === NEW: Context signals ===
  precedingText: string | null;   // Previous token text (for bigram context)
  followingText: string | null;   // Next token text
  distanceFromLabel: number;      // Tokens since last label-like token
  nearestLabelText: string | null; // Text of nearest label (e.g., "Volumes:")
  // === NEW: Container context ===
  sectionType: SectionType;       // infobox, sidebar, main_content, header, footer
  isFirstInElement: boolean;      // First token in parent element
  isLastInElement: boolean;       // Last token in parent element
  // === NEW: Visual/Layout features (for future multimodal training) ===
  fontSize: string | null;        // Computed font size (e.g., "14px", "1.2em")
  fontWeight: string | null;      // "bold", "700", "normal"
  color: string | null;           // Text color
  backgroundColor: string | null; // Background color
  // === Reference to full context ===
  htmlContext: string;            // Larger HTML snippet (parent + siblings) for context
}

export type TokenType = 'word' | 'number' | 'date' | 'punctuation' | 'cjk' | 'mixed' | 'image';
export type SectionType = 'infobox' | 'sidebar' | 'main_content' | 'header' | 'footer' | 'navigation' | 'unknown';

export interface LinearizationResult {
  tokens: LinearizedToken[];
  totalChars: number;
  title: string | null;
  url: string;
  timestamp: Date;
  sourceType: 'fandom' | 'wikipedia' | 'anilist' | 'comicvine' | 'unknown';
  stats: LinearizationStats;
}

export interface LinearizationStats {
  totalTokens: number;
  textTokens: number;
  tableTokens: number;
  headerTokens: number;
  linkTokens: number;
  infoboxTokens: number;
  imageTokens: number;
  maxDepth: number;
  tableCount: number;
}

export interface LinearizationOptions {
  maxTokens?: number;
  minTextLength?: number;
  includeEmpty?: boolean;
  skipTags?: string[];
  focusSelectors?: string[];
}

interface TableContext {
  row: number;
  col: number;
}

interface WalkContext {
  tokens: LinearizedToken[];
  charOffset: number;
  tokenIndex: number;
  stats: LinearizationStats;
  maxTokens: number;
  minTextLength: number;
  includeEmpty: boolean;
  skipTagsSet: Set<string>;
  url: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'iframe', 'svg',
  'path', 'meta', 'link', 'head', 'template',
]);

const HEADER_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const BOLD_TAGS = new Set(['strong', 'b']);
const ITALIC_TAGS = new Set(['em', 'i']);

const INFOBOX_CLASSES = [
  'infobox', 'portable-infobox', 'pi-data',
  'wikitable', 'sidebar', 'navbox',
];

// === NEW: Pattern matching regexes ===
const DATE_PATTERN = /^(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{1,2},?\s*\d{4}|\d{4})$/i;
const VOLUME_PATTERN = /^(vol\.?|volume|volumes|tankōbon|tankobon)$/i;
const CHAPTER_PATTERN = /^(ch\.?|chap\.?|chapter|chapters|episode|ep\.?)$/i;
const PAGES_PATTERN = /^(pages?|page count|pagecount)$/i;
const NAME_PATTERN = /^[A-Z][a-z]+$/;  // Capitalized word
const CJK_PATTERN = /[\u3000-\u9fff\uac00-\ud7af]/;
const NUMERIC_PATTERN = /^\d+$/;
const PUNCTUATION_PATTERN = /^[^\w\s]+$/;
const LABEL_PATTERN = /^.+:$/;  // Ends with colon

// === NEW: Section detection classes ===
const SIDEBAR_CLASSES = ['sidebar', 'aside', 'toc', 'navbox', 'navigation'];
const HEADER_CLASSES = ['header', 'masthead', 'page-header', 'site-header'];
const FOOTER_CLASSES = ['footer', 'page-footer', 'site-footer'];
const NAV_CLASSES = [
  'nav', 'navigation', 'menu', 'navbar',
  // ComicVine-specific forum navigation
  'forum-bar', 'forum-nav', 'site-nav', 'forum-categories',
  'forum-section', 'forum-list',
];

// ============================================================================
// Feature Extraction Helpers
// ============================================================================

function classifyTokenType(text: string): TokenType {
  if (NUMERIC_PATTERN.test(text)) return 'number';
  if (DATE_PATTERN.test(text)) return 'date';
  if (PUNCTUATION_PATTERN.test(text)) return 'punctuation';
  if (CJK_PATTERN.test(text)) return 'cjk';
  if (/\d/.test(text) && /[a-zA-Z]/.test(text)) return 'mixed';
  return 'word';
}

function extractSemanticFeatures(text: string): {
  isNumeric: boolean;
  isDate: boolean;
  isPunctuation: boolean;
  isCJK: boolean;
  isAllCaps: boolean;
  matchesDatePattern: boolean;
  matchesVolumePattern: boolean;
  matchesChapterPattern: boolean;
  matchesNamePattern: boolean;
} {
  return {
    isNumeric: NUMERIC_PATTERN.test(text),
    isDate: DATE_PATTERN.test(text),
    isPunctuation: PUNCTUATION_PATTERN.test(text),
    isCJK: CJK_PATTERN.test(text),
    isAllCaps: text.length > 1 && text === text.toUpperCase() && /[A-Z]/.test(text),
    matchesDatePattern: DATE_PATTERN.test(text),
    matchesVolumePattern: VOLUME_PATTERN.test(text),
    matchesChapterPattern: CHAPTER_PATTERN.test(text),
    matchesNamePattern: NAME_PATTERN.test(text),
  };
}

function detectSectionType(element: Element): SectionType {
  const classes = element.className.toLowerCase();
  const id = element.id ? element.id.toLowerCase() : '';
  const combined = `${classes} ${id}`;

  if (INFOBOX_CLASSES.some((c) => combined.includes(c))) return 'infobox';
  if (SIDEBAR_CLASSES.some((c) => combined.includes(c))) return 'sidebar';
  if (HEADER_CLASSES.some((c) => combined.includes(c))) return 'header';
  if (FOOTER_CLASSES.some((c) => combined.includes(c))) return 'footer';
  if (NAV_CLASSES.some((c) => combined.includes(c))) return 'navigation';

  // Check ancestors
  let current: Element | null = element;
  while (current) {
    const ancestorClasses = current.className.toLowerCase();
    const ancestorId = current.id ? current.id.toLowerCase() : '';
    const ancestorCombined = `${ancestorClasses} ${ancestorId}`;

    if (INFOBOX_CLASSES.some((c) => ancestorCombined.includes(c))) return 'infobox';
    if (SIDEBAR_CLASSES.some((c) => ancestorCombined.includes(c))) return 'sidebar';
    if (ancestorCombined.includes('content') || ancestorCombined.includes('article') || ancestorCombined.includes('main')) {
      return 'main_content';
    }
    current = current.parentElement;
  }

  return 'unknown';
}

function isLabelToken(text: string): boolean {
  return LABEL_PATTERN.test(text) || VOLUME_PATTERN.test(text) || CHAPTER_PATTERN.test(text) || PAGES_PATTERN.test(text);
}

/** Extract inline style values for visual features */
function extractVisualStyles(element: Element): {
  fontSize: string | null;
  fontWeight: string | null;
  color: string | null;
  backgroundColor: string | null;
} {
  const style = element.getAttribute('style') ?? '';
  return {
    fontSize: extractStyleValue(style, 'font-size'),
    fontWeight: extractStyleValue(style, 'font-weight'),
    color: extractStyleValue(style, 'color'),
    backgroundColor: extractStyleValue(style, 'background-color') ?? extractStyleValue(style, 'background'),
  };
}

function extractStyleValue(style: string, property: string): string | null {
  const regex = new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i');
  const match = style.match(regex);
  return match ? match[1]?.trim() ?? null : null;
}

/** Get larger HTML context including parent and siblings */
function getHtmlContext(element: Element, maxLength = 500): string {
  const parent = element.parentElement;
  if (parent) {
    const html = parent.outerHTML;
    return html.length > maxLength ? html.substring(0, maxLength) + '...' : html;
  }
  return element.outerHTML.substring(0, maxLength);
}

// ============================================================================
// Main Linearization Function
// ============================================================================

export function linearizeDOM(
  html: string,
  url: string,
  options: LinearizationOptions = {}
): LinearizationResult {
  const {
    maxTokens = 10000,
    minTextLength = 1,
    includeEmpty = false,
    skipTags = [],
    focusSelectors = [],
  } = options;

  const skipTagsSet = new Set([...DEFAULT_SKIP_TAGS, ...skipTags.map((t) => t.toLowerCase())]);

  // Use happy-dom which has no native dependencies (unlike jsdom which requires canvas)
  const window = new Window({ url });
  window.document.write(html);
  const document = window.document;
  const sourceType = detectSourceType(url);

  const roots = getRoots(document, focusSelectors);
  const ctx: WalkContext = {
    tokens: [],
    charOffset: 0,
    tokenIndex: 0,
    stats: createEmptyStats(),
    maxTokens,
    minTextLength,
    includeEmpty,
    skipTagsSet,
    url,
  };

  for (const root of roots) {
    walkNode(root, 0, null, 0, null, ctx);
  }

  ctx.stats.totalTokens = ctx.tokens.length;
  calculateDocumentPositions(ctx.tokens, ctx.charOffset);
  enrichTokenContext(ctx.tokens); // NEW: Fill in neighbor context and label proximity

  const result = {
    tokens: ctx.tokens,
    totalChars: ctx.charOffset,
    title: document.title ? document.title : null,
    url,
    timestamp: new Date(),
    sourceType,
    stats: ctx.stats,
  };

  // Clean up happy-dom window to avoid memory leaks
  window.close();

  return result;
}

// happy-dom types are not fully compatible with standard DOM types
// We use type assertions since this is server-only code
function getRoots(document: { body: unknown; querySelectorAll: (s: string) => unknown }, focusSelectors: string[]): Element[] {
  if (focusSelectors.length === 0) return [document.body as Element];

  const roots: Element[] = [];
  for (const selector of focusSelectors) {
    const elements = document.querySelectorAll(selector) as NodeListOf<Element>;
    roots.push(...Array.from(elements));
  }
  return roots.length > 0 ? roots : [document.body as Element];
}

function createEmptyStats(): LinearizationStats {
  return {
    totalTokens: 0,
    textTokens: 0,
    tableTokens: 0,
    headerTokens: 0,
    linkTokens: 0,
    infoboxTokens: 0,
    imageTokens: 0,
    maxDepth: 0,
    tableCount: 0,
  };
}

function calculateDocumentPositions(tokens: LinearizedToken[], totalChars: number): void {
  for (const token of tokens) {
    token.documentPosition = totalChars > 0 ? token.charOffset / totalChars : 0;
  }
}

/** Check if token is a label (text ending with colon OR table header cell) */
function isLabelTokenOrTableHeader(token: LinearizedToken): boolean {
  // Standard label pattern: ends with colon
  if (isLabelToken(token.text)) return true;
  // Table header cells are often labels in key-value tables
  if (token.isTableHeader && token.text.trim().length > 0) return true;
  return false;
}

/** Post-process tokens to fill in neighbor context and label proximity */
function enrichTokenContext(tokens: LinearizedToken[]): void {
  let lastLabelIdx = -1;
  let lastLabelText: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    // Neighbor context
    token.precedingText = i > 0 ? (tokens[i - 1]?.text ?? null) : null;
    token.followingText = i < tokens.length - 1 ? (tokens[i + 1]?.text ?? null) : null;

    // Track label tokens and compute distance
    // Now includes table header cells as potential labels
    // Accumulate consecutive label tokens into a single label text
    // (e.g., <th>Written by</th> splits into "Written" + "by" tokens)
    if (isLabelTokenOrTableHeader(token)) {
      if (lastLabelIdx === i - 1 && lastLabelText) {
        // Consecutive label token — accumulate text
        lastLabelText = `${lastLabelText} ${token.text}`;
      } else {
        // New label sequence
        lastLabelText = token.text;
      }
      lastLabelIdx = i;
    }
    token.distanceFromLabel = lastLabelIdx >= 0 ? i - lastLabelIdx : -1;
    token.nearestLabelText = lastLabelText;

    // isLastInElement: check if next token has different xpath
    if (i < tokens.length - 1) {
      const nextToken = tokens[i + 1];
      token.isLastInElement = nextToken ? nextToken.xpath !== token.xpath : true;
    } else {
      token.isLastInElement = true;
    }
  }
}

// ============================================================================
// DOM Walking
// ============================================================================

// eslint-disable-next-line max-params -- DOM traversal requires depth, parentId, siblingIndex, tableContext, ctx
function walkNode(
  node: Node,
  depth: number,
  parentId: string | null,
  siblingIndex: number,
  tableContext: TableContext | null,
  ctx: WalkContext
): string | null {
  if (ctx.tokens.length >= ctx.maxTokens) return null;

  if (node.nodeType === node.TEXT_NODE) {
    return processTextNode(node, depth, parentId, siblingIndex, tableContext, ctx);
  }

  if (node.nodeType === node.ELEMENT_NODE) {
    return processElementNode(node as Element, depth, parentId, tableContext, ctx);
  }

  return null;
}

/** CJK Unicode ranges for Japanese/Chinese/Korean characters */
const CJK_RANGE = '\u3000-\u9fff\uac00-\ud7af';
const CJK_REGEX = new RegExp(`[${CJK_RANGE}]`);

/** Split text into words, separating numbers and CJK text from surrounding punctuation for accurate annotation */
function splitIntoWords(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const result: string[] = [];
  for (const word of words) {
    // Split numbers from surrounding punctuation for precise labeling:
    // "(1170)" → ["(", "1170", ")"]
    // "18:" → ["18", ":"]
    // "18." → ["18", "."]
    // "1013," → ["1013", ","]
    // eslint-disable-next-line no-useless-escape -- The \[ escape is required in this character class position
    const numMatch = word.match(/^([(\[]?)(\d+)([)\]:.,;]?)$/);
    if (numMatch) {
      if (numMatch[1]) result.push(numMatch[1]);
      if (numMatch[2]) result.push(numMatch[2]);
      if (numMatch[3]) result.push(numMatch[3]);
      continue;
    }

    // Split leading/trailing punctuation from CJK text for precise labeling:
    // "(北人," → ["(", "北人", ","]
    // "Norumanni)" → ["Norumanni", ")"]
    // This enables alt title detection rules that expect "(" as a separate token
    // Note: Don't split quotes from titles - "Normanni" should stay as one token
    if (CJK_REGEX.test(word) || /^[A-Za-z]+[)\],;:]+$/.test(word) || /^[(,;:[]+[A-Za-z]/.test(word)) {
      // Pattern: (leadingPunct?)(content)(trailingPunct?)
      // Content can be CJK chars, letters, or mixed
      // Punctuation classes: ( ) [ ] , ; : but NOT quotes (to keep "Title" together)
      const cjkMatch = word.match(/^([(,;:[]+)?(.+?)([)\],;:]+)?$/);
      if (cjkMatch && (cjkMatch[1] ?? cjkMatch[3])) {
        if (cjkMatch[1]) result.push(cjkMatch[1]);  // Leading punct like "("
        if (cjkMatch[2]) result.push(cjkMatch[2]);  // Core content like "北人" or "Norumanni"
        if (cjkMatch[3]) result.push(cjkMatch[3]);  // Trailing punct like "," or ")"
        continue;
      }
    }

    result.push(word);
  }
  return result;
}

// eslint-disable-next-line max-params -- DOM traversal requires depth, parentId, siblingIndex, tableContext, ctx
function processTextNode(
  node: Node,
  depth: number,
  parentId: string | null,
  siblingIndex: number,
  tableContext: TableContext | null,
  ctx: WalkContext
): string | null {
  const text = node.textContent?.trim() ?? '';
  if (text.length < ctx.minTextLength && !ctx.includeEmpty) return null;

  const parent = node.parentElement;
  if (!parent) return null;

  // Split text into words for fine-grained annotation
  const words = splitIntoWords(text);
  if (words.length <= 1) {
    const token = createToken(text, parent, depth, parentId, siblingIndex, ctx, tableContext);
    ctx.tokens.push(token);
    ctx.charOffset += text.length;
    ctx.tokenIndex++;
    updateStats(token, tableContext, ctx.stats, depth);
    return token.id;
  }

  // Create separate tokens for each word
  let lastId: string | null = null;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    const token = createToken(word, parent, depth, parentId, siblingIndex + i, ctx, tableContext);
    ctx.tokens.push(token);
    ctx.charOffset += word.length + (i < words.length - 1 ? 1 : 0);
    ctx.tokenIndex++;
    updateStats(token, tableContext, ctx.stats, depth);
    lastId = token.id;
  }
  return lastId;
}

/** Table container tags that can contain <tr> elements */
const TABLE_CONTAINER_TAGS = new Set(['table', 'tbody', 'thead', 'tfoot']);

/**
 * Determine the table context for a child node.
 * - For <tr> parent: tracks column position for <td>/<th> children
 * - For table container parent: tracks row position for <tr> children
 */
function getChildTableContext(
  child: ChildNode,
  parentTag: string,
  currentRow: number,
  currentCol: number,
  baseContext: TableContext | null
): { context: TableContext | null; nextRow: number; nextCol: number } {
  // Use numeric constant (1) for ELEMENT_NODE to avoid relying on global Node
  if (child.nodeType !== 1 || !baseContext) {
    return { context: baseContext, nextRow: currentRow, nextCol: currentCol };
  }

  const childTag = (child as Element).tagName.toLowerCase();

  // Track rows when inside a table container
  if (TABLE_CONTAINER_TAGS.has(parentTag) && childTag === 'tr') {
    const nextRow = currentRow + 1;
    return {
      context: { row: nextRow, col: 0 },
      nextRow,
      nextCol: currentCol,
    };
  }

  // Track columns when inside a <tr>
  if (parentTag === 'tr' && (childTag === 'td' || childTag === 'th')) {
    const nextCol = currentCol + 1;
    return {
      context: { row: baseContext.row, col: nextCol },
      nextRow: currentRow,
      nextCol,
    };
  }

  return { context: baseContext, nextRow: currentRow, nextCol: currentCol };
}

function processElementNode(
  element: Element,
  depth: number,
  parentId: string | null,
  tableContext: TableContext | null,
  ctx: WalkContext
): null {
  const tagName = element.tagName.toLowerCase();
  if (ctx.skipTagsSet.has(tagName)) return null;

  // Handle image elements
  if (tagName === 'img') {
    processImageElement(element, depth, parentId, tableContext, ctx);
    return null;
  }

  const newTableContext = updateTableContext(tagName, tableContext, ctx.stats);
  const childNodes = Array.from(element.childNodes);

  // Initialize tracking for table elements
  // Row tracking starts at 0 for table containers, column tracking starts at 0 for <tr>
  const isTableContainer = TABLE_CONTAINER_TAGS.has(tagName);
  let currentRow = isTableContainer && newTableContext ? 0 : -1;
  let currentCol = tagName === 'tr' && newTableContext ? 0 : -1;

  for (let i = 0; i < childNodes.length; i++) {
    const child = childNodes[i];
    if (!child) continue;

    const result = getChildTableContext(child, tagName, currentRow, currentCol, newTableContext);
    currentRow = result.nextRow;
    currentCol = result.nextCol;

    walkNode(child, depth + 1, parentId, i, result.context, ctx);
  }

  return null;
}

function updateTableContext(
  tagName: string,
  tableContext: TableContext | null,
  stats: LinearizationStats
): TableContext | null {
  if (tagName === 'table') {
    stats.tableCount++;
    return { row: 0, col: 0 };
  }
  // Note: Row tracking for <tr> and column tracking for <td>/<th> are now handled
  // progressively in processElementNode via getChildTableContext to ensure correct
  // incremental assignment as siblings are processed
  return tableContext;
}

function updateStats(
  token: LinearizedToken,
  tableContext: TableContext | null,
  stats: LinearizationStats,
  depth: number
): void {
  if (token.isImage) {
    stats.imageTokens++;
  } else {
    stats.textTokens++;
  }
  if (tableContext) stats.tableTokens++;
  if (token.isHeader) stats.headerTokens++;
  if (token.isLink) stats.linkTokens++;
  if (token.isInInfobox) stats.infoboxTokens++;
  stats.maxDepth = Math.max(stats.maxDepth, depth);
}

// ============================================================================
// Image Processing
// ============================================================================

const ICON_SIZE_THRESHOLD = 50;
const SKIP_IMAGE_PATTERNS = [
  /icon/i, /sprite/i, /spacer/i, /blank/i, /pixel/i,
  /tracking/i, /beacon/i, /ad[_-]/i, /banner/i,
  /1x1/i, /placeholder/i,
  // Note: Removed /loading/i as it falsely matches Fandom's lazy-loading classes like "lazyload"
];

function getEffectiveImageSrc(element: Element): string {
  // Check multiple source attributes (for lazy loading compatibility)
  const src = element.getAttribute('src') ?? '';
  // IMPORTANT: Skip data URIs (lazy-loading placeholders) and check data-src instead
  // Fandom uses src="data:image/gif;base64,..." as placeholder with real URL in data-src
  if (src.length > 0 && !src.startsWith('data:')) return src;

  const dataSrc = element.getAttribute('data-src') ?? '';
  if (dataSrc.length > 0) return dataSrc;

  // Extract first URL from srcset/data-srcset (format: "url 1x, url2 2x")
  const srcset = element.getAttribute('srcset') ?? '';
  if (srcset.length > 0) {
    const firstUrl = srcset.split(',')[0]?.trim().split(' ')[0];
    if (firstUrl) return firstUrl;
  }

  const dataSrcset = element.getAttribute('data-srcset') ?? '';
  if (dataSrcset.length > 0) {
    const firstUrl = dataSrcset.split(',')[0]?.trim().split(' ')[0];
    if (firstUrl) return firstUrl;
  }

  return '';
}

function isRelevantImage(element: Element): boolean {
  const effectiveSrc = getEffectiveImageSrc(element);
  const width = parseInt(element.getAttribute('width') ?? '0', 10);
  const height = parseInt(element.getAttribute('height') ?? '0', 10);
  const alt = element.getAttribute('alt') ?? '';
  const classes = element.className.toLowerCase();

  // Skip tiny images (icons, spacers)
  if (width > 0 && width < ICON_SIZE_THRESHOLD) return false;
  if (height > 0 && height < ICON_SIZE_THRESHOLD) return false;

  // Skip images matching skip patterns
  const combined = `${effectiveSrc} ${alt} ${classes}`;
  for (const pattern of SKIP_IMAGE_PATTERNS) {
    if (pattern.test(combined)) return false;
  }

  // Skip base64 data URIs (usually tiny embedded images)
  if (effectiveSrc.startsWith('data:')) return false;

  // Must have a source OR meaningful alt text (for images not yet loaded)
  if (effectiveSrc.length === 0 && alt.length === 0) return false;

  return true;
}

function resolveImageUrl(src: string, baseUrl: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  if (src.startsWith('//')) {
    return 'https:' + src;
  }
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

function parseImageDimension(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

function processImageElement(
  element: Element,
  depth: number,
  parentId: string | null,
  tableContext: TableContext | null,
  ctx: WalkContext
): void {
  if (!isRelevantImage(element)) return;
  if (ctx.tokens.length >= ctx.maxTokens) return;

  const src = getEffectiveImageSrc(element);
  const alt = element.getAttribute('alt') ?? '';
  const width = parseImageDimension(element.getAttribute('width'));
  const height = parseImageDimension(element.getAttribute('height'));

  const resolvedSrc = resolveImageUrl(src, ctx.url);
  const text = `[IMAGE${alt ? `: ${alt}` : ''}]`;

  const token = createImageToken(element, text, resolvedSrc, alt, width, height, depth, parentId, ctx, tableContext);
  ctx.tokens.push(token);
  ctx.charOffset += text.length;
  ctx.tokenIndex++;

  updateStats(token, tableContext, ctx.stats, depth);
}

/** Default new features for image tokens */
function getImageTokenNewFeatures(element: Element): Pick<LinearizedToken,
  'tokenType' | 'isNumeric' | 'isDate' | 'isPunctuation' | 'isCJK' | 'isAllCaps' |
  'matchesDatePattern' | 'matchesVolumePattern' | 'matchesChapterPattern' | 'matchesNamePattern' |
  'precedingText' | 'followingText' | 'distanceFromLabel' | 'nearestLabelText' |
  'sectionType' | 'isFirstInElement' | 'isLastInElement' |
  'fontSize' | 'fontWeight' | 'color' | 'backgroundColor' | 'htmlContext'
> {
  return {
    tokenType: 'image', isNumeric: false, isDate: false, isPunctuation: false,
    isCJK: false, isAllCaps: false, matchesDatePattern: false, matchesVolumePattern: false,
    matchesChapterPattern: false, matchesNamePattern: false,
    precedingText: null, followingText: null, distanceFromLabel: -1, nearestLabelText: null,
    sectionType: detectSectionType(element), isFirstInElement: true, isLastInElement: true,
    // Visual features for images
    ...extractVisualStyles(element),
    htmlContext: getHtmlContext(element),
  };
}

// eslint-disable-next-line max-params -- Image token requires element, dimensions, text, position context
function createImageToken(
  element: Element, text: string, imageSrc: string, imageAlt: string,
  imageWidth: number | null, imageHeight: number | null, depth: number,
  parentId: string | null, ctx: WalkContext, tableContext: TableContext | null
): LinearizedToken {
  const id = generateTokenId(ctx.url, ctx.tokenIndex, text);
  const tableFeatures = extractTableFeatures(element, 'img', tableContext);
  const linkEl = element.closest('a');
  const linkHref = linkEl ? linkEl.getAttribute('href') : null;

  return {
    id, text, normalizedText: text.toLowerCase(), tagName: 'img',
    xpath: getXPath(element), cssPath: getCSSPath(element), domDepth: depth,
    siblingIndex: 0, parentId, childIds: [],
    isBold: false, isItalic: false, isHeader: false, headerLevel: 0,
    isInTable: element.closest('table') !== null,
    isInList: element.closest('ul, ol, dl') !== null,
    isInInfobox: checkIsInInfobox(element),
    isLink: linkEl !== null, linkHref,
    ...tableFeatures,
    documentPosition: 0, charOffset: ctx.charOffset, textLength: text.length, wordCount: 0,
    sourceHtml: element.outerHTML.substring(0, 300),
    classes: Array.from(element.classList),
    elementId: element.id ? element.id : null,
    isImage: true, imageSrc,
    imageAlt: imageAlt.length > 0 ? imageAlt : null,
    imageWidth, imageHeight,
    ...getImageTokenNewFeatures(element),
  };
}

// ============================================================================
// Token Creation
// ============================================================================

// eslint-disable-next-line max-params -- Token creation requires text, element, position, and context
function createToken(
  text: string,
  element: Element,
  depth: number,
  parentId: string | null,
  siblingIndex: number,
  ctx: WalkContext,
  tableContext: TableContext | null
): LinearizedToken {
  const tagName = element.tagName.toLowerCase();
  const id = generateTokenId(ctx.url, ctx.tokenIndex, text);
  const visualFeatures = extractVisualFeatures(element, tagName);
  const tableFeatures = extractTableFeatures(element, tagName, tableContext);
  const semanticFeatures = extractSemanticFeatures(text);

  return {
    id,
    text,
    normalizedText: text.toLowerCase().trim(),
    tagName,
    xpath: getXPath(element),
    cssPath: getCSSPath(element),
    domDepth: depth,
    siblingIndex,
    parentId,
    childIds: [],
    ...visualFeatures,
    ...tableFeatures,
    documentPosition: 0,
    charOffset: ctx.charOffset,
    textLength: text.length,
    wordCount: text.split(/\s+/).filter((w) => w.length > 0).length,
    sourceHtml: element.outerHTML.substring(0, 200),
    classes: Array.from(element.classList),
    elementId: element.id ? element.id : null,
    // Default image fields for text tokens
    isImage: false,
    imageSrc: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    // NEW: Token type classification
    tokenType: classifyTokenType(text),
    ...semanticFeatures,
    // NEW: Context signals (filled in post-processing)
    precedingText: null,
    followingText: null,
    distanceFromLabel: -1,
    nearestLabelText: null,
    // NEW: Container context
    sectionType: detectSectionType(element),
    isFirstInElement: siblingIndex === 0,
    isLastInElement: false, // Updated in post-processing
    // NEW: Visual/Layout features
    ...extractVisualStyles(element),
    htmlContext: getHtmlContext(element),
  };
}

interface VisualFeatures {
  isBold: boolean;
  isItalic: boolean;
  isHeader: boolean;
  headerLevel: number;
  isInTable: boolean;
  isInList: boolean;
  isInInfobox: boolean;
  isLink: boolean;
  linkHref: string | null;
}

function extractVisualFeatures(element: Element, tagName: string): VisualFeatures {
  // Check if element itself is a header OR if it's inside a header element
  // This handles cases like Fandom wikis where text is in <span> inside <h2>
  const isDirectHeader = HEADER_TAGS.has(tagName);
  const headerAncestor = element.closest('h1, h2, h3, h4, h5, h6');
  const isHeader = isDirectHeader || headerAncestor !== null;
  const headerLevel = isDirectHeader
    ? parseInt(tagName.charAt(1), 10)
    : headerAncestor
      ? parseInt(headerAncestor.tagName.charAt(1), 10)
      : 0;
  const isLink = tagName === 'a' || element.closest('a') !== null;

  return {
    isBold: checkIsBold(element, tagName),
    isItalic: checkIsItalic(element, tagName),
    isHeader,
    headerLevel,
    isInTable: element.closest('table') !== null,
    isInList: element.closest('ul, ol, dl') !== null,
    isInInfobox: checkIsInInfobox(element),
    isLink,
    linkHref: isLink ? getLinkHref(element) : null,
  };
}

interface TableFeatures {
  tableRow: number | null;
  tableCol: number | null;
  isTableHeader: boolean;
}

function extractTableFeatures(
  element: Element,
  tagName: string,
  tableContext: TableContext | null
): TableFeatures {
  return {
    tableRow: tableContext?.row ?? null,
    tableCol: tableContext?.col ?? null,
    isTableHeader: tagName === 'th' || element.closest('th') !== null,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateTokenId(url: string, index: number, text: string): string {
  const hash = createHash('md5')
    .update(`${url}:${index}:${text.substring(0, 50)}`)
    .digest('hex')
    .substring(0, 8);
  return `tok_${index}_${hash}`;
}

function getXPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === current.ELEMENT_NODE) {
    let index = 1;
    let sibling: Element | null = current.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === current.tagName) index++;
      sibling = sibling.previousElementSibling;
    }

    parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
    current = current.parentElement;
  }

  return '/' + parts.join('/');
}

function getCSSPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === current.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }

    if (current.classList.length > 0) {
      selector += '.' + Array.from(current.classList).slice(0, 2).join('.');
    }

    const siblings = current.parentElement?.children;
    if (siblings && siblings.length > 1) {
      const index = Array.from(siblings).indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

function checkIsBold(element: Element, tagName: string): boolean {
  if (BOLD_TAGS.has(tagName)) return true;
  if (element.closest('strong, b')) return true;
  const style = element.getAttribute('style');
  return style !== null && /font-weight:\s*(bold|[6-9]00)/i.test(style);
}

function checkIsItalic(element: Element, tagName: string): boolean {
  if (ITALIC_TAGS.has(tagName)) return true;
  if (element.closest('em, i')) return true;
  const style = element.getAttribute('style');
  return style !== null && /font-style:\s*italic/i.test(style);
}

function checkIsInInfobox(element: Element): boolean {
  for (const className of INFOBOX_CLASSES) {
    if (element.closest(`.${className}`)) return true;
  }
  return false;
}

function getLinkHref(element: Element): string | null {
  const link = element.tagName.toLowerCase() === 'a' ? element : element.closest('a');
  return link?.getAttribute('href') ?? null;
}

function detectSourceType(url: string): LinearizationResult['sourceType'] {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('fandom.com') || urlLower.includes('.wikia.com')) return 'fandom';
  if (urlLower.includes('wikipedia.org')) return 'wikipedia';
  if (urlLower.includes('anilist.co')) return 'anilist';
  if (urlLower.includes('comicvine.gamespot.com')) return 'comicvine';
  return 'unknown';
}

// ============================================================================
// BIO Label Types (re-exported from bio-types.ts for convenience)
// ============================================================================

export { BIO_LABELS, getAllBIOTags, type EntityType, type BIOTag } from './bio-types';

export function entitySpansToBIO(
  tokens: LinearizedToken[],
  entitySpans: Array<{ start: number; end: number; type: EntityType }>
): BIOTag[] {
  const labels: BIOTag[] = new Array<BIOTag>(tokens.length).fill('O');
  for (const span of entitySpans) {
    for (let i = span.start; i <= span.end && i < tokens.length; i++) {
      labels[i] = i === span.start ? `B-${span.type}` : `I-${span.type}`;
    }
  }
  return labels;
}

export function bioToEntitySpans(
  labels: BIOTag[]
): Array<{ start: number; end: number; type: EntityType }> {
  const spans: Array<{ start: number; end: number; type: EntityType }> = [];
  let currentSpan: { start: number; type: EntityType } | null = null;

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!label) continue;

    if (label === 'O') {
      if (currentSpan) {
        spans.push({ ...currentSpan, end: i - 1 });
        currentSpan = null;
      }
    } else if (label.startsWith('B-')) {
      if (currentSpan) {
        spans.push({ ...currentSpan, end: i - 1 });
      }
      currentSpan = { start: i, type: label.substring(2) as EntityType };
    } else if (label.startsWith('I-') && !currentSpan) {
      currentSpan = { start: i, type: label.substring(2) as EntityType };
    }
  }

  if (currentSpan) {
    spans.push({ ...currentSpan, end: labels.length - 1 });
  }

  return spans;
}

export type { LinearizationOptions as DOMLinearizationOptions };
