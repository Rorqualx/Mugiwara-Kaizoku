/**
 * ProviderResultsGrid Component
 *
 * Grid of search results with "show more" functionality and deduplication.
 * Manages display of results with selection state tracking.
 * Includes "already added" detection with library distinction.
 *
 * @module components/addManga/steps/wizard/basic-info-step/components
 */

import React from 'react';

import {
  Stack,
  SimpleGrid,
  Button
} from '@mantine/core';

import { isRecord } from '@/lib/type-guards';

import { useAlreadyAddedCheck } from '../hooks/useAlreadyAddedCheck';
import { getStringProp } from '../utils';

import { CompactResultCard } from './CompactResultCard';

/**
 * Props for ProviderResultsGrid component
 */
export interface ProviderResultsGridProps {
  /** Array of search results */
  results: unknown[];
  /** Provider name */
  provider: string;
  /** Whether to show all results or limit to MAX_VISIBLE */
  showAll: boolean;
  /** Toggle show all handler */
  onShowAllToggle: () => void;
  /** Selected result metadata */
  selectedResult?: unknown;
  /** Loading states by result key */
  loadingResults: Record<string, string>;
  /** Result selection handler */
  onSelectResult: (result: unknown) => void;
  /** Current library ID for "already added" distinction */
  currentLibraryId?: number | undefined;
}

/** Maximum visible results before "show more" button */
const MAX_VISIBLE = 6;

/**
 * ProviderResultsGrid Component
 *
 * Displays search results in a grid with deduplication and pagination.
 * Shows limited results by default with option to expand.
 */
export const ProviderResultsGrid: React.FC<ProviderResultsGridProps> = ({
  results,
  provider,
  showAll,
  onShowAllToggle,
  selectedResult,
  loadingResults,
  onSelectResult,
  currentLibraryId
}): React.ReactElement => {
  const visibleResults = showAll ? results : results.slice(0, MAX_VISIBLE);
  const hasMore = results.length > MAX_VISIBLE;

  // Deduplicate results by normalized title
  const seenTitles = new Set<string>();
  const dedupedResults = visibleResults.filter((result: unknown) => {
    if (!isRecord(result)) return false;
    const titleValue = getStringProp(result, 'title') ?? '';
    const normalizedTitle = titleValue.toLowerCase().trim().replace(/\s+/g, ' ');
    if (seenTitles.has(normalizedTitle)) return false;
    seenTitles.add(normalizedTitle);
    return true;
  });

  // Prepare results for already added check
  const resultsForCheck = dedupedResults.map((result) => {
    if (!isRecord(result)) return { id: '', provider: '' };
    return {
      id: getStringProp(result, 'id') ?? getStringProp(result, 'sourceId') ?? '',
      provider
    };
  });

  // Check if results are already added to library
  const { alreadyAddedMap } = useAlreadyAddedCheck({
    results: resultsForCheck,
    currentLibraryId,
    enabled: resultsForCheck.length > 0
  });

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {dedupedResults.map((result, index) => {
          if (!isRecord(result)) return null;

          const resultId = getStringProp(result, 'id') ?? getStringProp(result, 'sourceId') ?? '';
          const selectedResultRec = isRecord(selectedResult) ? selectedResult : undefined;

          // Check if this result is selected
          // Explicitly check for both null AND undefined to prevent false positives
          // when both IDs are undefined (which would otherwise match)
          const resultPropId = result['id'];
          const selectedPropId = selectedResultRec?.['id'];
          const hasMatchingId = resultPropId !== null &&
                                resultPropId !== undefined &&
                                selectedPropId !== null &&
                                selectedPropId !== undefined &&
                                resultPropId === selectedPropId;

          const resultSourceId = result['sourceId'];
          const selectedSourceId = selectedResultRec?.['sourceId'];
          const hasMatchingSourceId = resultSourceId !== null &&
                                      resultSourceId !== undefined &&
                                      selectedSourceId !== null &&
                                      selectedSourceId !== undefined &&
                                      resultSourceId === selectedSourceId;
          const isSelected = hasMatchingId || hasMatchingSourceId;

          const isLoading = !!loadingResults[`${provider}-${resultId}`];

          // Get already added status
          const alreadyAddedStatus = alreadyAddedMap.get(`${provider}-${resultId}`);

          return (
            <CompactResultCard
              key={`${provider}-${index}`}
              result={result}
              provider={provider}
              isSelected={isSelected}
              isLoading={isLoading}
              onSelect={() => onSelectResult(result)}
              index={index}
              inCurrentLibrary={alreadyAddedStatus?.inCurrentLibrary}
              inOtherLibrary={alreadyAddedStatus?.inOtherLibrary}
              libraryName={alreadyAddedStatus?.libraryName}
              existingMangaId={alreadyAddedStatus?.existingMangaId}
            />
          );
        })}
      </SimpleGrid>

      {hasMore && !showAll && (
        <Button
          variant="subtle"
          size="xs"
          onClick={onShowAllToggle}
          fullWidth
        >
          Show {results.length - MAX_VISIBLE} more results
        </Button>
      )}
    </Stack>
  );
};

export default ProviderResultsGrid;
