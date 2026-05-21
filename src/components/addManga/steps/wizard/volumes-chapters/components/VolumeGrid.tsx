/**
 * VolumeGrid Component
 *
 * Displays volumes in a selectable grid with cover images, titles,
 * descriptions, chapter counts, and provider attribution.
 *
 * Enhanced to show merged volume data from multiple providers:
 * - Cover images with source attribution
 * - ISBN/ISBN-13 with copy functionality
 * - Release dates in readable format
 * - Provider badges showing data sources
 *
 * @fileoverview This file contains VolumeGrid and all related subcomponents
 * (VolumeCard, VolumeCoverImage, VolumeInfoBadges, VolumeExpandedDetails),
 * helper functions for data extraction, and the VolumeDetailsDrawer integration.
 * Keeping these cohesive components together improves maintainability and
 * reduces import complexity across the codebase.
 */

import React, { useState } from 'react';

import {
  Grid,
  Paper,
  Stack,
  Checkbox,
  Image,
  Text,
  Badge,
  ScrollArea,
  Group,
  Tooltip,
  ActionIcon,
  Collapse,
} from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconCalendar, IconBook, IconInfoCircle } from '@tabler/icons-react';

import { isRecord } from '../index';
import {
  extractChapterNumber,
  getChaptersInRange,
  calculateCumulativeRanges,
  detectFirstChapterNumber,
} from '../utils/cross-provider-selection';
import {
  getVolumeNumber,
  isGenericTitle,
  getChapterCount,
  getReleaseDate,
  getPageCount,
  getPublisher,
  areChaptersEqual,
  getChapterIdentifiers,
  toVolumeDetails,
  extractVolumeFields,
} from '../utils/volume-helpers';

import { ProviderAttributionBadge } from './ProviderAttributionBadge';
import { VolumeDetailsDrawer, type VolumeDetails, type VolumeFieldSources } from './VolumeDetailsDrawer';

import type { Logger } from '../index';


// Types
interface VolumeGridProps {
  /** Array of volume objects to display */
  displayVolumes: unknown[];
  /** Currently selected volume numbers */
  selectedVolumes: (number | string)[];
  /** Setter for selected volumes state */
  setSelectedVolumes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  /** Currently selected chapter identifiers (URLs) */
  selectedChapters?: unknown[];
  /** Setter for selected chapters state */
  setSelectedChapters?: React.Dispatch<React.SetStateAction<unknown[]>>;
  /** Logger instance for debugging */
  logger: Logger;
  /** Whether to show extended volume details */
  showDetails?: boolean;
  /** Whether to show provider attribution badges */
  showProviderBadges?: boolean;
  /** Field-level source preferences (optional) */
  volumeFieldSources?: VolumeFieldSources;
  /** Metadata from all selected sources (optional) */
  selectedSourcesMetadata?: Record<string, unknown>;
  /** User-selected sources (only these should be searched) */
  selectedSources?: string[];
  /** All chapter URLs from the chapter display source (for cross-provider sync) */
  allChapterUrls?: unknown[];
}

// ============================================================================
// VolumeCard Sub-Components
// ============================================================================

/** Cover image (badge moved to info row) */
const VolumeCoverImage: React.FC<{
  coverImageUrl: string;
  title: string | null;
  volumeNumber: number | string;
}> = ({ coverImageUrl, title, volumeNumber }) => (
  <Image
    src={coverImageUrl}
    alt={title ?? `Volume ${String(volumeNumber)}`}
    height={150}
    fit="contain"
    radius="sm"
    fallbackSrc="/cover-not-found.jpg"
  />
);

/** Info badges for chapter count, release date, and provider */
const VolumeInfoBadges: React.FC<{
  chapterCount: number | null;
  releaseDate: string | null;
  source: string | null;
  showProviderBadges: boolean;
}> = ({ chapterCount, releaseDate, source, showProviderBadges }) => (
  <Group gap={4}>
    {chapterCount !== null && (
      <Badge size="xs" variant="light" leftSection={<IconBook size={10} />}>
        {chapterCount} ch
      </Badge>
    )}
    {releaseDate && (
      <Tooltip label={`Release date: ${releaseDate}`} withArrow>
        <Badge size="xs" variant="light" color="gray" leftSection={<IconCalendar size={10} />}>
          {releaseDate.split(',')[0]}
        </Badge>
      </Tooltip>
    )}
    {showProviderBadges && source && (
      <ProviderAttributionBadge field="coverImage" provider={source} size="xs" showFieldLabel={false} />
    )}
  </Group>
);

/** Expandable details section */
const VolumeExpandedDetails: React.FC<{
  isExpanded: boolean;
  descriptionText: string | null;
  publisher: string | null;
  pageCount: number | null;
  source: string | null;
  showProviderBadges: boolean;
}> = ({ isExpanded, descriptionText, publisher, pageCount, source, showProviderBadges }) => (
  <Collapse in={isExpanded}>
    <Stack gap="xs" pt="xs">
      {descriptionText && (
        <Text size="xs" c="dimmed" lineClamp={5}>
          {descriptionText}
        </Text>
      )}
      {(publisher ?? pageCount) && (
        <Group gap="xs">
          {publisher && <Text size="xs" c="dimmed">Publisher: {publisher}</Text>}
          {pageCount && <Text size="xs" c="dimmed">{pageCount} pages</Text>}
        </Group>
      )}
      {showProviderBadges && source && (
        <ProviderAttributionBadge field="volume" provider={source} size="xs" />
      )}
    </Stack>
  </Collapse>
);

// ============================================================================
// VolumeCard Main Component
// ============================================================================

interface VolumeCardProps {
  volume: Record<string, unknown>;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
  onViewDetails: () => void;
  showDetails: boolean;
  showProviderBadges: boolean;
  logger: Logger;
  /** Field-level source preferences (optional) */
  volumeFieldSources?: VolumeFieldSources | undefined;
  /** Metadata from all selected sources (optional) */
  selectedSourcesMetadata?: Record<string, unknown> | undefined;
  /** User-selected sources (only these should be searched) */
  selectedSources?: string[] | undefined;
}

const VolumeCard: React.FC<VolumeCardProps> = React.memo(function VolumeCard({
  volume,
  index,
  isSelected,
  onToggle,
  onViewDetails,
  showDetails,
  showProviderBadges,
  logger,
  volumeFieldSources,
  selectedSourcesMetadata,
  selectedSources: _selectedSources = [],
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract base volume data
  const volumeNumber = getVolumeNumber(volume, index);
  const chapterCount = getChapterCount(volume);
  const releaseDate = getReleaseDate(volume);
  const pageCount = getPageCount(volume);
  const publisher = getPublisher(volume);

  // Extract fields using per-source lookups (STRICT - no fallback)
  const {
    coverImageUrl,
    coverSource: source,
    descriptionText,
    summarySource,
    title,
    titleSource,
  } = extractVolumeFields(volume, volumeNumber, volumeFieldSources, selectedSourcesMetadata);

  // Debug: Log first volume's data with field sources
  if (index === 0) {
    logger.info('[VolumeGrid] First volume in display:', {
      volumeNumber, title, hasDescription: !!descriptionText, hasCover: !!coverImageUrl,
      releaseDate, coverSource: source, summarySource, titleSource,
      fieldSources: volumeFieldSources ? {
        cover: volumeFieldSources.volumeCover,
        summary: volumeFieldSources.volumeSummary,
        title: volumeFieldSources.volumeTitle,
      } : 'none',
      allKeys: Object.keys(volume)
    });
  }

  const handleExpandToggle = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleViewDetails = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onViewDetails();
  };

  const displayTitle = isGenericTitle(title, volumeNumber) ? `Volume ${String(volumeNumber)}` : title;
  const hasExpandableContent = descriptionText ?? releaseDate;

  return (
    <Paper
      p="sm"
      bg={isSelected ? "blue.9" : "dark.8"}
      style={{ cursor: 'pointer', border: isSelected ? '2px solid var(--mantine-color-blue-6)' : '2px solid transparent' }}
      onClick={onToggle}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Checkbox
            checked={isSelected}
            onChange={() => {}}
            label={displayTitle}
            styles={{ input: { cursor: 'pointer' }, label: { cursor: 'pointer' } }}
          />
          <Group gap={4}>
            <Tooltip label="View full details" withArrow>
              <ActionIcon variant="subtle" size="xs" onClick={handleViewDetails} aria-label="View volume details">
                <IconInfoCircle size={14} />
              </ActionIcon>
            </Tooltip>
            {showDetails && hasExpandableContent && (
              <ActionIcon variant="subtle" size="xs" onClick={handleExpandToggle} aria-label={isExpanded ? 'Collapse details' : 'Expand details'}>
                {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              </ActionIcon>
            )}
          </Group>
        </Group>

        {coverImageUrl && (
          <VolumeCoverImage
            coverImageUrl={coverImageUrl}
            title={title}
            volumeNumber={volumeNumber}
          />
        )}

        <VolumeInfoBadges
          chapterCount={chapterCount}
          releaseDate={releaseDate}
          source={source}
          showProviderBadges={showProviderBadges}
        />

        {/* Short summary preview (replaces ISBN which moved to Step 2) */}
        {descriptionText && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {descriptionText}
          </Text>
        )}

        <VolumeExpandedDetails
          isExpanded={isExpanded}
          descriptionText={descriptionText}
          publisher={publisher}
          pageCount={pageCount}
          source={source}
          showProviderBadges={showProviderBadges}
        />
      </Stack>
    </Paper>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * VolumeGrid displays volumes in a responsive selectable grid
 *
 * Features:
 * - Clickable cards with selection state
 * - Cover images with provider attribution
 * - ISBN display with copy functionality
 * - Release dates and chapter counts
 * - Expandable details section
 * - Provider badges showing data sources
 * - Details drawer for full volume information
 */
export const VolumeGrid: React.FC<VolumeGridProps> = React.memo(function VolumeGrid({
  displayVolumes,
  selectedVolumes,
  setSelectedVolumes,
  selectedChapters: _selectedChapters = [],
  setSelectedChapters,
  logger,
  showDetails = true,
  showProviderBadges = true,
  volumeFieldSources,
  selectedSourcesMetadata,
  selectedSources = [],
  allChapterUrls = [],
}): JSX.Element {
  // Drawer state for viewing full volume details
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVolumeForDrawer, setSelectedVolumeForDrawer] = useState<VolumeDetails | null>(null);
  const [selectedVolumeNumber, setSelectedVolumeNumber] = useState<number | string | null>(null);

  const handleViewDetails = (volume: Record<string, unknown>, index: number): void => {
    const volNum = getVolumeNumber(volume, index);
    setSelectedVolumeForDrawer(toVolumeDetails(volume, index));
    setSelectedVolumeNumber(volNum);
    setDrawerOpen(true);
  };

  // Detect the first chapter number from allChapterUrls (handles manga starting at 0 like Fire Force)
  const firstChapterNumber = React.useMemo(
    () => detectFirstChapterNumber(allChapterUrls),
    [allChapterUrls]
  );

  // Pre-calculate cumulative chapter ranges for all volumes
  const cumulativeRanges = React.useMemo(
    () => calculateCumulativeRanges(displayVolumes, firstChapterNumber),
    [displayVolumes, firstChapterNumber]
  );

  // Debug log once when ranges are calculated
  React.useEffect(() => {
    if (cumulativeRanges.size > 0 || allChapterUrls.length > 0) {
      const firstChapter = allChapterUrls[0];
      const lastChapter = allChapterUrls[allChapterUrls.length - 1];
      // Sample a few chapter numbers to see the pattern
      const sampleNumbers: (number | null)[] = [];
      for (let i = 0; i < Math.min(5, allChapterUrls.length); i++) {
        const ch = allChapterUrls[i];
        if (isRecord(ch)) {
          sampleNumbers.push(extractChapterNumber(ch));
        }
      }
      logger.info('[VolumeGrid] Cross-provider debug info', {
        totalVolumes: cumulativeRanges.size,
        detectedFirstChapterNumber: firstChapterNumber,
        volume1Range: cumulativeRanges.get(1),
        volume2Range: cumulativeRanges.get(2),
        volume34Range: cumulativeRanges.get(34),
        allChapterUrlsLength: allChapterUrls.length,
        firstChapterType: typeof firstChapter,
        firstChapterIsRecord: isRecord(firstChapter),
        firstChapterKeys: isRecord(firstChapter) ? Object.keys(firstChapter).slice(0, 10) : 'N/A',
        extractedFirstChapterNum: isRecord(firstChapter) ? extractChapterNumber(firstChapter) : undefined,
        lastChapterNumber: isRecord(lastChapter) ? extractChapterNumber(lastChapter) : undefined,
        sampleChapterNumbers: sampleNumbers,
      });
    }
  }, [cumulativeRanges, allChapterUrls, firstChapterNumber, logger]);

  return (
    <>
      <ScrollArea h={400}>
        <Grid>
          {displayVolumes.map((volume: unknown, index: number) => {
            if (!isRecord(volume)) return null;

            const volumeNumber = getVolumeNumber(volume, index);
            const isSelected = selectedVolumes.includes(volumeNumber);

            // Get chapters to toggle using pre-calculated cumulative ranges
            const chapterRange = cumulativeRanges.get(volumeNumber) ?? null;
            let volumeChapterIds: unknown[] = [];

            if (allChapterUrls.length > 0 && chapterRange) {
              volumeChapterIds = getChaptersInRange(allChapterUrls, chapterRange);
            }

            // Fallback: use chapters from the volume itself
            if (volumeChapterIds.length === 0) {
              volumeChapterIds = getChapterIdentifiers(volume);
            }

            const handleToggle = (): void => {
              // Log toggle action for debugging cross-provider selection
              logger.info('[VolumeGrid] Toggle volume', {
                volumeNumber,
                isSelected,
                chapterRange,
                volumeChapterIdsCount: volumeChapterIds.length,
                allChapterUrlsLength: allChapterUrls.length,
                firstVolumeChapterId: volumeChapterIds[0],
              });

              if (isSelected) {
                // Deselect volume
                setSelectedVolumes(prev => prev.filter(v => v !== volumeNumber));
                // Also deselect all chapters from this volume
                if (setSelectedChapters && volumeChapterIds.length > 0) {
                  setSelectedChapters(prev => prev.filter(selectedCh =>
                    // Keep chapters that don't match any of this volume's chapters
                    !volumeChapterIds.some(volCh => areChaptersEqual(selectedCh, volCh))
                  ));
                }
              } else {
                // Select volume
                setSelectedVolumes(prev => [...prev, volumeNumber]);
                // Also select all chapters from this volume
                if (setSelectedChapters && volumeChapterIds.length > 0) {
                  setSelectedChapters(prev => {
                    // Filter out chapters that are already selected
                    const newChapters = volumeChapterIds.filter(volCh =>
                      !prev.some(selectedCh => areChaptersEqual(selectedCh, volCh))
                    );
                    return [...prev, ...newChapters];
                  });
                }
              }
            };

            return (
              <Grid.Col key={`volume-${String(volumeNumber)}`} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                <VolumeCard
                  volume={volume}
                  index={index}
                  isSelected={isSelected}
                  onToggle={handleToggle}
                  onViewDetails={() => handleViewDetails(volume, index)}
                  showDetails={showDetails}
                  showProviderBadges={showProviderBadges}
                  logger={logger}
                  volumeFieldSources={volumeFieldSources}
                  selectedSourcesMetadata={selectedSourcesMetadata}
                  selectedSources={selectedSources}
                />
              </Grid.Col>
            );
          })}
        </Grid>
      </ScrollArea>

      {/* Volume Details Drawer */}
      <VolumeDetailsDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        volume={selectedVolumeForDrawer}
        showProviderBadges={showProviderBadges}
        volumeFieldSources={volumeFieldSources}
        selectedSourcesMetadata={selectedSourcesMetadata}
        volumeNumber={selectedVolumeNumber ?? undefined}
        selectedSources={selectedSources}
      />
    </>
  );
});

export default VolumeGrid;
