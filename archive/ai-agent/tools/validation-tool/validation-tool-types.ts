/**
 * Validation Tool Types
 *
 * Type definitions for the validation tool.
 */

/**
 * Parameters for the validation tool
 */
export interface ValidationToolParams {
  /** Validation type to perform */
  validationType: 'provider_match' | 'chapter_title' | 'volume_map' | 'data_quality';
  /** Data to validate (depends on validationType) */
  data: unknown;
  /** Optional thresholds for validation */
  threshold?: number;
}