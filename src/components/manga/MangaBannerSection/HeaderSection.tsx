/**
 * HeaderSection Component
 *
 * Displays the manga title, monitoring controls, quick download button,
 * creator information (author, artist, publisher), and details expansion toggle.
 *
 * Extracted from: MangaBannerSection.tsx (lines 419-525)
 *
 * @module components/manga/MangaBannerSection/HeaderSection
 */

'use client';

import { ActionIcon, Badge, Group, Text, Title } from '@mantine/core';
import {
  IconBookmark,
  IconBookmarkOff,
  IconBuildingStore,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconPalette,
  IconRefresh,
  IconShieldX,
  IconUser
} from '@tabler/icons-react';

import type { MangaMetadata, MangaWithRelations } from './types';

/**
 * Props for the HeaderSection component
 */
export interface HeaderSectionProps {
  /** The manga data to display */
  manga: MangaWithRelations;
  /** Extracted metadata from the manga */
  extractedMetadata: MangaMetadata | null;
  /** Whether all chapters are monitored */
  allMonitored: boolean | null;
  /** Whether some chapters are monitored */
  someMonitored: boolean;
  /** Number of monitored chapters */
  monitoredCount: number;
  /** Total number of chapters */
  totalChapters: number;
  /** Whether details section is expanded */
  isDetailsExpanded: boolean;
  /** Handler to toggle details expansion */
  setIsDetailsExpanded: (expanded: boolean) => void;
  /** Mutation for toggling series monitoring */
  toggleSeriesMonitoringMutation: { isPending: boolean };
  /** Mutation for series quick download */
  seriesQuickDownloadMutation: { isPending: boolean };
  /** Mutation for the manga-wide "Reset all failed" action */
  resetAllFailedDownloadsMutation: { isPending: boolean };
  /** Mutation for the manga-wide "Clear blocklist" action */
  clearBlocklistForMangaMutation: { isPending: boolean };
  /** Handler for toggling manga bookmark */
  handleToggleMangaBookmark: () => void;
  /** Handler for series quick download */
  handleSeriesQuickDownload: () => void;
  /** Handler for the manga-wide "Reset all failed" action */
  handleResetAllFailed: () => void;
  /** Handler for the manga-wide "Clear blocklist" action */
  handleClearBlocklist: () => void;
  /** True when at least one chapter has downloadStatus === 'ERROR' — gates the icon's visibility */
  hasAnyFailedChapter: boolean;
  /** Count of active blocklist entries on this manga — gates "Clear blocklist" visibility */
  blocklistCount: number;
}

/**
 * HeaderSection displays the manga title with monitoring controls
 * and creator information with badges.
 *
 * Features:
 * - Monitoring toggle button with status indicators
 * - Quick download button for entire series
 * - Manga title display
 * - Author badges (from extracted metadata)
 * - Artist badges (from extracted metadata)
 * - Publisher badge (from extracted metadata)
 * - Details expansion toggle button
 */
/** Recovery-action icon group rendered after the Quick-Download icon. Pulled
 *  out of HeaderSection so the parent stays under the complexity cap when both
 *  conditional icons coexist. Each icon self-hides via its gate prop so the
 *  group renders nothing on a clean series. */
function RecoveryIcons({
  hasAnyFailedChapter,
  blocklistCount,
  handleResetAllFailed,
  handleClearBlocklist,
  resetAllFailedDownloadsMutation,
  clearBlocklistForMangaMutation,
}: {
  hasAnyFailedChapter: boolean;
  blocklistCount: number;
  handleResetAllFailed: () => void;
  handleClearBlocklist: () => void;
  resetAllFailedDownloadsMutation: { isPending: boolean };
  clearBlocklistForMangaMutation: { isPending: boolean };
}): React.ReactElement {
  return (
    <>
      {hasAnyFailedChapter && (
        <ActionIcon
          variant="subtle"
          color="orange"
          size="lg"
          title="Reset all failed chapters in this series and search every enabled source"
          style={{ marginBottom: '1rem' }}
          onClick={() => { handleResetAllFailed(); }}
          loading={resetAllFailedDownloadsMutation.isPending}
        >
          <IconRefresh size={24} />
        </ActionIcon>
      )}
      {blocklistCount > 0 && (
        <ActionIcon
          variant="subtle"
          color="red"
          size="lg"
          title={`Clear ${blocklistCount} blocklist entr${blocklistCount === 1 ? 'y' : 'ies'} so previously-blocked releases become eligible again`}
          style={{ marginBottom: '1rem' }}
          onClick={() => { handleClearBlocklist(); }}
          loading={clearBlocklistForMangaMutation.isPending}
        >
          <IconShieldX size={24} />
        </ActionIcon>
      )}
    </>
  );
}

export function HeaderSection({
  manga,
  extractedMetadata,
  allMonitored,
  someMonitored,
  monitoredCount,
  totalChapters,
  isDetailsExpanded,
  setIsDetailsExpanded,
  toggleSeriesMonitoringMutation,
  seriesQuickDownloadMutation,
  resetAllFailedDownloadsMutation,
  clearBlocklistForMangaMutation,
  handleToggleMangaBookmark,
  handleSeriesQuickDownload,
  handleResetAllFailed,
  handleClearBlocklist,
  hasAnyFailedChapter,
  blocklistCount
}: HeaderSectionProps): React.ReactElement {
  return (
    <Group justify="flex-start" w="100%" align="center" wrap="wrap">
      {/* Monitoring toggle button */}
      <ActionIcon
        variant="subtle"
        color={allMonitored ?? someMonitored ? 'white' : 'gray'}
        size="lg"
        title={
          allMonitored ?? someMonitored
            ? `Monitoring enabled (${monitoredCount}/${totalChapters}) - Click to disable all`
            : 'No chapters monitored - Click to enable monitoring for all chapters'
        }
        style={{ marginBottom: '1rem' }}
        onClick={() => {
          void handleToggleMangaBookmark();
        }}
        loading={toggleSeriesMonitoringMutation.isPending}
      >
        {allMonitored ?? someMonitored ? (
          <IconBookmark size={24} />
        ) : (
          <IconBookmarkOff size={24} />
        )}
      </ActionIcon>

      {/* Quick Download button for whole series */}
      <ActionIcon
        variant="subtle"
        color="blue"
        size="lg"
        title="Quick Download - Auto-search and download all volumes/chapters"
        style={{ marginBottom: '1rem' }}
        onClick={() => {
          void handleSeriesQuickDownload();
        }}
        loading={seriesQuickDownloadMutation.isPending}
      >
        <IconDownload size={24} />
      </ActionIcon>

      <RecoveryIcons
        hasAnyFailedChapter={hasAnyFailedChapter}
        blocklistCount={blocklistCount}
        handleResetAllFailed={handleResetAllFailed}
        handleClearBlocklist={handleClearBlocklist}
        resetAllFailedDownloadsMutation={resetAllFailedDownloadsMutation}
        clearBlocklistForMangaMutation={clearBlocklistForMangaMutation}
      />

      {/* Manga title */}
      <Title order={1} c="white" mb="md">
        {manga['title']}
      </Title>

      {/* Creator info group */}
      <Group gap="md" align="center">
        {/* Author Info */}
        {extractedMetadata?.authors && extractedMetadata.authors.length > 0 ? (
          <Group gap="xs">
            <IconUser size={18} color="white" />
            <Text size="sm" c="gray.3">
              Author:
            </Text>
            {extractedMetadata.authors.map((author, index) => (
              <a key={index} href={`/author/${encodeURIComponent(author)}`} style={{ textDecoration: 'none' }}>
                <Badge size="sm" variant="light" color="teal" style={{ cursor: 'pointer' }}>
                  {author}
                </Badge>
              </a>
            ))}
          </Group>
        ) : null}

        {/* Artist Info */}
        {extractedMetadata?.artists && extractedMetadata.artists.length > 0 ? (
          <Group gap="xs">
            <IconPalette size={18} color="white" />
            <Text size="sm" c="gray.3">
              Artist:
            </Text>
            {extractedMetadata.artists.map((artist, index) => (
              <Badge key={index} size="sm" variant="light" color="pink">
                {artist}
              </Badge>
            ))}
          </Group>
        ) : null}

        {/* Publisher Info */}
        {extractedMetadata?.publisher &&
        typeof extractedMetadata.publisher === 'string' ? (
          <Group gap="xs">
            <IconBuildingStore size={18} color="white" />
            <Text size="sm" c="gray.3">
              Publisher:
            </Text>
            <a href={`/publisher/${encodeURIComponent(extractedMetadata.publisher)}`} style={{ textDecoration: 'none' }}>
              <Badge size="sm" variant="light" color="grape" style={{ cursor: 'pointer' }}>
                {extractedMetadata.publisher}
              </Badge>
            </a>
          </Group>
        ) : null}

        {/* Details expansion toggle */}
        <ActionIcon
          variant="filled"
          color="blue"
          size="xl"
          onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
          title={isDetailsExpanded ? 'Hide Details' : 'Show More Details'}
          style={{
            transition: 'all 0.2s ease'
          }}
        >
          {isDetailsExpanded ? (
            <IconChevronUp size={24} />
          ) : (
            <IconChevronDown size={24} />
          )}
        </ActionIcon>
      </Group>
    </Group>
  );
}
