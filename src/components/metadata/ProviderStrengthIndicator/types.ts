/**
 * Types for ProviderStrengthIndicator components
 *
 * @module components/metadata/ProviderStrengthIndicator/types
 */

/**
 * Size options for the indicator
 */
export type IndicatorSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Display mode options
 */
export type IndicatorMode = 'numeric' | 'stars' | 'badge' | 'minimal';

/**
 * Props for ProviderStrengthIndicator component
 */
export interface ProviderStrengthIndicatorProps {
  /**
   * Provider ID
   */
  providerId: string;
  /**
   * Field name
   */
  fieldName: string;
  /**
   * Strength value (0-5)
   */
  strength?: number;
  /**
   * Display mode
   */
  mode?: IndicatorMode;
  /**
   * Component size
   */
  size?: IndicatorSize;
  /**
   * Whether to show the provider name
   */
  showProviderName?: boolean;
  /**
   * Optional className
   */
  className?: string;
}

/**
 * Shared props for indicator sub-components
 */
export interface BaseIndicatorProps {
  /**
   * Computed strength value
   */
  strength: number;
  /**
   * Color for the indicator
   */
  color: string;
  /**
   * Size for display
   */
  size: IndicatorSize;
  /**
   * Provider display name
   */
  providerName: string;
  /**
   * Whether to show provider name
   */
  showProviderName: boolean;
  /**
   * Tooltip text
   */
  tooltipText: string;
  /**
   * Optional className (explicitly allows undefined for exactOptionalPropertyTypes)
   */
  className?: string | undefined;
}
