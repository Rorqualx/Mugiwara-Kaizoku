/**
 * Ground Truth Types for ML Label Validation
 *
 * Type definitions for collecting and comparing ground truth data
 * against ML auto-labeled annotations.
 */

// ============================================================================
// Ground Truth Data Structures
// ============================================================================

/**
 * Ground truth metadata for a manga title
 */
export interface GroundTruth {
  /** Primary title (English) */
  title: string;

  /** Japanese title (kanji/katakana) */
  japaneseTitle?: string;

  /** Alternative titles (romanized, aliases) */
  altTitles?: string[];

  /** Author/writer name */
  author: string;

  /** Artist name (if different from author) */
  artist?: string;

  /** Publication status */
  status: 'Ongoing' | 'Completed' | 'Hiatus' | 'Cancelled';

  /** Target demographic */
  demographic: string;

  /** Publisher name */
  publisher: string;

  /** Magazine serialized in */
  magazine?: string;

  /** Total number of volumes */
  volumeCount: number;

  /** Total number of chapters */
  chapterCount: number;

  /** Genre tags */
  genres: string[];

  /** Serialization start date (ISO format) */
  startDate?: string;

  /** Serialization end date (ISO format, if completed) */
  endDate?: string;

  /** Volume-specific ground truth data */
  volumes?: VolumeGroundTruth[];

  /** Story arc information */
  arcs?: StoryArcGroundTruth[];

  /** Sources used to compile this ground truth */
  sources: string[];

  /** When this ground truth was collected */
  collectedAt: string;
}

/**
 * Ground truth for a specific volume
 */
export interface VolumeGroundTruth {
  /** Volume sequence number */
  number: number;

  /** Volume title (if named) */
  title?: string;

  /** ISBN-10 or ISBN-13 */
  isbn?: string;

  /** Release date (ISO format) */
  releaseDate?: string;

  /** Chapter range [start, end] inclusive */
  chapterRange?: [number, number];

  /** Page count */
  pageCount?: number;
}

/**
 * Ground truth for a story arc
 */
export interface StoryArcGroundTruth {
  /** Arc name */
  name: string;

  /** Japanese name */
  japaneseName?: string;

  /** Chapter range [start, end] inclusive */
  chapterRange: [number, number];
}

// ============================================================================
// Analysis Result Types
// ============================================================================

/**
 * Result of comparing labels to ground truth
 */
export interface AnalysisResult {
  /** Title being analyzed */
  title: string;

  /** Slug used for file naming */
  slug: string;

  /** When the analysis was performed */
  analyzedAt: string;

  /** Summary statistics */
  summary: AnalysisSummary;

  /** Labels found by entity type */
  labelsByType: Record<string, LabelTypeStats>;

  /** Core metadata comparison */
  coreMetadataCheck: CoreMetadataCheck;

  /** Volume-specific checks */
  volumeChecks: VolumeCheck[];

  /** Issues detected */
  issues: AnalysisIssue[];

  /** BOOTSTRAP vs AGENT_REVIEWED comparison */
  statusComparison?: StatusComparison;
}

/**
 * Summary statistics for the analysis
 */
export interface AnalysisSummary {
  /** Total pages analyzed */
  totalPages: number;

  /** Pages by source type */
  pagesBySource: Record<string, number>;

  /** Pages by status */
  pagesByStatus: Record<string, number>;

  /** Total labeled tokens */
  totalLabeledTokens: number;

  /** Total unique entity types found */
  uniqueEntityTypes: number;

  /** Pages with 0 tokens */
  emptyPages: number;
}

/**
 * Statistics for a specific label type
 */
export interface LabelTypeStats {
  /** Entity type */
  entityType: string;

  /** Total occurrences (B- tags) */
  count: number;

  /** Sample values found */
  samples: string[];

  /** Pages where this label appears */
  pageCount: number;
}

/**
 * Core metadata presence check
 */
export interface CoreMetadataCheck {
  /** Title found in labels */
  title: MetadataCheckResult;

  /** Author found in labels */
  author: MetadataCheckResult;

  /** Publisher found in labels */
  publisher: MetadataCheckResult;

  /** Demographic found in labels */
  demographic: MetadataCheckResult;

  /** Magazine found in labels */
  magazine: MetadataCheckResult;

  /** Status found in labels */
  status: MetadataCheckResult;

  /** Genre found in labels */
  genres: MetadataCheckResult;

  /** Volume count found in labels */
  volumeCount: MetadataCheckResult;

  /** Chapter count found in labels */
  chapterCount: MetadataCheckResult;
}

/**
 * Result of checking a single metadata field
 */
export interface MetadataCheckResult {
  /** Whether the field was found */
  found: boolean;

  /** Ground truth value */
  expected: string | number | string[];

  /** Value(s) found in labels */
  actual: string[];

  /** Whether the found value matches ground truth */
  matches: boolean;

  /** Notes about discrepancies */
  notes?: string;
}

/**
 * Volume-specific label check
 */
export interface VolumeCheck {
  /** Volume number */
  volumeNumber: number;

  /** Volume number found correctly */
  volumeNumberFound: boolean;

  /** ISBN found and correct */
  isbnFound: boolean;

  /** ISBN value if found */
  isbnValue?: string;

  /** Release date found */
  releaseDateFound: boolean;

  /** Chapter range found */
  chapterRangeFound: boolean;

  /** Issues specific to this volume */
  issues: string[];
}

/**
 * An issue detected during analysis
 */
export interface AnalysisIssue {
  /** Issue category */
  category:
    | 'missing_label'
    | 'mislabeling'
    | 'over_labeling'
    | 'boundary_error'
    | 'navigation_noise'
    | 'value_mismatch';

  /** Severity level */
  severity: 'high' | 'medium' | 'low';

  /** Human-readable description */
  description: string;

  /** Entity type affected */
  entityType?: string;

  /** Sample problematic labels */
  samples?: string[];

  /** Recommended fix */
  recommendation: string;
}

/**
 * Comparison between BOOTSTRAP and AGENT_REVIEWED pages
 */
export interface StatusComparison {
  /** Number of BOOTSTRAP pages */
  bootstrapCount: number;

  /** Number of AGENT_REVIEWED pages */
  agentReviewedCount: number;

  /** Entity types found in BOOTSTRAP only */
  bootstrapOnlyEntities: string[];

  /** Entity types found in AGENT_REVIEWED only */
  agentReviewedOnlyEntities: string[];

  /** Quality metrics comparison */
  qualityMetrics: {
    /** Average labels per page in BOOTSTRAP */
    bootstrapAvgLabels: number;

    /** Average labels per page in AGENT_REVIEWED */
    agentReviewedAvgLabels: number;

    /** Core metadata presence in BOOTSTRAP */
    bootstrapCoreMetadata: number;

    /** Core metadata presence in AGENT_REVIEWED */
    agentReviewedCoreMetadata: number;
  };

  /** Key findings from comparison */
  findings: string[];
}

// ============================================================================
// Report Generation Types
// ============================================================================

/**
 * Configuration for report generation
 */
export interface ReportConfig {
  /** Include volume details */
  includeVolumeDetails: boolean;

  /** Include sample labels */
  includeSampleLabels: boolean;

  /** Max samples per entity type */
  maxSamplesPerType: number;

  /** Include recommendations */
  includeRecommendations: boolean;
}

/**
 * Default report configuration
 */
export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  includeVolumeDetails: true,
  includeSampleLabels: true,
  maxSamplesPerType: 5,
  includeRecommendations: true,
};
