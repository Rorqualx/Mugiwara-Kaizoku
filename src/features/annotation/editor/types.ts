/**
 * Annotation Editor Types
 */

import type { BIOTag, EntityType } from '@/server/ml/features/bio-types';

/**
 * Recovery strategy used to resolve a selection back to DOM elements
 * Tracks which fallback mechanism was used during resolution
 */
export type RecoveryStrategy = 'xpath' | 'context' | 'global' | 'text-search' | 'manual';

/**
 * Text Selection - stores exactly what users select in the UI
 * This is the source of truth for annotations - tokens are derived from selections
 */
export interface TextSelection {
  /** Unique ID for this selection */
  id: string;
  /** The selected text content */
  text: string;
  /** Entity type label */
  label: EntityType;

  // === Primary anchor (XPath + char offsets) ===
  /** XPath to the DOM element containing this text */
  xpath: string;
  /** Character offset within the element's text content */
  charStart: number;
  charEnd: number;

  // === TextQuoteSelector for fuzzy reconstruction ===
  /** 32 chars before selection (for fuzzy matching if xpath fails) */
  prefix?: string;
  /** 32 chars after selection (for fuzzy matching if xpath fails) */
  suffix?: string;

  // === Global position fallback ===
  /** Character position in entire document text (fallback anchor) */
  globalCharStart?: number;
  globalCharEnd?: number;

  // === Content fingerprinting (for reliable resolution verification) ===
  /** SHA-256 hash of selected text for verification */
  textHash?: string;
  /** SHA-256 hash of prefix + text + suffix for context verification */
  contextHash?: string;

  // === Stable selector (more reliable than XPath for DOM mutations) ===
  /** CSS selector path to element (survives some DOM changes better than XPath) */
  cssPath?: string;

  // === Recovery tracking ===
  /** Which resolution strategy was used (undefined = not yet resolved) */
  recoveryStrategy?: RecoveryStrategy;
  /** Last time this selection was successfully resolved */
  lastResolvedAt?: number;

  // === Image fields ===
  /** For images: the image source URL */
  imageSrc?: string;
  /** For images: alt text */
  imageAlt?: string;
  /** Is this an image selection */
  isImage?: boolean;

  /** Timestamp when created */
  createdAt: number;
}

/**
 * Page annotations stored in features.selections
 */
export interface AnnotationSelections {
  version: number;
  selections: TextSelection[];
}

/** Token type classification */
export type TokenType = 'word' | 'number' | 'date' | 'punctuation' | 'cjk' | 'mixed' | 'image';

/** Section type for container context */
export type SectionType = 'infobox' | 'sidebar' | 'main_content' | 'header' | 'footer' | 'navigation' | 'unknown';

export interface DisplayToken {
  // === Core fields (always present) ===
  id: string;
  text: string;
  tagName: string;
  label: BIOTag;
  index: number;
  xpath: string | null;

  // === Image fields ===
  isImage: boolean;
  imageSrc: string | null;
  imageAlt: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;

  // === Text features ===
  normalizedText?: string;
  textLength?: number;
  wordCount?: number;
  charOffset?: number;
  documentPosition?: number;

  // === Token classification ===
  tokenType?: TokenType;
  isNumeric?: boolean;
  isDate?: boolean;
  isPunctuation?: boolean;
  isCJK?: boolean;
  isAllCaps?: boolean;

  // === Semantic patterns ===
  matchesDatePattern?: boolean;
  matchesVolumePattern?: boolean;
  matchesChapterPattern?: boolean;
  matchesNamePattern?: boolean;

  // === Styling ===
  isBold?: boolean;
  isItalic?: boolean;
  isHeader?: boolean;
  headerLevel?: number;
  fontSize?: string | null;
  fontWeight?: string | null;
  color?: string | null;
  backgroundColor?: string | null;

  // === Structure ===
  domDepth?: number;
  siblingIndex?: number;
  parentId?: string | null;
  childIds?: string[];
  cssPath?: string;
  classes?: string[];
  elementId?: string | null;
  isFirstInElement?: boolean;
  isLastInElement?: boolean;

  // === Location context ===
  isInTable?: boolean;
  isInList?: boolean;
  isInInfobox?: boolean;
  tableRow?: number | null;
  tableCol?: number | null;
  isTableHeader?: boolean;
  sectionType?: SectionType;

  // === Link info ===
  isLink?: boolean;
  linkHref?: string | null;

  // === Context signals ===
  precedingText?: string | null;
  followingText?: string | null;
  distanceFromLabel?: number;
  nearestLabelText?: string | null;

  // === Source HTML ===
  sourceHtml?: string;
  htmlContext?: string;
}

export const ENTITY_COLORS: Record<EntityType, string> = {
  // Core metadata (alphabetical)
  ALT_TITLE: 'indigo',
  ARTIST: 'teal',
  AUTHOR: 'green',
  COVER_IMAGE: 'red',
  DEMOGRAPHIC: 'gray',
  FORMAT: 'lime',
  GENRE: 'pink',
  MAGAZINE: 'lime',
  ORIGINAL_RUN: 'yellow', // Same color as dates
  START_DATE: 'yellow', // Serialization start
  END_DATE: 'orange', // Serialization end
  PAGE_TYPE: 'gray', // Page classification color
  PUBLISHER: 'lime',
  RELEASE_DATE: 'yellow',
  SERIES_SUMMARY: 'grape',
  STATUS: 'orange',
  TAGS: 'cyan',
  THEMES: 'teal',
  TITLE: 'blue',

  // Counts
  CHAPTER_COUNT: 'cyan',
  CHAPTER_RANGE: 'teal', // Range of chapters in a volume
  PAGE_COUNT: 'cyan',
  VOLUME_COUNT: 'cyan',
  VOLUME_NUMBER: 'blue',
  VOLUME_PAGE_COUNT: 'cyan', // Pages in a volume

  // Chapter-specific
  CHAPTER_ALT_TITLE: 'indigo',
  CHAPTER_BELONGS_TO_VOLUME: 'cyan',
  CHAPTER_COVER: 'red',
  CHAPTER_NUMBER: 'teal',
  CHAPTER_RELEASE_DATE: 'yellow',
  CHAPTER_SUMMARY: 'grape',
  CHAPTER_TITLE: 'violet',
  CHAPTER_URL: 'blue',

  // Volume-specific
  ENGLISH_ISBN: 'pink', // Distinct from orange (JP ISBN)
  ENGLISH_PUBLISHER: 'teal', // Distinct from lime (JP PUBLISHER)
  ENGLISH_RELEASE_DATE: 'lime', // Distinct from yellow (JP VOLUME_RELEASE_DATE)
  ISBN: 'orange',
  VOLUME_ALT_TITLE: 'indigo', // Alternative/Japanese volume title
  VOLUME_COVER: 'red',
  VOLUME_RELEASE_DATE: 'yellow',
  VOLUME_SUMMARY: 'grape',
  VOLUME_TITLE: 'violet',
  VOLUME_URL: 'blue',

  // Navigation/Links
  CHAPTERS_LIST_URL: 'blue',
  GALLERY_URL: 'blue',
  VOLUMES_LIST_URL: 'blue',

  // Table/Data sections
  CHAPTER_TABLE: 'indigo',
  GALLERY_SECTION: 'pink',
  VOLUME_CHAPTER_TABLE: 'indigo', // Combined volume+chapter table
  VOLUME_TABLE: 'indigo',
};

// B/I prefix mode shortcuts
export type BioMode = 'B' | 'I';

export const BIO_MODE_SHORTCUTS: Record<string, BioMode> = {
  b: 'B', // Begin - start of entity span
  i: 'I', // Inside - continuation of entity span
};

// Clear label shortcut
export const CLEAR_SHORTCUT = 'o';

// Legacy: Entity shortcuts removed - use B/I toggle + entity palette buttons
export const KEYBOARD_SHORTCUTS: Record<string, EntityType> = {};
export const ALT_SHORTCUTS: Record<string, EntityType> = {};
export const SHIFT_SHORTCUTS: Record<string, EntityType> = {};

// Navigation shortcuts (not labels - trigger navigation actions)
export const NAV_SHORTCUTS = {
  'ctrl+n': 'next_unlabeled',
  'ctrl+p': 'prev_unlabeled',
  'ctrl+g': 'goto_token',
  'ctrl+l': 'show_labeled_only',
  'ctrl+u': 'show_unlabeled_only',
} as const;

export type NavAction = (typeof NAV_SHORTCUTS)[keyof typeof NAV_SHORTCUTS];
