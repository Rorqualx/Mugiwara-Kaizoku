/**
 * Optimization Types for ML Label Validation
 *
 * Types for Phase 6: Comparing validation findings with current
 * bootstrap/agent review implementation to identify improvements.
 */

// ============================================================================
// Optimization Analysis Types
// ============================================================================

/**
 * Result of comparing validation findings with current implementation
 */
export interface OptimizationAnalysis {
  /** Title being analyzed */
  title: string;

  /** Slug for file naming */
  slug: string;

  /** When analysis was performed */
  analyzedAt: string;

  /** Bootstrap labeler optimization opportunities */
  bootstrapOptimizations: BootstrapOptimization[];

  /** Agent review rule optimizations */
  agentReviewOptimizations: AgentReviewOptimization[];

  /** Pattern detection improvements */
  patternImprovements: PatternImprovement[];

  /** Summary metrics */
  summary: OptimizationSummary;
}

/**
 * Summary of optimization opportunities
 */
export interface OptimizationSummary {
  /** Total optimizations identified */
  totalOptimizations: number;

  /** Optimizations by impact level */
  byImpact: {
    high: number;
    medium: number;
    low: number;
  };

  /** Optimizations by category */
  byCategory: {
    bootstrap: number;
    agentReview: number;
    patterns: number;
  };

  /** Estimated accuracy improvement (%) */
  estimatedAccuracyGain: number;

  /** Risk assessment */
  riskLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Bootstrap Labeler Optimizations
// ============================================================================

/**
 * Optimization opportunity for bootstrap labeler
 */
export interface BootstrapOptimization {
  /** Unique ID for tracking */
  id: string;

  /** Category of optimization */
  category: BootstrapCategory;

  /** Impact level */
  impact: 'high' | 'medium' | 'low';

  /** Entity type affected */
  entityType: string;

  /** Description of the issue */
  issue: string;

  /** Current behavior in bootstrap labeler */
  currentBehavior: string;

  /** Proposed change */
  proposedChange: string;

  /** File(s) to modify */
  affectedFiles: string[];

  /** Code location hint */
  codeLocation?: string;

  /** Sample data showing the issue */
  samples?: string[];

  /** Risk of breaking existing functionality */
  breakingRisk: 'none' | 'low' | 'medium' | 'high';

  /** Suggested implementation approach */
  implementation?: string;
}

/**
 * Categories of bootstrap labeler issues
 */
export type BootstrapCategory =
  | 'missing_pattern'         // Pattern not detected
  | 'over_labeling'           // Too much labeled
  | 'under_labeling'          // Not enough labeled
  | 'wrong_entity_type'       // Mislabeled entity
  | 'boundary_error'          // Span boundaries wrong
  | 'confidence_threshold'    // Threshold too high/low
  | 'source_specific'         // Source-specific issue
  | 'page_type_detection'     // Wrong page type detected
  | 'pattern_propagation';    // Pattern not propagating

// ============================================================================
// Agent Review Optimizations
// ============================================================================

/**
 * Optimization opportunity for agent review rules
 */
export interface AgentReviewOptimization {
  /** Unique ID for tracking */
  id: string;

  /** Category of optimization */
  category: AgentReviewCategory;

  /** Impact level */
  impact: 'high' | 'medium' | 'low';

  /** Entity type affected */
  entityType: string;

  /** Description of the issue */
  issue: string;

  /** Current validation rule */
  currentRule: string;

  /** Proposed rule change */
  proposedRule: string;

  /** File(s) to modify */
  affectedFiles: string[];

  /** Sample data showing the gap */
  samples?: string[];

  /** Breaking risk assessment */
  breakingRisk: 'none' | 'low' | 'medium' | 'high';

  /** Backward compatibility notes */
  compatibilityNotes?: string;
}

/**
 * Categories of agent review issues
 */
export type AgentReviewCategory =
  | 'missing_validation'      // No rule for this case
  | 'too_strict'              // Rule rejects valid data
  | 'too_lenient'             // Rule accepts invalid data
  | 'missing_context_check'   // Context not considered
  | 'page_type_gap'           // Page type not handled
  | 'pattern_gap'             // Pattern not in validation
  | 'critical_entity_gap';    // Critical entity not flagged

// ============================================================================
// Pattern Detection Improvements
// ============================================================================

/**
 * Pattern detection improvement opportunity
 */
export interface PatternImprovement {
  /** Unique ID for tracking */
  id: string;

  /** Type of pattern */
  patternType: PatternType;

  /** Impact level */
  impact: 'high' | 'medium' | 'low';

  /** Entity types affected */
  entityTypes: string[];

  /** Description of the gap */
  issue: string;

  /** Pattern that should be detected */
  missingPattern: string;

  /** Example occurrences in data */
  examples: string[];

  /** File to modify */
  affectedFile: string;

  /** Implementation suggestion */
  implementation?: string;
}

/**
 * Types of patterns in the detector
 */
export type PatternType =
  | 'label_value'             // "Label: Value" patterns
  | 'table_header'            // Table header patterns
  | 'infobox'                 // Infobox patterns
  | 'definition_list'         // DL/DT/DD patterns
  | 'chapter_reference'       // Chapter link patterns
  | 'section_header'          // H1-H6 patterns
  | 'navigation_filter';      // Nav element filtering

// ============================================================================
// Implementation Tracking
// ============================================================================

/**
 * Track implementation status of optimizations
 */
export interface OptimizationStatus {
  /** Optimization ID */
  optimizationId: string;

  /** Current status */
  status: 'identified' | 'planned' | 'in_progress' | 'implemented' | 'verified' | 'rejected';

  /** Implementation PR/commit */
  implementationRef?: string;

  /** Verification results */
  verificationResults?: {
    beforeAccuracy: number;
    afterAccuracy: number;
    regressions: string[];
  };

  /** Notes */
  notes?: string;
}

// ============================================================================
// Current Implementation References
// ============================================================================

/**
 * Reference to current implementation for comparison
 */
export interface ImplementationRef {
  /** Component name */
  component: 'bootstrap' | 'agent_review' | 'pattern_detector';

  /** File path */
  filePath: string;

  /** Relevant function/class */
  functionName: string;

  /** Line number range */
  lineRange?: [number, number];

  /** Current behavior description */
  currentBehavior: string;
}

/**
 * Known implementation references for quick lookup
 */
export const IMPLEMENTATION_REFS: Record<string, ImplementationRef> = {
  // Bootstrap labeler
  BOOTSTRAP_MAIN: {
    component: 'bootstrap',
    filePath: 'src/server/ml/training/bootstrap-labeler/index.ts',
    functionName: 'generateLabels',
    currentBehavior: '7-phase pipeline: clean → linearize → positional → pattern → propagate → extract → label',
  },
  ENTITY_LABELERS: {
    component: 'bootstrap',
    filePath: 'src/server/ml/training/bootstrap-labeler/entity-labelers.ts',
    functionName: 'labelSingleValue/labelArrayValues',
    currentBehavior: 'Matches extracted values to tokens with fuzzy matching and confidence scoring',
  },
  PATTERN_DETECTOR: {
    component: 'pattern_detector',
    filePath: 'src/server/ml/training/bootstrap-labeler/pattern-detector/index.ts',
    functionName: 'detectAllPatterns',
    currentBehavior: 'Detects label:value, tables, infoboxes, definition lists, chapter refs, section headers',
  },
  LABEL_MAPPING: {
    component: 'pattern_detector',
    filePath: 'src/server/ml/training/bootstrap-labeler/pattern-detector/label-mapping.ts',
    functionName: 'mapLabelToEntityType',
    currentBehavior: 'Maps detected label text to entity types with confidence boosts',
  },

  // Agent review
  REVIEW_LOGIC: {
    component: 'agent_review',
    filePath: 'src/server/ml/training/agent-review/review-logic.ts',
    functionName: 'reviewPage',
    currentBehavior: 'Validates spans, checks missing entities, detects duplicates, generates corrections',
  },
  ENTITY_RULES: {
    component: 'agent_review',
    filePath: 'src/server/ml/training/agent-review/validation-rules/entity-rules.ts',
    functionName: 'TITLE_RULES/AUTHOR_RULES/etc',
    currentBehavior: 'Per-entity validation with min/max length, invalid patterns, context requirements',
  },
  IDENTIFIER_RULES: {
    component: 'agent_review',
    filePath: 'src/server/ml/training/agent-review/validation-rules/identifier-rules.ts',
    functionName: 'ISBN_RULES/VOLUME_NUMBER_RULES/etc',
    currentBehavior: 'ISBN format validation, numeric range checks for volume/chapter numbers',
  },
  VALIDATION_PATTERNS: {
    component: 'agent_review',
    filePath: 'src/server/ml/training/agent-review/validation-rules/patterns.ts',
    functionName: 'NAVIGATION_PATTERNS/PLACEHOLDER_PATTERNS/etc',
    currentBehavior: 'Regex patterns for detecting navigation, placeholders, character names, context labels',
  },
};
