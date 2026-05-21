/**
 * MetadataPreview Component
 *
 * Displays a comprehensive preview of manga metadata with
 * cover image, details grid, and description.
 *
 * Refactored to reduce cyclomatic complexity by decomposing
 * into focused sub-components.
 */

import React, { memo, useMemo } from 'react';

import {
  Paper,
  Stack,
  Divider,
  Collapse,
  Button,
  ScrollArea
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp
} from '@tabler/icons-react';

import { createMetadataSections, hasExtendedMetadata, hasExternalLinksMetadata } from './metadata-preview-utils';
import { MetadataPreviewCompact } from './MetadataPreviewCompact';
import { MetadataPreviewExternalLinks } from './MetadataPreviewExternalLinks';
import { MetadataPreviewHeader } from './MetadataPreviewHeader';
import { MetadataPreviewSections } from './MetadataPreviewSections';

interface MetadataPreviewProps {
  /** Manga metadata to display */
  metadata: {
    title: string;
    alternativeTitles?: string[];
    description?: string;
    cover?: string;
    coverLarge?: string;
    bannerImage?: string;
    status?: string;
    format?: string;
    authors?: string[];
    artists?: string[];
    genres?: string[];
    tags?: string[];
    themes?: string[];
    startDate?: string;
    endDate?: string;
    releaseYear?: number;
    chapters?: number;
    volumes?: number;
    averageScore?: number;
    popularity?: number;
    anilistId?: number;
    myAnimeListId?: number;
    urls?: string[];
  };
  /** Source provider information */
  sourceProvider?: string;
  /** Overall confidence score */
  confidence?: number;
  /** Whether to show extended metadata */
  showExtended?: boolean;
  /** Whether to show the cover image */
  showCover?: boolean;
  /** Whether to show provider badges */
  showProviders?: boolean;
  /** Maximum height for scrollable content */
  maxHeight?: number;
  /** Compact display mode */
  compact?: boolean;
}

/**
 * Main metadata preview component with toggle between compact and full views
 *
 * @returns JSX.Element
 */
export const MetadataPreview = memo(function MetadataPreview({
  metadata,
  sourceProvider,
  confidence,
  showExtended = true,
  showCover = true,
  showProviders = true,
  maxHeight,
  compact = false
}: MetadataPreviewProps): JSX.Element {
  const [showDetails, setShowDetails] = React.useState(!compact);

  const hasExtendedInfo = hasExtendedMetadata(metadata) || Boolean(metadata.bannerImage || metadata.urls?.length);
  const hasExternalLinks = hasExternalLinksMetadata(metadata);

  // Group metadata into sections using extracted helper
  const sections = useMemo(
    () => createMetadataSections(metadata),
    [metadata]
  );

  // Return compact view early
  if (compact) {
    return (
      <MetadataPreviewCompact
        metadata={metadata}
        sourceProvider={sourceProvider}
        confidence={confidence}
        showCover={showCover}
        showProviders={showProviders}
      />
    );
  }

  // Full view content
  const content = (
    <Stack gap="md">
      {/* Header with cover and title */}
      <MetadataPreviewHeader
        metadata={metadata}
        confidence={confidence}
        showCover={showCover}
        showExtended={showExtended}
        showProviders={showProviders}
        sourceProvider={sourceProvider}
        showDetails={showDetails}
      />

      <Divider />

      {/* Metadata sections */}
      <Collapse in={showDetails}>
        <MetadataPreviewSections sections={sections} />
      </Collapse>

      {/* External IDs and URLs */}
      {showExtended && showDetails && hasExternalLinks && (
        <>
          <Divider />
          <MetadataPreviewExternalLinks metadata={metadata} />
        </>
      )}

      {/* Toggle button */}
      {hasExtendedInfo && (
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setShowDetails(!showDetails)}
          rightSection={showDetails ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        >
          {showDetails ? 'Show Less' : 'Show More'}
        </Button>
      )}
    </Stack>
  );

  return (
    <Paper p="md" withBorder>
      {maxHeight ? (
        <ScrollArea h={maxHeight} type="auto">
          {content}
        </ScrollArea>
      ) : (
        content
      )}
    </Paper>
  );
});