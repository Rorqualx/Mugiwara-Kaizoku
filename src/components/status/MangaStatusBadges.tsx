/**
 * Manga Status Badges Component
 * 
 * Displays the three different status types as separate badges
 * with appropriate colors and labels
 */

import React from 'react';

import { Badge, Group, Tooltip } from '@mantine/core';
import { MangaPublicationStatus, MangaFileStatus, MangaLibraryStatus } from '@prisma/client';
import {
  IconBook,
  IconDownload,
  IconBookmark,
  IconClock,
  IconPlayerPause,
  IconRefresh,
  IconCheck,
  IconX
} from '@tabler/icons-react';

interface MangaStatusBadgesProps {
  publicationStatus?: MangaPublicationStatus | string | null;
  fileStatus?: MangaFileStatus | string | null;
  libraryStatus?: MangaLibraryStatus | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showIcons?: boolean;
  vertical?: boolean;
  compact?: boolean;
}

/**
 * Get icon for publication status
 */
function getPublicationIcon(status: string): React.ReactNode {
  switch (status) {
    case MangaPublicationStatus.ONGOING:
      return <IconRefresh size={14} />;
    case MangaPublicationStatus.COMPLETED:
      return <IconCheck size={14} />;
    case MangaPublicationStatus.CANCELLED:
      return <IconX size={14} />;
    case MangaPublicationStatus.HIATUS:
      return <IconPlayerPause size={14} />;
    default:
      return <IconBook size={14} />;
  }
}

/**
 * Get icon for file status
 */
function getFileIcon(status: string): React.ReactNode {
  switch (status) {
    case MangaFileStatus.DOWNLOADING:
      return <IconDownload size={14} className="animate-pulse" />;
    case MangaFileStatus.COMPLETED:
      return <IconCheck size={14} />;
    case MangaFileStatus.FAILED:
      return <IconX size={14} />;
    case MangaFileStatus.PENDING:
      return <IconClock size={14} className="animate-spin" />;
    default:
      return <IconDownload size={14} />;
  }
}

/**
 * Get icon for library status
 */
function getLibraryIcon(status: string): React.ReactNode {
  switch (status) {
    case MangaLibraryStatus.READING:
      return <IconBook size={14} className="animate-pulse" />;
    case MangaLibraryStatus.COMPLETED:
      return <IconCheck size={14} />;
    case MangaLibraryStatus.DROPPED:
      return <IconX size={14} />;
    case MangaLibraryStatus.ON_HOLD:
      return <IconPlayerPause size={14} />;
    case MangaLibraryStatus.PLAN_TO_READ:
      return <IconClock size={14} />;
    default:
      return <IconBookmark size={14} />;
  }
}

/**
 * Get color for publication status
 */
function getPublicationColor(status: string): string {
  switch (status) {
    case MangaPublicationStatus.ONGOING:
      return 'blue';
    case MangaPublicationStatus.COMPLETED:
      return 'green';
    case MangaPublicationStatus.CANCELLED:
      return 'red';
    case MangaPublicationStatus.HIATUS:
      return 'yellow';
    default:
      return 'gray';
  }
}

/**
 * Get color for file status
 */
function getFileColor(status: string): string {
  switch (status) {
    case MangaFileStatus.DOWNLOADING:
      return 'blue';
    case MangaFileStatus.COMPLETED:
      return 'green';
    case MangaFileStatus.FAILED:
      return 'red';
    case MangaFileStatus.PENDING:
      return 'yellow';
    default:
      return 'gray';
  }
}

/**
 * Get color for library status
 */
function getLibraryColor(status: string): string {
  switch (status) {
    case MangaLibraryStatus.READING:
      return 'blue';
    case MangaLibraryStatus.COMPLETED:
      return 'green';
    case MangaLibraryStatus.DROPPED:
      return 'red';
    case MangaLibraryStatus.ON_HOLD:
      return 'yellow';
    case MangaLibraryStatus.PLAN_TO_READ:
      return 'purple';
    default:
      return 'gray';
  }
}

/**
 * Format status label
 * For publication status, displays "Finished" instead of "Completed"
 */
function formatStatusLabel(status: string, type?: 'publication' | 'file' | 'library'): string {
  // For publication status, show "Finished" instead of "Completed"
  if (type === 'publication' && (status === MangaPublicationStatus.COMPLETED || status.toUpperCase() === 'COMPLETED')) {
    return 'Finished';
  }
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Manga Status Badges Component
 */
export function MangaStatusBadges({
  publicationStatus,
  fileStatus,
  libraryStatus,
  size = 'sm',
  showIcons = true,
  vertical = false,
  compact = false,
}: MangaStatusBadgesProps): JSX.Element | null {
  const badges = [];
  // Publication status badge
  if (publicationStatus) {
    const label = compact ? 'Pub' : 'Publication';
    const status = formatStatusLabel(publicationStatus, 'publication');
    badges.push(
      <Tooltip key="publication" label={`${label}: ${status}`}>
        <Badge
          size={size}
          color={getPublicationColor(publicationStatus)}
          variant="light"
          leftSection={showIcons ? getPublicationIcon(publicationStatus) : undefined}
        >
          {compact ? status : `${label}: ${status}`}
        </Badge>
      </Tooltip>
    );
  }

  // File status badge
  if (fileStatus) {
    const label = compact ? 'File' : 'File';
    const status = formatStatusLabel(fileStatus, 'file');
    badges.push(
      <Tooltip key="file" label={`${label}: ${status}`}>
        <Badge
          size={size}
          color={getFileColor(fileStatus)}
          variant="light"
          leftSection={showIcons ? getFileIcon(fileStatus) : undefined}
        >
          {compact ? status : `${label}: ${status}`}
        </Badge>
      </Tooltip>
    );
  }

  // Library status badge
  if (libraryStatus) {
    const label = compact ? 'Lib' : 'Library';
    const status = formatStatusLabel(libraryStatus, 'library');
    badges.push(
      <Tooltip key="library" label={`${label}: ${status}`}>
        <Badge
          size={size}
          color={getLibraryColor(libraryStatus)}
          variant="light"
          leftSection={showIcons ? getLibraryIcon(libraryStatus) : undefined}
        >
          {compact ? status : `${label}: ${status}`}
        </Badge>
      </Tooltip>
    );
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <Group gap="xs" align="center" wrap={vertical ? 'wrap' : 'nowrap'}>
      {badges}
    </Group>
  );
}

/**
 * Single status badge for backward compatibility
 */
interface StatusBadgeProps {
  status?: string | null;
  type?: 'publication' | 'file' | 'library';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showIcon?: boolean;
}

export function StatusBadge({
  status,
  type = 'publication',
  size = 'sm',
  showIcon = true,
}: StatusBadgeProps): JSX.Element | null {
  if (!status) return null;
  let color: string;
  let icon: React.ReactNode | undefined;
  switch (type) {
    case 'publication':
      color = getPublicationColor(status);
      icon = showIcon ? getPublicationIcon(status) : undefined;
      break;
    case 'file':
      color = getFileColor(status);
      icon = showIcon ? getFileIcon(status) : undefined;
      break;
    case 'library':
      color = getLibraryColor(status);
      icon = showIcon ? getLibraryIcon(status) : undefined;
      break;
    default:
      color = 'gray';
  }

  return (
    <Badge
      size={size}
      color={color}
      variant="light"
      leftSection={icon}
    >
      {formatStatusLabel(status, type)}
    </Badge>
  );
}
