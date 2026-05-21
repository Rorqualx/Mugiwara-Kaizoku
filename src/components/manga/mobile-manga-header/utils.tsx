/**
 * Mobile Manga Header Utilities
 *
 * Helper functions for building info items and other utilities.
 */

import React from 'react';

import {
  IconCalendar,
  IconLanguage,
  IconFolder
} from '@tabler/icons-react';

import type { MangaWithRelations } from '@/types/search.types';

import type { Metadata } from '@prisma/client';


export interface InfoItemData {
  key: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

/**
 * Creates a date info item if the date exists
 */
function createDateItem(
  key: string,
  label: string,
  date: string | Date | null | undefined
): InfoItemData | null {
  if (!date) return null;

  return {
    key,
    icon: <IconCalendar size={18} />,
    label,
    value: new Date(date).getFullYear()
  };
}

/**
 * Creates a count info item if the count is greater than 0
 */
function createCountItem(
  key: string,
  label: string,
  count: number | null | undefined
): InfoItemData | null {
  if ((count ?? 0) <= 0) return null;

  return {
    key,
    icon: <IconFolder size={18} />,
    label,
    value: count ?? 'Unknown'
  };
}

/**
 * Creates the language info item if language exists
 */
function createLanguageItem(language: string | null | undefined): InfoItemData | null {
  if (!language) return null;

  return {
    key: 'language',
    icon: <IconLanguage size={18} />,
    label: 'Language',
    value: language || 'Unknown'
  };
}

/**
 * Creates the location info item from library path
 */
function createLocationItem(libraryPath: string | unknown): InfoItemData | null {
  if (!libraryPath) return null;

  const locationValue = typeof libraryPath === 'string'
    ? libraryPath.split('/').pop() ?? libraryPath
    : String(libraryPath);

  return {
    key: 'location',
    icon: <IconFolder size={18} />,
    label: 'Location',
    value: locationValue
  };
}

/**
 * Builds metadata-based info items
 */
function buildMetadataItems(metadata: Metadata | null | undefined): InfoItemData[] {
  if (!metadata) return [];

  const items: (InfoItemData | null)[] = [
    createDateItem('startDate', 'Started', metadata.startDate),
    createDateItem('endDate', 'Ended', metadata.endDate),
    createCountItem('volumes', 'Volumes', metadata.volumes),
    createCountItem('chapters', 'Chapters', metadata.chapters),
    createLanguageItem(metadata.language)
  ];

  return items.filter((item): item is InfoItemData => item !== null);
}

/**
 * Builds the list of info items to display based on available metadata
 */
export function buildInfoItems(manga: MangaWithRelations): InfoItemData[] {
  const metadataItems = buildMetadataItems(manga.Metadata);
  const locationItem = createLocationItem(manga.libraryPath);

  return locationItem
    ? [...metadataItems, locationItem]
    : metadataItems;
}
