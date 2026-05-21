/**
 * Search Results Grid Component
 * 
 * This component renders a grid of manga search results using the new domain types.
 * It handles different states (loading, error, empty, results) with discriminated unions
 * for type-safe props and state handling.
 */

'use client';

import * as React from 'react';
import type { ReactNode } from 'react';

import { Grid, Text, Center, Loader, Alert, Paper, Button, Stack } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconAlertCircle } from '@tabler/icons-react';
import { IconRefresh } from '@tabler/icons-react';
import { IconSearch } from '@tabler/icons-react';

import type { SearchResult } from '@/types/search.types';
import type {
  AsyncResult} from '@/utils/async-result';
import {
  isSuccess,
  isError,
  isLoading,
  isIdle} from '@/utils/async-result';

import { LegacySearchResultCard } from './SearchResultCard';

/**
 * Base props for all search grid states
 */
interface SearchResultsGridBaseProps {
  /** Callback for selecting a result */
  onSelectResult?: (result: SearchResult) => void;
  /** Currently selected result */
  selectedResult?: SearchResult | null;
  /** Callback for retrying a search */
  onRetry?: () => void;
  /** Optional callback for quick-add */
  onQuickAdd?: (result: SearchResult) => void;
  /** Whether quick-add is enabled */
  isQuickAddEnabled?: boolean;
}

/**
 * Props for the loading state
 */
interface SearchResultsGridLoadingProps extends SearchResultsGridBaseProps {
  /** Current state */
  state: 'loading';
  /** Optional loading message */
  message?: string;
}

/**
 * Props for the error state
 */
interface SearchResultsGridErrorProps extends SearchResultsGridBaseProps {
  /** Current state */
  state: 'error';
  /** Error message */
  error: string;
}

/**
 * Props for the empty state
 */
interface SearchResultsGridEmptyProps extends SearchResultsGridBaseProps {
  /** Current state */
  state: 'empty';
  /** Optional message for empty state */
  message?: string;
}

/**
 * Props for the results state
 */
interface SearchResultsGridResultsProps extends SearchResultsGridBaseProps {
  /** Current state */
  state: 'results';
  /** Search results */
  results: SearchResult[];
}

/**
 * Combined props with discriminated union for type safety
 */
export type SearchResultsGridProps =
SearchResultsGridLoadingProps |
SearchResultsGridErrorProps |
SearchResultsGridEmptyProps |
SearchResultsGridResultsProps;

/**
 * Alternate props using AsyncResult pattern directly
 */
export interface SearchResultsGridAsyncProps {
  /** Search results status */
  searchStatus: AsyncResult<SearchResult[], Error>;
  /** Callback for selecting a result */
  onSelectResult?: (result: SearchResult) => void;
  /** Currently selected result */
  selectedResult?: SearchResult | null;
  /** Callback for retrying a search */
  onRetry?: () => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state message */
  loadingMessage?: string;
  /** Optional callback for quick-add */
  onQuickAdd?: (result: SearchResult) => void;
  /** Whether quick-add is enabled */
  isQuickAddEnabled?: boolean;
}

/**
 * Props for the LoadingState component
 */
interface LoadingStateProps {
  /** Optional loading message */
  message?: string;
}

/**
 * Renders a loading state
 */
function LoadingState({ message = 'Searching...' }: LoadingStateProps): ReactNode {
  return (
    <Center style={{ height: 200 }}>
      <Stack align="center" gap="md">
        <Loader size="lg" />
        <Text color="dimmed" ta="center">
          {message}
        </Text>
      </Stack>
    </Center>);

}

/**
 * Props for the ErrorState component
 */
interface ErrorStateProps {
  /** Error message to display */
  error: string;
  /** Optional callback for retry button */
  onRetry?: () => void;
}

/**
 * Renders an error state
 */
function ErrorState({ error, onRetry }: ErrorStateProps): ReactNode {
  return (
    <Alert
      icon={<IconAlertCircle size={16} />}
      title="Search Error"
      color="red"
      variant="filled"
      withCloseButton={false}>

      <Stack gap="md">
        <Text>{error}</Text>
        {onRetry &&
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="white"
          color="red"
          onClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
            e.preventDefault();
            onRetry();
          }}
          size="xs">

            Retry Search
          </Button>
        }
      </Stack>
    </Alert>);

}

/**
 * Props for the EmptyState component
 */
interface EmptyStateProps {
  /** Optional message to display */
  message?: string;
  /** Optional callback for retry button */
  onRetry?: () => void;
}

/**
 * Renders an empty state
 */
function EmptyState({
  message = 'No results found. Try a different search query or select another provider.',
  onRetry
}: EmptyStateProps): ReactNode {
  return (
    <Paper p="xl" withBorder>
      <Stack align="center" gap="md" style={{ height: 200 }} justify="center">
        <IconSearch size={48} opacity={0.3} />
        <Text color="dimmed" ta="center" size="sm">
          {message}
        </Text>
        {onRetry &&
        <Button
          variant="light"
          onClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
            e.preventDefault();
            onRetry();
          }}
          leftSection={<IconRefresh size={16} />}>

            Try Again
          </Button>
        }
      </Stack>
    </Paper>);

}

/**
 * Props for the ResultsGrid component
 */
interface ResultsGridProps {
  /** Search results to display */
  results: SearchResult[];
  /** Callback for selecting a result */
  onSelectResult?: (result: SearchResult) => void;
  /** Currently selected result */
  selectedResult?: SearchResult | null;
  /** Optional callback for quick-add */
  onQuickAdd?: (result: SearchResult) => void;
  /** Whether quick-add is enabled */
  isQuickAddEnabled?: boolean;
}

/**
 * Renders a results grid
 */
function ResultsGrid({
  results,
  onSelectResult,
  selectedResult,
  onQuickAdd,
  isQuickAddEnabled
}: ResultsGridProps): ReactNode {
  return (
    <Grid>
      {results.map((result) =>
      <Grid.Col key={`${result.provider}-${result["id"]}`} span={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          {/* Use LegacySearchResultCard for backward compatibility during migration */}
          <LegacySearchResultCard
          result={result}
          {...(onSelectResult && { onSelect: onSelectResult })}
          isSelected={selectedResult?.id === result["id"] &&
          selectedResult.provider === result.provider}
          {...(onQuickAdd && { onQuickAdd })}
          {...(isQuickAddEnabled !== undefined && { isQuickAddEnabled })} />

        </Grid.Col>
      )}
    </Grid>);

}

/**
 * Search results grid component with discriminated union props
 * 
 * Displays a grid of manga search results with loading, error, and empty states
 * handled through a discriminated union for type safety.
 * 
 * @param props - Component props with discriminated union
 * @returns The rendered search results display
 * 
 * @example
 * ```tsx
 * // Loading state
 * <SearchResultsGrid state="loading" />
 * 
 * // Error state
 * <SearchResultsGrid 
 *   state="error" 
 *   error="Failed to fetch results" 
 *   onRetry={() => refetch()}
 * />
 * 
 * // Empty state
 * <SearchResultsGrid 
 *   state="empty" 
 *   message="No manga found for your search"
 * />
 * 
 * // Results state
 * <SearchResultsGrid 
 *   state="results" 
 *   results={searchResults}
 *   onSelectResult={handleSelect}
 *   selectedResult={selectedManga}
 * />
 * ```
 */
export function SearchResultsGrid(props: SearchResultsGridProps): ReactNode {
  // Use discriminated union for type-safe rendering
  switch (props.state) {
    case 'loading':
      return <LoadingState {...(props.message && { message: props.message })} />;

    case 'error':
      return <ErrorState error={props.error} {...(props.onRetry && { onRetry: props.onRetry })} />;

    case 'empty':
      return <EmptyState {...(props.message && { message: props.message })} {...(props.onRetry && { onRetry: props.onRetry })} />;

    case 'results':
      return (
        <ResultsGrid
          results={props.results}
          {...(props.onSelectResult && { onSelectResult: props.onSelectResult })}
          {...(props.selectedResult !== undefined && { selectedResult: props.selectedResult })}
          {...(props.onQuickAdd && { onQuickAdd: props.onQuickAdd })}
          {...(props.isQuickAddEnabled !== undefined && { isQuickAddEnabled: props.isQuickAddEnabled })} />);

    default:
      return null;
  }
}

/**
 * Search results grid component that uses AsyncResult pattern directly
 * 
 * An alternative implementation that directly accepts an AsyncResult object
 * representing the search operation state.
 * 
 * @param props - Component props with AsyncResult
 * @returns The rendered search results display
 * 
 * @example
 * ```tsx
 * // Using with AsyncResult
 * <SearchResultsGridAsync
 *   searchStatus={searchStatus}
 *   onSelectResult={handleSelect}
 *   selectedResult={selectedManga}
 *   onRetry={handleRetry}
 * />
 * ```
 */
export function SearchResultsGridAsync({
  searchStatus,
  onSelectResult,
  selectedResult,
  onRetry,
  emptyMessage,
  loadingMessage,
  onQuickAdd,
  isQuickAddEnabled
}: SearchResultsGridAsyncProps): ReactNode {
  // Handle different AsyncResult states
  if (isIdle(searchStatus) || isLoading(searchStatus)) {
    return <LoadingState {...(loadingMessage && { message: loadingMessage })} />;
  }

  if (isError(searchStatus)) {
    return (
      <ErrorState
        error={searchStatus.error instanceof Error ? searchStatus.error.message : String(searchStatus.error)}
        {...(onRetry && { onRetry })} />);

  }

  if (isSuccess(searchStatus)) {
    // Handle empty results
    if (searchStatus.data.length === 0) {
      return <EmptyState {...(emptyMessage && { message: emptyMessage })} {...(onRetry && { onRetry })} />;
    }

    // Render results
    return (
      <ResultsGrid
        results={searchStatus.data}
        {...(onSelectResult && { onSelectResult })}
        {...(selectedResult !== undefined && { selectedResult })}
        {...(onQuickAdd && { onQuickAdd })}
        {...(isQuickAddEnabled !== undefined && { isQuickAddEnabled })} />);

  }

  // This should never happen if we've handled all states
  return <ErrorState error="Unknown state" {...(onRetry && { onRetry })} />;
}