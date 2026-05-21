/**
 * Provider Strength Indicator Component
 *
 * This component displays a visual indicator of a provider's strength
 * for a specific metadata field type. It helps users understand which
 * providers are best for different types of metadata.
 *
 * Features:
 * - Color-coded strength indicators
 * - Numeric or star-based rating display
 * - Customizable size and style
 * - Tooltips with detailed explanations
 * - Accessibility support with ARIA attributes
 *
 * @module components/metadata/ProviderStrengthIndicator
 */

import React from 'react';

import {
  getProviderStrength,
  getStrengthColor,
  getStrengthDescription
} from '@/config/providerStrengths';

import { BadgeIndicator } from './BadgeIndicator';
import { MinimalIndicator } from './MinimalIndicator';
import { NumericIndicator } from './NumericIndicator';
import { StarsIndicator } from './StarsIndicator';
import { getProviderDisplayName, getTooltipText } from './utils';

import type { ProviderStrengthIndicatorProps } from './types';

/**
 * Displays a visual indicator of a provider's strength for a specific field
 */
export function ProviderStrengthIndicator({
  providerId,
  fieldName,
  strength,
  mode = 'numeric',
  size = 'sm',
  showProviderName = false,
  className
}: ProviderStrengthIndicatorProps): React.ReactElement {
  // If strength is not provided, fetch it from the provider strength data
  const actualStrength = strength ?? getProviderStrength(providerId, fieldName);

  // Get color based on strength
  const color = getStrengthColor(actualStrength);

  // Get provider display name
  const providerName = getProviderDisplayName(providerId);

  // Get tooltip text
  const tooltipText = getTooltipText(
    providerId,
    fieldName,
    actualStrength,
    getStrengthDescription
  );

  // Shared props for all indicator modes
  const sharedProps = {
    strength: actualStrength,
    color,
    size,
    providerName,
    showProviderName,
    tooltipText,
    className
  };

  // Render appropriate indicator based on mode
  switch (mode) {
    case 'stars':
      return <StarsIndicator {...sharedProps} />;
    case 'badge':
      return <BadgeIndicator {...sharedProps} />;
    case 'minimal':
      return <MinimalIndicator {...sharedProps} />;
    case 'numeric':
    default:
      return <NumericIndicator {...sharedProps} />;
  }
}
