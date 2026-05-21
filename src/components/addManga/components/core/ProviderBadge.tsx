/**
 * ProviderBadge Component
 * 
 * A reusable badge component for displaying metadata provider information
 * with consistent color coding and optional confidence scores.
 */

import React, { memo } from 'react';

import { Badge, Group, Text, Tooltip } from '@mantine/core';

import { PROVIDER_COLORS, CONFIDENCE_THRESHOLDS } from '@/components/addManga/types';

interface ProviderBadgeProps {
  /** The provider name to display */
  provider: string;
  /** Optional confidence score (0-100) */
  confidence?: number;
  /** Whether to show the confidence score */
  showConfidence?: boolean;
  /** Badge size */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Badge variant */
  variant?: 'filled' | 'light' | 'outline' | 'dot';
  /** Additional CSS class */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Get the color for a provider badge
 */
function getProviderColor(provider: string): string {
  const lowerProvider = provider.toLowerCase();

  // Check for exact matches first
  const exactMatch = PROVIDER_COLORS[lowerProvider];
  if (exactMatch) {
    return exactMatch;
  }
  
  // Check for partial matches
  for (const [key, color] of Object.entries(PROVIDER_COLORS)) {
    if (lowerProvider.includes(key) || key.includes(lowerProvider)) {
      return color;
    }
  }

  return PROVIDER_COLORS["default"] ?? 'gray';
}

/**
 * Get the quality level based on confidence score
 */
function getConfidenceLevel(score: number): keyof typeof CONFIDENCE_THRESHOLDS {
  if (score >= CONFIDENCE_THRESHOLDS.excellent) return 'excellent';
  if (score >= CONFIDENCE_THRESHOLDS.good) return 'good';
  if (score >= CONFIDENCE_THRESHOLDS.fair) return 'fair';
  return 'poor';
}

/**
 * Get color for confidence score
 */
function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score);
  switch (level) {
    case 'excellent':
      return 'green';
    case 'good':
      return 'yellow';
    case 'fair':
      return 'orange';
    case 'poor':
      return 'red';
    default:
      return 'gray';
  }
}

export const ProviderBadge = memo(function ProviderBadge({
  provider,
  confidence,
  showConfidence = false,
  size = 'sm',
  variant = 'filled',
  className,
  onClick
}: ProviderBadgeProps) {
  const color = getProviderColor(provider);
  const formattedProvider = provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
  
  // Simple badge without confidence
  if (!showConfidence || confidence === undefined) {
    return (
      <Badge
        color={color}
        size={size}
        variant={variant}
        {...(className !== undefined && { className })}
        {...(onClick !== undefined && { onClick })}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        {formattedProvider}
      </Badge>
    );
  }
  
  // Badge with confidence score
  const confidenceLevel = getConfidenceLevel(confidence);
  const confidenceColor = getConfidenceColor(confidence);
  
  return (
    <Tooltip
      label={
        <div>
          <Text size="xs" fw={500}>{formattedProvider}</Text>
          <Text size="xs" c="dimmed">Confidence: {confidence}%</Text>
          <Text size="xs" c="dimmed">Quality: {confidenceLevel}</Text>
        </div>
      }
      withArrow
    >
      <Group gap={4} {...(className !== undefined && { className })}>
        <Badge
          color={color}
          size={size}
          variant={variant}
          {...(onClick !== undefined && { onClick })}
          style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
          {formattedProvider}
        </Badge>
        <Badge
          color={confidenceColor}
          size={size}
          variant="outline"
        >
          {confidence}%
        </Badge>
      </Group>
    </Tooltip>
  );
});

// Export a compound component for advanced use cases
export const ProviderBadgeGroup = memo(function ProviderBadgeGroup({
  providers,
  showConfidence = false,
  size = 'sm'
}: {
  providers: Array<{ name: string; confidence?: number }>;
  showConfidence?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  return (
    <Group gap="xs">
      {providers.map((provider, index) => (
        <ProviderBadge
          key={`${provider["name"]}-${index}`}
          provider={provider["name"]}
          {...(provider.confidence !== undefined && { confidence: provider.confidence })}
          showConfidence={showConfidence}
          size={size}
        />
      ))}
    </Group>
  );
});