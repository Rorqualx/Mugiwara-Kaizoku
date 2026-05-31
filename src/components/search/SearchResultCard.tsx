/**
 * Search Result Card Component
 *
 * This component renders a manga search result as a card with proper type safety
 * using the domain types system, AsyncResult pattern, and discriminated unions
 * for different provider types.
 */

'use client';

import * as React from 'react';

import { Card, Stack } from '@mantine/core';

import { MangaCover } from '@/components/manga/MangaCover';
import type { SearchResult } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  isError,
  isLoading,
  isIdle,
  unwrapOr
} from '@/utils/async-result';

// Import modular components
import {
  CardHeader,
  CardMetadata,
  CardContent,
  CardActions,
  LoadingCard,
  ErrorCard,
  getExternalLinkSafe,
  getCoverUrl
} from './search-result-card';

/**
 * Props for the SearchResultCard component
 */
export interface SearchResultCardProps {
  /** The search result to display as an AsyncResult */
  resultStatus: AsyncResult<SearchResult, Error>;
  /** Optional callback for when the result is selected */
  onSelect?: (result: SearchResult) => void;
  /** Whether this result is currently selected */
  isSelected?: boolean;
  /** Whether to show the external link button */
  showExternalLink?: boolean;
  /** Additional class name for the card */
  className?: string;
  /** Optional callback for quick-add */
  onQuickAdd?: (result: SearchResult) => void;
  /** Whether quick-add is enabled */
  isQuickAddEnabled?: boolean;
}

/**
 * Props for the legacy SearchResultCard component
 * @deprecated Use SearchResultCard with resultStatus instead
 */
export interface LegacySearchResultCardProps {
  /** The search result to display */
  result: SearchResult;
  /** Optional callback for when the result is selected */
  onSelect?: (result: SearchResult) => void;
  /** Whether this result is currently selected */
  isSelected?: boolean;
  /** Whether to show the external link button */
  showExternalLink?: boolean;
  /** Additional class name for the card */
  className?: string;
  /** Optional callback for quick-add */
  onQuickAdd?: (result: SearchResult) => void;
  /** Whether quick-add is enabled */
  isQuickAddEnabled?: boolean;
}

/**
 * Search result card component
 *
 * Displays a manga search result with cover image, title, and metadata.
 * Uses AsyncResult pattern to handle loading/error states.
 *
 * @param props - Component props
 * @returns React element
 */
export function SearchResultCard({
  resultStatus,
  onSelect,
  isSelected = false,
  showExternalLink = true,
  className = '',
  onQuickAdd,
  isQuickAddEnabled = false
}: SearchResultCardProps): React.ReactNode {
  // Handle loading state
  if (isLoading(resultStatus) || isIdle(resultStatus)) {
    return <LoadingCard className={className} />;
  }

  // Handle error state
  if (isError(resultStatus)) {
    return <ErrorCard error={resultStatus.error} className={className} />;
  }

  // If we reach here, we know it's a success state
  const result = resultStatus.data;

  // Get cover image URL with fallback
  const coverUrl = getCoverUrl(result);

  // Get external link if available with AsyncResult pattern
  const externalLinkResult = showExternalLink
    ? getExternalLinkSafe(result)
    : createSuccessResult<string | null, Error>(null);
  const externalLink = unwrapOr(externalLinkResult, null);

  return (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      className={className}
      style={{
        opacity: isSelected ? 0.7 : 1,
        border: isSelected ? '2px solid #228be6' : undefined,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Card.Section>
        <MangaCover
          src={coverUrl}
          h={200}
          alt={result.title}
          seed={result.title}
        />
      </Card.Section>

      <Stack mt="md" style={{ flex: 1 }}>
        <CardHeader result={result} />
        <CardMetadata result={result} />
        <CardContent result={result} />
        <CardActions
          result={result}
          onSelect={onSelect}
          isSelected={isSelected}
          onQuickAdd={onQuickAdd}
          isQuickAddEnabled={isQuickAddEnabled}
          showExternalLink={showExternalLink}
          externalLink={externalLink}
        />
      </Stack>
    </Card>
  );
}

/**
 * Backward compatibility wrapper for SearchResultCard
 * Accepts a raw SearchResult and converts it to AsyncResult
 * 
 * @param props - Legacy component props
 * @returns React element
 * @deprecated Use SearchResultCard with resultStatus instead
 */
export function LegacySearchResultCard({
  result,
  ...props
}: LegacySearchResultCardProps): React.ReactNode {
  // Use explicit generic type parameters for better type safety
  const resultStatus = createSuccessResult<SearchResult, Error>(result);

  // Pass through to the new component
  return <SearchResultCard resultStatus={resultStatus} {...props} />;
}