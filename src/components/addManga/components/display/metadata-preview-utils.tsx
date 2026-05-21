/**
 * Utility functions for MetadataPreview component
 *
 * Contains pure formatting and color mapping functions
 * used across metadata preview components.
 */

import React from 'react';

import {
  IconBook,
  IconUser,
  IconCalendar,
  IconTags,
  IconWorld
} from '@tabler/icons-react';

interface MetadataField {
  label: string;
  value: unknown;
  badge?: boolean;
  color?: string;
}

interface MetadataSection {
  title: string;
  icon: React.ReactNode;
  fields: MetadataField[];
}

interface MetadataInput {
  title: string;
  alternativeTitles?: string[];
  status?: string;
  format?: string;
  releaseYear?: number;
  authors?: string[];
  artists?: string[];
  startDate?: string;
  endDate?: string;
  chapters?: number;
  volumes?: number;
  genres?: string[];
  tags?: string[];
  themes?: string[];
  averageScore?: number;
  popularity?: number;
}

/**
 * Format date for display
 *
 * @param dateStr - ISO date string or undefined
 * @returns Formatted date string or 'Unknown'
 */
export function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Unknown';

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get status badge color based on manga status
 *
 * @param status - Manga status string
 * @returns Mantine color name
 */
export function getStatusColor(status?: string): string {
  const statusColors: Record<string, string> = {
    'ONGOING': 'blue',
    'COMPLETED': 'green',
    'FINISHED': 'green',
    'HIATUS': 'yellow',
    'CANCELLED': 'red',
    'UPCOMING': 'violet'
  };

  return statusColors[status?.toUpperCase() ?? ''] ?? 'gray';
}

/**
 * Get format badge color based on manga format
 *
 * @param format - Manga format string
 * @returns Mantine color name
 */
export function getFormatColor(format?: string): string {
  const formatColors: Record<string, string> = {
    'MANGA': 'blue',
    'NOVEL': 'violet',
    'ONE_SHOT': 'cyan',
    'DOUJIN': 'pink',
    'MANHWA': 'orange',
    'MANHUA': 'grape'
  };

  return formatColors[format?.toUpperCase() ?? ''] ?? 'gray';
}

/**
 * Check if metadata has extended information
 *
 * @param metadata - Metadata object to check
 * @returns True if extended info is available
 */
export function hasExtendedMetadata(metadata: MetadataInput): boolean {
  const hasAlternativeTitles = metadata.alternativeTitles && metadata.alternativeTitles.length > 0;
  const hasThemes = metadata.themes && metadata.themes.length > 0;

  return Boolean(
    hasAlternativeTitles ||
    hasThemes ||
    metadata.averageScore ||
    metadata.popularity
  );
}

/**
 * Check if metadata has external links
 *
 * @param metadata - Metadata object to check
 * @returns True if external links are available
 */
export function hasExternalLinksMetadata(metadata: Pick<MetadataInput, 'title'> & {
  anilistId?: number;
  myAnimeListId?: number;
  urls?: string[];
  bannerImage?: string;
}): boolean {
  return Boolean(
    metadata.anilistId || metadata.myAnimeListId || metadata.urls?.length
  );
}

/**
 * Create metadata sections with categorized fields
 *
 * Extracts the complex section creation logic to reduce
 * cyclomatic complexity in the main component.
 *
 * @param metadata - Manga metadata object
 * @returns Record of metadata sections organized by category
 */
export function createMetadataSections(metadata: MetadataInput): Record<string, MetadataSection> {
  return {
    basic: {
      title: 'Basic Information',
      icon: <IconBook size={16} />,
      fields: ([
        { label: 'Title', value: metadata.title },
        { label: 'Status', value: metadata.status, badge: true, color: getStatusColor(metadata.status) },
        { label: 'Format', value: metadata.format, badge: true, color: getFormatColor(metadata.format) },
        { label: 'Release Year', value: metadata.releaseYear }
      ] as MetadataField[]).filter((f) => f.value)
    },
    creators: {
      title: 'Creators',
      icon: <IconUser size={16} />,
      fields: [
        { label: 'Authors', value: metadata.authors?.join(', ') },
        { label: 'Artists', value: metadata.artists?.join(', ') }
      ].filter((f) => f.value)
    },
    publication: {
      title: 'Publication',
      icon: <IconCalendar size={16} />,
      fields: [
        { label: 'Start Date', value: formatDate(metadata.startDate) },
        { label: 'End Date', value: formatDate(metadata.endDate) },
        { label: 'Chapters', value: metadata.chapters, badge: true, color: 'cyan' },
        { label: 'Volumes', value: metadata.volumes, badge: true, color: 'indigo' }
      ].filter((f) => f.value && f.value !== 'Unknown')
    },
    categories: {
      title: 'Categories',
      icon: <IconTags size={16} />,
      fields: [
        { label: 'Genres', value: metadata.genres?.join(', ') },
        { label: 'Tags', value: metadata.tags?.slice(0, 5).join(', ') },
        { label: 'Themes', value: metadata.themes?.join(', ') }
      ].filter((f) => f.value)
    },
    metrics: {
      title: 'Metrics',
      icon: <IconWorld size={16} />,
      fields: [
        {
          label: 'Score',
          value: metadata.averageScore ? `${metadata.averageScore}/100` : undefined,
          badge: true,
          color: metadata.averageScore && metadata.averageScore > 75 ? 'green' :
                 metadata.averageScore && metadata.averageScore > 50 ? 'yellow' : 'red'
        },
        { label: 'Popularity', value: metadata.popularity?.toLocaleString() }
      ].filter((f) => f.value)
    }
  };
}
