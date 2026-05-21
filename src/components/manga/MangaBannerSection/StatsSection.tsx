/**
 * StatsSection Component
 *
 * Displays manga statistics including volume/chapter counts, status badges,
 * popularity, scores, format, country of origin, and series path.
 *
 * Extracted from: MangaBannerSection.tsx (lines 528-692)
 *
 * @module components/manga/MangaBannerSection/StatsSection
 */

import React from 'react';

import { Box, Group, Text, Badge } from '@mantine/core';
import { MangaPublicationStatus } from '@prisma/client';
import {
  IconBooks,
  IconCalendar,
  IconTrophy
} from '@tabler/icons-react';

import { countVolumes } from '@/components/manga/mangaDetailUtils';


import { SeriesPathEditor } from './SeriesPathEditor';

import type { MangaMetadata, MangaWithRelations } from './types';

/**
 * Props for StatsSection component
 */
interface StatsSectionProps {
  /** The manga data to display */
  manga: MangaWithRelations;
  /** Extracted metadata from the manga */
  extractedMetadata: MangaMetadata | null;
  /** Whether details section is expanded */
  isDetailsExpanded: boolean;
}

/**
 * Get color for status badge based on publication status
 */
function getStatusColor(status: MangaPublicationStatus | undefined | null): string {
  switch (status) {
    case MangaPublicationStatus.COMPLETED:
      return 'green';
    case MangaPublicationStatus.ONGOING:
      return 'blue';
    case MangaPublicationStatus.HIATUS:
      return 'yellow';
    case MangaPublicationStatus.CANCELLED:
      return 'red';
    case MangaPublicationStatus.UPCOMING:
      return 'purple';
    case MangaPublicationStatus.NOT_YET_PUBLISHED:
      return 'violet';
    default:
      return 'gray';
  }
}

/**
 * Get display label for publication status
 */
function getStatusLabel(status: MangaPublicationStatus | undefined | null): string {
  switch (status) {
    case MangaPublicationStatus.ONGOING:
      return 'Ongoing';
    case MangaPublicationStatus.COMPLETED:
      return 'Completed';
    case MangaPublicationStatus.CANCELLED:
      return 'Cancelled';
    case MangaPublicationStatus.HIATUS:
      return 'Hiatus';
    case MangaPublicationStatus.UPCOMING:
      return 'Upcoming';
    case MangaPublicationStatus.NOT_YET_PUBLISHED:
      return 'Not Yet Published';
    default:
      return 'Unknown';
  }
}

/**
 * Volume / chapter counts reflect the ACTUAL state of the library —
 * what rows exist in the DB — not what a provider's metadata claims.
 *
 * Volume count comes from the loaded Volume rows when available
 * (`manga.Volume.length`), else falls back to distinct positive
 * `chapter.volume` values via countVolumes. Provider claims like
 * `Metadata.volumes` are explicitly NOT consulted here — stale claims
 * (e.g. Frieren had Metadata.volumes=0 long after ComicVine added 14
 * volume rows) would otherwise lie about reality.
 *
 * Chapter count is `manga.Chapter.length`. The `chapterLimit=0` trpc
 * call returns all chapters, so the array length is the true count.
 */
function getVolumeCount(manga: MangaWithRelations): number {
  // manga.Volume comes back from the trpc procedure via createMangaRelationsSlim,
  // but MangaWithRelations doesn't yet declare it — read safely.
  const volumes = (manga as MangaWithRelations & { Volume?: unknown[] }).Volume;
  if (Array.isArray(volumes)) return volumes.length;
  return countVolumes(manga.Chapter);
}

function getChapterCount(manga: MangaWithRelations): number {
  return manga.Chapter.length;
}

/**
 * StatsSection Component
 *
 * Renders manga statistics including counts, badges, and path information.
 */
// eslint-disable-next-line complexity -- UI component with many conditional renders based on data availability
export function StatsSection({
  manga,
  extractedMetadata,
  isDetailsExpanded
}: StatsSectionProps): React.ReactElement {
  const volumeCount = getVolumeCount(manga);
  const chapterCount = getChapterCount(manga);

  // Count locally available volumes from actual chapters
  const localVolumeCount = countVolumes(manga.Chapter);

  return (
    <>
      {/* Volume/Chapter Count, Popularity, Year */}
      <Box mt="xs" mb="md">
        <Group gap="md" wrap="wrap">
          <Group gap="xs">
            <IconBooks size={18} color="white" />
            <Text size="md" fw={500} c="gray.2">
              {volumeCount} Volumes, {chapterCount} Chapters
            </Text>
          </Group>

          {/* Downloaded count badge - show when local count differs from metadata total */}
          {localVolumeCount > 0 && localVolumeCount < volumeCount && (
            <Badge color="blue" size="lg" variant="filled">
              {localVolumeCount} Downloaded
            </Badge>
          )}

          {(() => {
            const startDate =
              extractedMetadata?.startDate ?? manga.Metadata?.startDate;
            if (!startDate) return null;
            const dateValue =
              startDate instanceof Date
                ? startDate
                : new Date(String(startDate));
            return (
              <Group gap="xs">
                <IconCalendar size={18} color="white" />
                <Text size="md" fw={500} c="gray.2">
                  {dateValue.getFullYear()}
                </Text>
              </Group>
            );
          })() as React.ReactElement | null}

          {/* Volume / Chapter Count Badges — actual counts from the DB,
              same source of truth as the inline header counter above. */}
          {volumeCount > 0 && (
            <Badge color="indigo" size="lg" variant="light">
              {volumeCount} Volumes
            </Badge>
          )}

          {chapterCount > 0 && (
            <Badge color="cyan" size="lg" variant="light">
              {chapterCount} Chapters
            </Badge>
          )}

          {/* Status Badge - Use metadata status if available */}
          <Badge
            size="lg"
            color={getStatusColor(manga.Metadata?.status)}
            variant="filled"
          >
            {getStatusLabel(manga.Metadata?.status)}
          </Badge>

          {manga.Metadata?.popularity ? (
            <Group gap="xs">
              <IconTrophy size={18} color="gold" />
              <Text size="md" fw={500} c="gray.2">
                {manga.Metadata.popularity > 1000
                  ? `${(manga.Metadata.popularity / 1000).toFixed(1)}k users`
                  : `${manga.Metadata.popularity} users`}
              </Text>
            </Group>
          ) : null}

          {manga.Metadata?.averageScore ? (
            <Badge
              color="yellow"
              size="lg"
              variant="filled"
              leftSection="*"
            >
              {(manga.Metadata.averageScore / 10).toFixed(1)}/10
            </Badge>
          ) : null}

          {manga.Metadata?.format ? (
            <Badge color="grape" size="lg" variant="light">
              {manga.Metadata.format}
            </Badge>
          ) : null}

          {manga.Metadata?.countryOfOrigin && (
            <Badge color="teal" size="lg" variant="light">
              {manga.Metadata.countryOfOrigin}
            </Badge>
          )}

          {manga.Metadata?.language && (
            <Badge color="gray" size="lg" variant="light">
              {manga.Metadata.language}
            </Badge>
          )}
        </Group>
      </Box>

      {/* Series Path - Show when expanded */}
      {isDetailsExpanded && manga.libraryPath && typeof manga.libraryPath === 'string' && (
        <SeriesPathEditor mangaId={manga.id} libraryPath={manga.libraryPath} />
      )}
    </>
  );
}

export type { StatsSectionProps };
