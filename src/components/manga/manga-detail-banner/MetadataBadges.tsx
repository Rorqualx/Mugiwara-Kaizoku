/**
 * MetadataBadges Component
 *
 * Displays metadata badges including:
 * - Source badge
 * - Refresh metadata button
 * - Conflict indicator
 * - Status badge with provider info
 * - Volume/Chapter counts with provider info
 * - Start date with provider info
 *
 * Extracted from: MangaDetailBanner.tsx (lines 198-303)
 *
 * @module components/manga/manga-detail-banner/MetadataBadges
 */

import * as React from 'react';

import { Badge, Group, Text, Tooltip } from '@mantine/core';
import { MangaPublicationStatus as MangaStatus } from '@prisma/client';
import { IconAlertCircle, IconBook, IconCalendar } from '@tabler/icons-react';

import { formatDate, getProvenance, countVolumes } from '@/components/manga/mangaDetailUtils';
import { ProviderBadge } from '@/components/metadata/ProviderBadge';
import { ProviderStrengthIndicator } from '@/components/metadata/ProviderStrengthIndicator';
import { RefreshMetadataButton } from '@/components/metadata/RefreshMetadataButton';
import { isSuccess } from '@/utils/async-result';
import { getMetadataNumber, getMetadataDate } from '@/utils/entityMetadataUtils';



import type { MetadataBadgesProps } from './types';

/**
 * Get color for status badge based on publication status
 *
 * @param status - The manga publication status
 * @returns Color string for the badge
 */
function getStatusColor(status: MangaStatus): string {
  switch (status) {
    case MangaStatus.COMPLETED:
      return 'green';
    case MangaStatus.ONGOING:
      return 'blue';
    case MangaStatus.HIATUS:
      return 'yellow';
    case MangaStatus.CANCELLED:
      return 'red';
    case MangaStatus.UPCOMING:
      return 'purple';
    case MangaStatus.NOT_YET_PUBLISHED:
      return 'violet';
    default:
      return 'gray';
  }
}

/**
 * MetadataBadges Component
 *
 * Renders all metadata badges with provider information.
 */
export function MetadataBadges({
  manga,
  mangaIdNum,
  formattedStatus,
  conflictsState,
  conflictsCount,
  setIsConflictModalOpen,
  handleConflictsResolved
}: MetadataBadgesProps): React.ReactElement {
  return (
    <Group gap="md" mb="lg">
      <Badge color="blue" size="lg">
        {manga.source}
      </Badge>

      {/* Refresh metadata button */}
      <RefreshMetadataButton
        mangaId={mangaIdNum}
        onRefreshComplete={handleConflictsResolved}
        variant="light"
      />

      {/* Conflict indicator */}
      {isSuccess(conflictsState) && conflictsCount > 0 && (
        <Tooltip
          label={`${conflictsCount} metadata conflicts detected`}
          position="top"
          withArrow={true}>
          <Badge
            color="orange"
            size="lg"
            leftSection={<IconAlertCircle size={14} />}
            style={{ cursor: 'pointer' }}
            onClick={() => setIsConflictModalOpen(true)}>
            {conflictsCount} Conflicts
          </Badge>
        </Tooltip>
      )}

      <Group gap={4}>
        <Badge color={getStatusColor(formattedStatus)} size="lg">
          {formattedStatus}
        </Badge>
        {getProvenance(manga, 'status') && (
          <>
            <ProviderBadge providerId={getProvenance(manga, 'status') ?? ''} size="xs" />
            <ProviderStrengthIndicator
              providerId={getProvenance(manga, 'status') ?? ''}
              fieldName="status"
              mode="minimal"
              size="xs"
            />
          </>
        )}
      </Group>

      <Group gap={4}>
        <Group gap="xs">
          <IconBook size={18} />
          <Text c="white">
            {getMetadataNumber(manga, 'volumes', countVolumes(manga.Chapter))} Volumes,{' '}
            {getMetadataNumber(manga, 'chapters', manga.Chapter.length)} Chapters
          </Text>
        </Group>
        {(getProvenance(manga, 'volumes') ?? getProvenance(manga, 'chapters')) && (
          <>
            <ProviderBadge
              providerId={
                getProvenance(manga, 'volumes') ?? getProvenance(manga, 'chapters') ?? ''
              }
              size="xs"
              tooltipContent="Provider for volumes/chapters count"
            />
            <ProviderStrengthIndicator
              providerId={
                getProvenance(manga, 'volumes') ?? getProvenance(manga, 'chapters') ?? ''
              }
              fieldName={getProvenance(manga, 'volumes') ? 'volumes' : 'chapters'}
              mode="minimal"
              size="xs"
            />
          </>
        )}
      </Group>

      {getMetadataDate(manga, 'startDate') && (
        <Group gap={4}>
          <Group gap="xs">
            <IconCalendar size={18} />
            <Text c="white">{formatDate(getMetadataDate(manga, 'startDate'))}</Text>
          </Group>
          {getProvenance(manga, 'startDate') && (
            <>
              <ProviderBadge providerId={getProvenance(manga, 'startDate') ?? ''} size="xs" />
              <ProviderStrengthIndicator
                providerId={getProvenance(manga, 'startDate') ?? ''}
                fieldName="startDate"
                mode="minimal"
                size="xs"
              />
            </>
          )}
        </Group>
      )}
    </Group>
  );
}
