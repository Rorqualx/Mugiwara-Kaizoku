/**
 * ProviderStrengthIndicator Module
 *
 * Components and utilities for displaying provider strength indicators.
 *
 * @module components/metadata/ProviderStrengthIndicator
 */

// Main component
export { ProviderStrengthIndicator } from './ProviderStrengthIndicator';

// Sub-components
export { BadgeIndicator } from './BadgeIndicator';
export { MinimalIndicator } from './MinimalIndicator';
export { NumericIndicator } from './NumericIndicator';
export { StarsIndicator } from './StarsIndicator';

// Types
export type {
  BaseIndicatorProps,
  IndicatorMode,
  IndicatorSize,
  ProviderStrengthIndicatorProps
} from './types';

// Utilities
export {
  FIELD_DISPLAY_NAMES,
  getFieldDisplayName,
  getProviderDisplayName,
  getSizeInPx,
  getStarColor,
  getTooltipText,
  PROVIDER_DISPLAY_NAMES,
  SIZE_TO_PX
} from './utils';
