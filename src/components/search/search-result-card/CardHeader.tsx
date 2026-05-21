/**
 * Card Header Component
 *
 * Displays the title and provider badge for a search result card.
 */

'use client';

import * as React from 'react';

import { Text, Group, Badge } from '@mantine/core';

import type { SearchResult } from '@/types/search.types';

/**
 * Get a color for the provider badge based on provider name
 *
 * @param provider - The provider name to get a color for
 * @returns A color string for Mantine components
 */
export function getProviderColor(provider: string): string {
  const providerLower = provider.toLowerCase();
  if (providerLower.includes('anilist')) return 'blue';
  if (providerLower.includes('comicvine')) return 'green';
  if (providerLower.includes('fandom')) return 'purple';
  if (providerLower.includes('wikipedia')) return 'cyan';
  if (providerLower.includes('native_download')) return 'red';
  if (providerLower.includes('prowlarr')) return 'violet';
  return 'gray';
}

export interface CardHeaderProps {
  /** The search result to display header for */
  result: SearchResult;
}

/**
 * Card header component displaying title and provider badge
 *
 * @param props - Component props
 * @returns React element
 */
export function CardHeader({ result }: CardHeaderProps): React.ReactNode {
  return (
    <Group justify="space-between" mt="md" mb="xs">
      <Text fw={500} lineClamp={2}>{result.title}</Text>
      <Badge color={getProviderColor(result.provider)} variant="light">
        {result.provider}
      </Badge>
    </Group>
  );
}
