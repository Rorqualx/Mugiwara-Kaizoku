/**
 * Badge Components for Volume Browser
 *
 * Displays creator credits, themes, and story arc badges.
 *
 * @module volume-browser/components/BadgeComponents
 */

import React from 'react';

import { Group, Badge, Text } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';

/**
 * Creator badges component props
 */
interface CreatorBadgesProps {
  creators?: {
    authors?: string[];
    artists?: string[];
  } | undefined;
}

/**
 * Displays author and artist badges
 */
export function CreatorBadges({ creators }: CreatorBadgesProps): React.ReactElement | null {
  const hasAuthors = creators?.authors && creators.authors.length > 0;
  const hasArtists = creators?.artists && creators.artists.length > 0;

  if (!hasAuthors && !hasArtists) return null;

  // Type narrowing after null checks
  const validCreators = creators;

  return (
    <Group gap="xs">
      {hasAuthors && (
        <Badge leftSection={<IconUser size={12} />} variant="light" color="grape">
          {validCreators.authors?.join(', ') ?? ''}
        </Badge>
      )}
      {hasArtists && (
        <Badge leftSection={<IconUser size={12} />} variant="light" color="cyan">
          Art: {validCreators.artists?.join(', ') ?? ''}
        </Badge>
      )}
    </Group>
  );
}

/**
 * Theme badges component props
 */
interface ThemeBadgesProps {
  themes?: string[] | undefined;
}

/**
 * Displays theme badges with overflow handling
 */
export function ThemeBadges({ themes }: ThemeBadgesProps): React.ReactElement | null {
  if (!themes || themes.length === 0) return null;

  // Type narrowing after null check
  const validThemes = themes;

  return (
    <Group gap={4}>
      {validThemes.slice(0, 8).map((theme) => (
        <Badge key={theme} size="sm" variant="dot" color="violet">
          {theme}
        </Badge>
      ))}
      {validThemes.length > 8 && (
        <Text size="xs" c="dimmed">
          +{validThemes.length - 8} more
        </Text>
      )}
    </Group>
  );
}

/**
 * Story arc badges component props
 */
interface StoryArcBadgesProps {
  storyArcs?: string[] | undefined;
}

/**
 * Displays story arc badges
 */
export function StoryArcBadges({ storyArcs }: StoryArcBadgesProps): React.ReactElement | null {
  if (!storyArcs || storyArcs.length === 0) return null;

  // Type narrowing after null check
  const validStoryArcs = storyArcs;

  return (
    <Group gap={4}>
      <Text size="xs" c="dimmed">
        Story Arcs:
      </Text>
      {validStoryArcs.slice(0, 5).map((arc) => (
        <Badge key={arc} size="xs" variant="light" color="orange">
          {arc}
        </Badge>
      ))}
    </Group>
  );
}

/**
 * Helper function to check if creators data exists
 */
export function hasValidCreators(creators?: { authors?: string[]; artists?: string[] } | undefined): boolean {
  return (creators?.authors?.length ?? 0) > 0 || (creators?.artists?.length ?? 0) > 0;
}
