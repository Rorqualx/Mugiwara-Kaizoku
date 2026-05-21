/**
 * Metadata Panel Component
 *
 * Component for displaying manga metadata with refresh functionality.
 * Decomposed into focused sub-components for better maintainability.
 *
 * @module MetadataPanel
 */

import React from "react";

import { Stack } from '@mantine/core';

import { AuthorField } from './AuthorField';
import { MetadataHeader } from './MetadataHeader';
import { RefreshButton } from './RefreshButton';
import { StatusField } from './StatusField';
import { SummaryField } from './SummaryField';

import type { MetadataPanelProps } from './types';

/**
 * Displays manga metadata with a refresh button
 *
 * Features:
 * - Responsive metadata display
 * - Refresh functionality with loading state
 * - Graceful handling of missing data
 * - Provenance tracking with provider badges
 * - Accessible button states
 *
 * @param props - Component properties
 * @returns A Stack component containing manga metadata and refresh button
 */
export function MetadataPanel({ manga, isLoading = false, onRefresh }: MetadataPanelProps): React.ReactNode {
  // Extract provenance info for clarity
  const provenance = 'metadataProvenance' in manga ? manga.metadataProvenance : undefined;

  // Extract metadata with proper type narrowing
  const metadata = 'metadata' in manga ? manga.metadata : undefined;

  return (
    <Stack>
      <Stack gap="xs">
        <MetadataHeader title={manga.title} />
        <AuthorField metadata={metadata} provenance={provenance} />
        <StatusField metadata={metadata} provenance={provenance} />
        <SummaryField metadata={metadata} provenance={provenance} />
      </Stack>

      <RefreshButton isLoading={isLoading} onRefresh={onRefresh} />
    </Stack>
  );
}
