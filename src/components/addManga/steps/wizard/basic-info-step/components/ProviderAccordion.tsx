/**
 * ProviderAccordion Component
 *
 * Accordion container for all provider search results.
 * Manages accordion state and renders controls/panels for each provider.
 *
 * @module components/addManga/steps/wizard/basic-info-step/components
 */

import React from 'react';

import {
  Accordion,
  Text,
  Alert
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { DEFAULT_PROVIDERS } from '../types';

import { AccordionControl } from './AccordionControl';
import { ProviderResultsGrid } from './ProviderResultsGrid';

import type { ProviderSearchData } from '../types';

/**
 * Props for ProviderAccordion component
 */
export interface ProviderAccordionProps {
  /** Current primary provider to exclude */
  primaryProvider: string;
  /** Open accordion values */
  openAccordions: string[];
  /** Accordion change handler */
  onAccordionChange: (values: string[]) => void;
  /** Additional provider search data */
  additionalProviders: Record<string, ProviderSearchData>;
  /** Selected sources metadata */
  selectedSourcesMetadata: Record<string, unknown>;
  /** Show all results state by provider */
  showAllResults: Record<string, boolean>;
  /** Show all toggle handler */
  onShowAllToggle: (provider: string) => void;
  /** Loading results state by result key */
  loadingResults: Record<string, string>;
  /** Result selection handler */
  onSelectResult: (provider: string, result: unknown) => void;
  /** Current library ID for "already added" distinction */
  currentLibraryId?: number | undefined;
}

/**
 * ProviderAccordion Component
 *
 * Renders accordion for all providers with search results.
 * Skips primary provider and shows results for additional providers.
 */
export const ProviderAccordion: React.FC<ProviderAccordionProps> = ({
  primaryProvider,
  openAccordions,
  onAccordionChange,
  additionalProviders,
  selectedSourcesMetadata,
  showAllResults,
  onShowAllToggle,
  loadingResults,
  onSelectResult,
  currentLibraryId
}): React.ReactElement => {
  return (
    <Accordion
      multiple
      value={openAccordions}
      onChange={onAccordionChange}
      variant="separated"
    >
      {DEFAULT_PROVIDERS.map((providerName) => {
        // Skip primary provider
        if (providerName.toLowerCase() === primaryProvider.toLowerCase()) {
          return null;
        }

        const providerData = additionalProviders[providerName];
        const results = providerData?.results ?? [];
        const error = providerData?.error;
        const selectedResult = selectedSourcesMetadata[providerName];

        // Show provider item even if no results
        if (results.length === 0 && !error) {
          return (
            <Accordion.Item key={providerName} value={providerName}>
              <Accordion.Control>
                <AccordionControl
                  provider={providerName}
                  selectedResult={undefined}
                  resultCount={0}
                />
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="dimmed">
                  No results available. Use the search above to find matching manga.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          );
        }

        return (
          <Accordion.Item key={providerName} value={providerName}>
            <Accordion.Control>
              <AccordionControl
                provider={providerName}
                selectedResult={selectedResult}
                resultCount={results.length}
              />
            </Accordion.Control>
            <Accordion.Panel>
              {error ? (
                <Alert icon={<IconAlertCircle size={16} />} color="red">
                  Error: {(error as { message?: string }).message ?? 'Unknown error'}
                </Alert>
              ) : (
                <ProviderResultsGrid
                  results={results}
                  provider={providerName}
                  showAll={showAllResults[providerName] ?? false}
                  onShowAllToggle={() => onShowAllToggle(providerName)}
                  selectedResult={selectedResult}
                  loadingResults={loadingResults}
                  onSelectResult={(result) => onSelectResult(providerName, result)}
                  currentLibraryId={currentLibraryId}
                />
              )}
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
};

export default ProviderAccordion;
