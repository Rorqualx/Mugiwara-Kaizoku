/**
 * Volume Browser Metadata Component
 *
 * Combines creator, theme, and story arc badges into a single metadata display.
 *
 * @module volume-browser/components/VolumeBrowserMetadata
 */

import React from 'react';

import { Stack } from '@mantine/core';

import { CreatorBadges, ThemeBadges, StoryArcBadges, hasValidCreators } from './BadgeComponents';

import type { VolumeBrowserMetadataProps } from '../types';

/**
 * Displays aggregated metadata for the entire volume collection
 */
export function VolumeBrowserMetadata({
  creators,
  themes,
  storyArcs
}: VolumeBrowserMetadataProps): React.ReactElement | null {
  const hasCreators = hasValidCreators(creators);
  const hasThemes = (themes?.length ?? 0) > 0;
  const hasStoryArcs = (storyArcs?.length ?? 0) > 0;

  if (!hasCreators && !hasThemes && !hasStoryArcs) {
    return null;
  }

  return (
    <Stack gap="xs">
      {hasCreators && <CreatorBadges creators={creators} />}
      {hasThemes && <ThemeBadges themes={themes} />}
      {hasStoryArcs && <StoryArcBadges storyArcs={storyArcs} />}
    </Stack>
  );
}
