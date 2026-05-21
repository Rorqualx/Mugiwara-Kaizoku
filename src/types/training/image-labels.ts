/**
 * Image Label Types for LLM Training Data
 *
 * Extends existing image tokens with explicit classification
 * for training data quality and use case filtering.
 *
 * @module types/training/image-labels
 */

// ============================================================================
// Image Type Classification
// ============================================================================

/**
 * Primary image type classification
 */
export type ImageType =
  | 'COVER'           // Manga cover art
  | 'VOLUME_COVER'    // Volume-specific cover
  | 'CHAPTER_COVER'   // Chapter cover/title page
  | 'PANEL'           // Manga panel excerpt
  | 'CHARACTER'       // Character portrait/art
  | 'AUTHOR_PHOTO'    // Author photograph
  | 'PROMOTIONAL'     // Promotional artwork
  | 'SCREENSHOT'      // Anime screenshot
  | 'LOGO'            // Publisher/series logo
  | 'ICON'            // Small icon/badge
  | 'BANNER'          // Site banner/advertisement
  | 'UNKNOWN';        // Unclassified

/**
 * Image quality assessment
 */
export type ImageQuality =
  | 'HIGH'            // High resolution, clear, suitable for training
  | 'MEDIUM'          // Acceptable quality
  | 'LOW'             // Poor quality, small, blurry
  | 'EXCLUDE';        // Should not be used (watermarked, corrupt, etc.)

/**
 * Image content classification for training use cases
 */
export type ImageContentType =
  | 'ARTWORK'         // Original manga/anime artwork
  | 'PHOTOGRAPH'      // Real-world photograph
  | 'DIAGRAM'         // Chart, graph, or diagram
  | 'TEXT_HEAVY'      // Image with significant text overlay
  | 'DECORATIVE';     // Decorative/UI element

// ============================================================================
// Image Label Structure
// ============================================================================

/**
 * Label for a single image token
 * Links to token by index or ID
 */
export interface ImageLabel {
  /** Token index in the tokens array */
  tokenIndex: number;

  /** Optional token ID for cross-referencing */
  tokenId?: string | undefined;

  /** Primary image type classification */
  imageType: ImageType;

  /** Quality assessment */
  quality: ImageQuality;

  /** Content type classification */
  contentType: ImageContentType;

  /** Whether this image is relevant to the manga content */
  isRelevant: boolean;

  /** Caption or description (if available or annotated) */
  caption?: string | undefined;

  /** Alternative text improvement (if original alt is poor) */
  improvedAlt?: string | undefined;

  /** Associated entity (e.g., character name if CHARACTER type) */
  associatedEntity?: {
    type: string;
    value: string;
  } | undefined;

  /** Annotation metadata */
  annotatedAt?: string | undefined;
  annotatedBy?: string | undefined;

  /** Confidence score if auto-labeled */
  confidence?: number | undefined;
}

// ============================================================================
// Aggregated Image Statistics
// ============================================================================

/**
 * Statistics about images in a document
 */
export interface ImageStats {
  /** Total image count */
  total: number;

  /** Count by image type */
  byType: Partial<Record<ImageType, number>>;

  /** Count by quality */
  byQuality: Partial<Record<ImageQuality, number>>;

  /** Count of relevant vs irrelevant */
  relevant: number;
  irrelevant: number;

  /** Images with captions */
  withCaptions: number;

  /** Images with improved alt text */
  withImprovedAlt: number;
}

// ============================================================================
// Image Label Inference
// ============================================================================

/**
 * Context for inferring image labels from existing token features
 */
export interface ImageLabelContext {
  /** Image source URL */
  src: string;

  /** Original alt text */
  alt: string | null;

  /** Image dimensions */
  width: number | null;
  height: number | null;

  /** Position context */
  isInInfobox: boolean;
  isInTable: boolean;
  sectionType: string;

  /** Surrounding text for context */
  precedingText: string | null;
  followingText: string | null;
}

/**
 * Result of automatic image label inference
 */
export interface InferredImageLabel {
  label: Omit<ImageLabel, 'tokenIndex' | 'tokenId'>;
  confidence: number;
  reasons: string[];
}

// ============================================================================
// Image Label Operations
// ============================================================================

/**
 * Options for filtering images by labels
 */
export interface ImageLabelFilter {
  types?: ImageType[] | undefined;
  qualities?: ImageQuality[] | undefined;
  contentTypes?: ImageContentType[] | undefined;
  relevantOnly?: boolean | undefined;
  minConfidence?: number | undefined;
}

/**
 * Batch update for image labels
 */
export interface ImageLabelUpdate {
  tokenIndex: number;
  updates: Partial<Omit<ImageLabel, 'tokenIndex' | 'tokenId'>>;
}
