/**
 * TokenSuggestionBadge - Small indicator for tokens with label suggestions
 *
 * Displays a small colored indicator on tokens that have pending label suggestions,
 * showing the suggested entity type and confidence level on hover.
 */

import React from 'react';

import { Badge, Box, Indicator, Tooltip } from '@mantine/core';

import { isEntityType } from '@/server/ml/features/bio-types';

import { ENTITY_COLORS } from '../types';

import type { Suggestion } from './SuggestionPanel';

// ============================================================================
// Types
// ============================================================================

export interface TokenSuggestionBadgeProps {
  suggestion: Suggestion | null;
  children: React.ReactNode;
  onAccept?: (() => void) | undefined;
  onReject?: (() => void) | undefined;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEntityColor(entityType: string): string {
  return isEntityType(entityType) ? ENTITY_COLORS[entityType] : 'gray';
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function getIndicatorColor(confidence: number): string {
  if (confidence >= 0.9) return 'var(--mantine-color-green-6)';
  if (confidence >= 0.7) return 'var(--mantine-color-blue-6)';
  if (confidence >= 0.5) return 'var(--mantine-color-yellow-6)';
  return 'var(--mantine-color-orange-6)';
}

// ============================================================================
// Main Component
// ============================================================================

export function TokenSuggestionBadge({
  suggestion,
  children,
  onAccept,
  onReject,
}: TokenSuggestionBadgeProps): React.ReactElement {
  if (!suggestion) {
    return <>{children}</>;
  }

  const entityColor = getEntityColor(suggestion.entityType);
  const indicatorColor = getIndicatorColor(suggestion.confidence);

  const tooltipContent = (
    <Box>
      <Badge size="xs" color={entityColor} mb={4}>
        {suggestion.entityType}
      </Badge>
      <Box>
        Confidence: {formatConfidence(suggestion.confidence)}
      </Box>
      <Box style={{ fontSize: '0.75rem', opacity: 0.8 }}>
        {suggestion.reasoning}
      </Box>
      {(onAccept ?? onReject) && (
        <Box mt={8} style={{ fontSize: '0.7rem' }}>
          Click to accept / Right-click to reject
        </Box>
      )}
    </Box>
  );

  return (
    <Tooltip label={tooltipContent} multiline maw={300}>
      <Indicator
        inline
        size={8}
        offset={4}
        position="top-end"
        color={indicatorColor}
        processing={suggestion.confidence >= 0.9}
        style={{ cursor: onAccept ? 'pointer' : undefined }}
        onClick={onAccept}
        onContextMenu={(e) => {
          if (onReject) {
            e.preventDefault();
            onReject();
          }
        }}
      >
        {children}
      </Indicator>
    </Tooltip>
  );
}

// ============================================================================
// Utility: Get suggestion for a specific token index
// ============================================================================

export function getSuggestionForToken(
  tokenIndex: number,
  suggestions: Suggestion[]
): Suggestion | null {
  return suggestions.find(s => s.tokenIndices.includes(tokenIndex)) ?? null;
}
