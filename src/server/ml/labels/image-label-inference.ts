/**
 * Image Label Inference Module
 *
 * Automatically infers image labels from LinearizedToken features.
 * Bridges DOM linearization with training data classification.
 *
 * @module ml/labels/image-label-inference
 */

import type {
  ImageType,
  ImageQuality,
  ImageContentType,
  ImageLabel,
  ImageLabelContext,
  InferredImageLabel,
  ImageStats,
} from '@/types/training/image-labels';

import type { LinearizedToken } from '../features/dom-linearizer';

// ============================================================================
// Constants
// ============================================================================

const COVER_URL_PATTERNS = [
  /cover/i,
  /poster/i,
  /main[-_]?image/i,
  /keyvisual/i,
];

const VOLUME_COVER_PATTERNS = [
  /vol(ume)?[-_]?\d+/i,
  /v\d+[-_]cover/i,
  /tank[oō]bon/i,
];

const CHARACTER_PATTERNS = [
  /character/i,
  /chara/i,
  /portrait/i,
  /profile/i,
];

const PROMOTIONAL_PATTERNS = [
  /promo/i,
  /banner/i,
  /advertisement/i,
  /ad[-_]/i,
];

const LOGO_PATTERNS = [
  /logo/i,
  /brand/i,
  /icon/i,
  /favicon/i,
];

const SCREENSHOT_PATTERNS = [
  /screenshot/i,
  /screen[-_]?cap/i,
  /anime[-_]?scene/i,
  /episode[-_]?\d+/i,
];

// Quality thresholds
const MIN_HIGH_QUALITY_SIZE = 300;
const MIN_MEDIUM_QUALITY_SIZE = 150;
const MIN_LOW_QUALITY_SIZE = 50;

// ============================================================================
// Main Inference Function
// ============================================================================

/**
 * Infer image label from a LinearizedToken
 */
export function inferImageLabel(
  token: LinearizedToken,
  _index: number
): InferredImageLabel | null {
  if (!token.isImage || !token.imageSrc) {
    return null;
  }

  const context: ImageLabelContext = {
    src: token.imageSrc,
    alt: token.imageAlt,
    width: token.imageWidth,
    height: token.imageHeight,
    isInInfobox: token.isInInfobox,
    isInTable: token.isInTable,
    sectionType: token.sectionType,
    precedingText: token.precedingText,
    followingText: token.followingText,
  };

  const imageType = inferImageType(context);
  const quality = inferImageQuality(context);
  const contentType = inferContentType(context);
  const isRelevant = determineRelevance(imageType, context);

  const confidence = calculateConfidence(imageType, quality, context);
  const reasons = generateReasons(imageType, quality, contentType, context);

  return {
    label: {
      imageType: imageType.type,
      quality: quality.tier,
      contentType: contentType.type,
      isRelevant,
      caption: extractCaption(context),
      improvedAlt: generateImprovedAlt(imageType.type, context),
    },
    confidence,
    reasons,
  };
}

// ============================================================================
// Type Inference
// ============================================================================

interface TypeInference {
  type: ImageType;
  confidence: number;
}

function inferImageType(context: ImageLabelContext): TypeInference {
  const src = context.src.toLowerCase();
  const alt = (context.alt ?? '').toLowerCase();
  const combined = `${src} ${alt}`;

  // Check for cover images
  if (context.isInInfobox && isLargeImage(context)) {
    return { type: 'COVER', confidence: 0.9 };
  }

  if (COVER_URL_PATTERNS.some(p => p.test(combined))) {
    return { type: 'COVER', confidence: 0.85 };
  }

  // Check for volume covers
  if (VOLUME_COVER_PATTERNS.some(p => p.test(combined))) {
    return { type: 'VOLUME_COVER', confidence: 0.85 };
  }

  // Check for character images
  if (CHARACTER_PATTERNS.some(p => p.test(combined))) {
    return { type: 'CHARACTER', confidence: 0.8 };
  }

  // Check for screenshots
  if (SCREENSHOT_PATTERNS.some(p => p.test(combined))) {
    return { type: 'SCREENSHOT', confidence: 0.8 };
  }

  // Check for promotional/banner images
  if (PROMOTIONAL_PATTERNS.some(p => p.test(combined))) {
    return { type: 'PROMOTIONAL', confidence: 0.75 };
  }

  // Check for logos/icons
  if (LOGO_PATTERNS.some(p => p.test(combined)) || isSmallImage(context)) {
    const type = isTinyImage(context) ? 'ICON' : 'LOGO';
    return { type, confidence: 0.7 };
  }

  // Check for banner based on aspect ratio
  if (isBannerAspectRatio(context)) {
    return { type: 'BANNER', confidence: 0.65 };
  }

  // Default: manga panel if in content area with medium size
  if (context.sectionType === 'main_content' && isMediumImage(context)) {
    return { type: 'PANEL', confidence: 0.5 };
  }

  return { type: 'UNKNOWN', confidence: 0.3 };
}

// ============================================================================
// Quality Inference
// ============================================================================

interface QualityInference {
  tier: ImageQuality;
  confidence: number;
}

function inferImageQuality(context: ImageLabelContext): QualityInference {
  const { width, height } = context;

  if (width === null || height === null) {
    return { tier: 'MEDIUM', confidence: 0.4 };
  }

  const minDimension = Math.min(width, height);
  const maxDimension = Math.max(width, height);

  // Very small images are low quality or exclude
  if (maxDimension < MIN_LOW_QUALITY_SIZE) {
    return { tier: 'EXCLUDE', confidence: 0.85 };
  }

  if (minDimension < MIN_LOW_QUALITY_SIZE) {
    return { tier: 'LOW', confidence: 0.75 };
  }

  if (minDimension >= MIN_HIGH_QUALITY_SIZE) {
    return { tier: 'HIGH', confidence: 0.8 };
  }

  if (minDimension >= MIN_MEDIUM_QUALITY_SIZE) {
    return { tier: 'MEDIUM', confidence: 0.7 };
  }

  return { tier: 'LOW', confidence: 0.6 };
}

// ============================================================================
// Content Type Inference
// ============================================================================

interface ContentTypeInference {
  type: ImageContentType;
  confidence: number;
}

function inferContentType(context: ImageLabelContext): ContentTypeInference {
  const src = context.src.toLowerCase();
  const alt = (context.alt ?? '').toLowerCase();

  // Photo keywords
  if (/photo|photograph|pic|headshot/.test(alt)) {
    return { type: 'PHOTOGRAPH', confidence: 0.75 };
  }

  // Diagram/chart keywords
  if (/diagram|chart|graph|table|timeline/.test(alt)) {
    return { type: 'DIAGRAM', confidence: 0.8 };
  }

  // Text-heavy indicators
  if (/text|caption|subtitle|title[-_]card/.test(src)) {
    return { type: 'TEXT_HEAVY', confidence: 0.7 };
  }

  // Decorative indicators (buttons, backgrounds, etc.)
  if (/button|bg|background|spacer|divider/.test(src)) {
    return { type: 'DECORATIVE', confidence: 0.85 };
  }

  // Default: assume artwork for manga-related content
  return { type: 'ARTWORK', confidence: 0.6 };
}

// ============================================================================
// Relevance Determination
// ============================================================================

function determineRelevance(
  imageType: TypeInference,
  context: ImageLabelContext
): boolean {
  // Always relevant types
  const relevantTypes: ImageType[] = [
    'COVER',
    'VOLUME_COVER',
    'CHAPTER_COVER',
    'PANEL',
    'CHARACTER',
    'PROMOTIONAL',
  ];

  if (relevantTypes.includes(imageType.type)) {
    return true;
  }

  // Screenshots may be relevant
  if (imageType.type === 'SCREENSHOT') {
    return true;
  }

  // Icons, logos, banners are typically not relevant
  if (['ICON', 'LOGO', 'BANNER'].includes(imageType.type)) {
    return false;
  }

  // Unknown - check if in content area
  if (context.sectionType === 'main_content' || context.isInInfobox) {
    return true;
  }

  return false;
}

// ============================================================================
// Confidence & Reasons
// ============================================================================

function calculateConfidence(
  imageType: TypeInference,
  quality: QualityInference,
  context: ImageLabelContext
): number {
  let confidence = (imageType.confidence + quality.confidence) / 2;

  // Boost confidence if we have good context
  if (context.alt && context.alt.length > 10) {
    confidence += 0.1;
  }

  if (context.width !== null && context.height !== null) {
    confidence += 0.05;
  }

  return Math.min(confidence, 1.0);
}

function generateReasons(
  imageType: TypeInference,
  quality: QualityInference,
  contentType: ContentTypeInference,
  context: ImageLabelContext
): string[] {
  const reasons: string[] = [];

  // Type reasons
  if (context.isInInfobox && imageType.type === 'COVER') {
    reasons.push('Located in infobox, likely main cover image');
  }

  if (imageType.type === 'UNKNOWN') {
    reasons.push('Could not determine image type from URL or context');
  }

  // Quality reasons
  if (quality.tier === 'EXCLUDE') {
    reasons.push('Image too small for training use');
  }

  if (quality.tier === 'HIGH') {
    reasons.push('Good resolution suitable for training');
  }

  // Content type reasons
  if (contentType.type === 'DECORATIVE') {
    reasons.push('Appears to be decorative UI element');
  }

  return reasons;
}

// ============================================================================
// Helper Functions
// ============================================================================

function isLargeImage(context: ImageLabelContext): boolean {
  const { width, height } = context;
  if (width === null || height === null) return false;
  return width >= 200 && height >= 200;
}

function isMediumImage(context: ImageLabelContext): boolean {
  const { width, height } = context;
  if (width === null || height === null) return false;
  return width >= 100 && height >= 100 && (width < 200 || height < 200);
}

function isSmallImage(context: ImageLabelContext): boolean {
  const { width, height } = context;
  if (width === null || height === null) return false;
  return width < 100 || height < 100;
}

function isTinyImage(context: ImageLabelContext): boolean {
  const { width, height } = context;
  if (width === null || height === null) return false;
  return width < 50 && height < 50;
}

function isBannerAspectRatio(context: ImageLabelContext): boolean {
  const { width, height } = context;
  if (width === null || height === null) return false;
  const ratio = width / height;
  return ratio > 3 || ratio < 0.33;
}

function extractCaption(context: ImageLabelContext): string | undefined {
  // Use alt text as caption if meaningful
  if (context.alt && context.alt.length > 5 && !/^(image|img|photo)$/i.test(context.alt)) {
    return context.alt;
  }

  // Use following text if it looks like a caption
  if (context.followingText && context.followingText.length < 100) {
    return context.followingText;
  }

  return undefined;
}

function generateImprovedAlt(imageType: ImageType, context: ImageLabelContext): string | undefined {
  // Only generate if alt is missing or generic
  if (context.alt && context.alt.length > 10 && !/^(image|img|photo)$/i.test(context.alt)) {
    return undefined;
  }

  const typeDescriptions: Record<ImageType, string> = {
    COVER: 'Manga cover artwork',
    VOLUME_COVER: 'Volume cover illustration',
    CHAPTER_COVER: 'Chapter title page',
    PANEL: 'Manga panel excerpt',
    CHARACTER: 'Character illustration',
    AUTHOR_PHOTO: 'Author photograph',
    PROMOTIONAL: 'Promotional artwork',
    SCREENSHOT: 'Anime screenshot',
    LOGO: 'Series logo',
    ICON: 'Icon image',
    BANNER: 'Banner image',
    UNKNOWN: 'Related image',
  };

  return typeDescriptions[imageType];
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Infer labels for all image tokens in a token sequence
 */
export function inferImageLabelsForTokens(tokens: LinearizedToken[]): ImageLabel[] {
  const labels: ImageLabel[] = [];

  for (const [i, token] of tokens.entries()) {
    if (!token.isImage) continue;

    const inferred = inferImageLabel(token, i);
    if (inferred) {
      labels.push({
        tokenIndex: i,
        tokenId: token.id,
        ...inferred.label,
        confidence: inferred.confidence,
      });
    }
  }

  return labels;
}

/**
 * Compute image statistics from labels
 */
export function computeImageStats(labels: ImageLabel[]): ImageStats {
  const stats: ImageStats = {
    total: labels.length,
    byType: {},
    byQuality: {},
    relevant: 0,
    irrelevant: 0,
    withCaptions: 0,
    withImprovedAlt: 0,
  };

  for (const label of labels) {
    // Count by type
    const currentTypeCount = stats.byType[label.imageType] ?? 0;
    stats.byType[label.imageType] = currentTypeCount + 1;

    // Count by quality
    const currentQualityCount = stats.byQuality[label.quality] ?? 0;
    stats.byQuality[label.quality] = currentQualityCount + 1;

    // Count relevance
    if (label.isRelevant) {
      stats.relevant++;
    } else {
      stats.irrelevant++;
    }

    // Count captions
    if (label.caption) {
      stats.withCaptions++;
    }

    if (label.improvedAlt) {
      stats.withImprovedAlt++;
    }
  }

  return stats;
}
