/**
 * Image Type Detection Module
 *
 * Functions for detecting and classifying image types based on context.
 *
 * Extracted from: index.ts (lines 573-614)
 * Complexity reduced using lookup table pattern
 */

// ============================================================================
// Type Definitions
// ============================================================================

type ImageType = 'cover' | 'gallery' | 'inline' | 'thumbnail' | 'logo' | 'character' | 'volume' | 'unknown';

interface ImageTypePattern {
  keywords: string[];
  type: ImageType;
}

// ============================================================================
// Detection Configuration
// ============================================================================

/**
 * URL pattern detection rules
 */
const URL_PATTERNS: ImageTypePattern[] = [
  { keywords: ['cover'], type: 'cover' },
  { keywords: ['volume'], type: 'volume' },
  { keywords: ['character'], type: 'character' },
  { keywords: ['logo'], type: 'logo' },
  { keywords: ['thumb'], type: 'thumbnail' },
  { keywords: ['gallery'], type: 'gallery' },
];

/**
 * Text content detection rules (alt/title)
 */
const TEXT_PATTERNS: ImageTypePattern[] = [
  { keywords: ['cover'], type: 'cover' },
  { keywords: ['volume'], type: 'volume' },
  { keywords: ['character'], type: 'character' },
  { keywords: ['logo'], type: 'logo' },
];

/**
 * Parent class detection rules
 */
const PARENT_CLASS_PATTERNS: ImageTypePattern[] = [
  { keywords: ['gallery'], type: 'gallery' },
  { keywords: ['thumb'], type: 'thumbnail' },
  { keywords: ['content', 'mw-parser-output'], type: 'inline' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if text contains any keyword (case-insensitive)
 */
function containsKeyword(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Find matching image type from patterns
 */
function findTypeFromPatterns(text: string, patterns: ImageTypePattern[]): ImageType | null {
  for (const pattern of patterns) {
    if (containsKeyword(text, pattern.keywords)) {
      return pattern.type;
    }
  }
  return null;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect image type from context using lookup table pattern
 */
export function detectImageType(context: {
  url?: string;
  alt?: string;
  title?: string;
  parentClass?: string;
  position?: number;
}): ImageType {
  const { url = '', alt = '', title = '', parentClass = '', position } = context;

  // 1. Check URL patterns
  const urlType = findTypeFromPatterns(url, URL_PATTERNS);
  if (urlType) return urlType;

  // 2. Check alt/title text
  const text = (alt + ' ' + title).toLowerCase();
  const textType = findTypeFromPatterns(text, TEXT_PATTERNS);
  if (textType) return textType;

  // 3. Check parent class with special rules
  if (parentClass.includes('infobox') && position === 0) {
    return 'cover';
  }

  const parentType = findTypeFromPatterns(parentClass, PARENT_CLASS_PATTERNS);
  if (parentType) return parentType;

  return 'unknown';
}
