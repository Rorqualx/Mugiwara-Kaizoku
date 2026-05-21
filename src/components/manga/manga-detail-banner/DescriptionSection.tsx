/**
 * DescriptionSection Component
 *
 * Displays manga description in a collapsible section with HTML parsing support.
 *
 * Extracted from: MangaDetailBanner.tsx (lines 356-403)
 *
 * @module components/manga/manga-detail-banner/DescriptionSection
 */

import * as React from 'react';

import { Box, Button, Group, Text } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

import { stripHtmlTags, getProvenance } from '@/components/manga/mangaDetailUtils';
import { ProviderBadge } from '@/components/metadata/ProviderBadge';
import { ProviderStrengthIndicator } from '@/components/metadata/ProviderStrengthIndicator';
import { getMetadataString } from '@/utils/entityMetadataUtils';


import type { CollapsibleSectionProps } from './types';

/**
 * Parse HTML content into React components with optional chaining and nullish coalescing
 *
 * @param html - The HTML string to parse, which can be null or undefined
 * @returns React components or text content parsed from the HTML, or null if input is null or undefined
 */
function parseHtmlContent(html: string | null | undefined): React.ReactNode {
  // Early return with null if html is null or undefined
  if (html === null || html === undefined) return null;

  // Use safe string methods with optional chaining
  const paragraphs = html.split(/<\/?p>/g).filter((p) => p.trim().length > 0);

  // Return simple text if there aren't multiple paragraphs
  if (paragraphs.length <= 1) {
    return stripHtmlTags(html);
  }

  // Return an array of Text components for multiple paragraphs
  return paragraphs.map((paragraph, index) => (
    <Text key={index} mb="xs">
      {stripHtmlTags(paragraph)}
    </Text>
  ));
}

/**
 * DescriptionSection Component
 *
 * Renders manga description with expand/collapse functionality.
 */
export function DescriptionSection({
  manga,
  isExpanded,
  setIsExpanded
}: CollapsibleSectionProps): React.ReactElement | null {
  const description = getMetadataString(manga, 'description');

  if (!description) {
    return null;
  }

  return (
    <Box mb="lg">
      <Group gap="xs" mb="xs">
        <Text fw={500} c="white">
          Description
        </Text>
        {getProvenance(manga, 'description') && (
          <>
            <ProviderBadge providerId={getProvenance(manga, 'description') ?? ''} size="xs" />
            <ProviderStrengthIndicator
              providerId={getProvenance(manga, 'description') ?? ''}
              fieldName="description"
              mode="minimal"
              size="xs"
            />
          </>
        )}
      </Group>

      <Box c="gray.3">
        {isExpanded ? (
          parseHtmlContent(description)
        ) : (
          <Text lineClamp={4}>{stripHtmlTags(description)}</Text>
        )}
      </Box>

      <Button
        variant="subtle"
        size="xs"
        mt="xs"
        onClick={() => setIsExpanded(!isExpanded)}
        rightSection={isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}>
        {isExpanded ? 'Show Less' : 'Show More'}
      </Button>
    </Box>
  );
}
