/**
 * Mobile Manga Header Module
 *
 * Main component that composes all sub-components for the mobile manga header.
 *
 * Decomposed from: MobileMangaHeader.tsx
 * Complexity reduced from 35 to ~10 per component
 */

import React, { useState } from 'react';

import { Stack } from '@mantine/core';

import { ActionButtons } from './ActionButtons';
import { DescriptionSection } from './DescriptionSection';
import { HeroSection } from './HeroSection';
import { MangaInfoGrid } from './MangaInfoGrid';
import { MonitoringToggle } from './MonitoringToggle';

import type { MobileMangaHeaderProps } from './types';

/**
 * Mobile-optimized manga header with hero image and info
 */
export function MobileMangaHeader({
  manga,
  isMonitoring,
  onToggleMonitoring,
  onRefresh,
  onEdit,
  onRemove,
  isUpdating = false
}: MobileMangaHeaderProps): React.ReactElement {
  const [showDescription, setShowDescription] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const metadata = manga.Metadata;
  const coverUrl = metadata?.coverUrl ?? '/cover-not-found.jpg';

  return (
    <Stack gap="md">
      <HeroSection
        manga={manga}
        coverUrl={coverUrl}
        showActions={showActions}
        setShowActions={setShowActions}
        onEdit={onEdit}
        onRefresh={onRefresh}
        onRemove={onRemove}
        isUpdating={isUpdating}
      />

      <MonitoringToggle
        isMonitoring={isMonitoring}
        onToggleMonitoring={onToggleMonitoring}
      />

      <MangaInfoGrid manga={manga} />

      <DescriptionSection
        summary={metadata?.summary}
        showDescription={showDescription}
        setShowDescription={setShowDescription}
      />

      <ActionButtons
        isMonitoring={isMonitoring}
        onToggleMonitoring={onToggleMonitoring}
        onRefresh={onRefresh}
        isUpdating={isUpdating}
      />
    </Stack>
  );
}

// Re-export components and types
export { InfoItem } from './InfoItem';
export { HeroSection } from './HeroSection';
export { MonitoringToggle } from './MonitoringToggle';
export { MangaInfoGrid } from './MangaInfoGrid';
export { DescriptionSection } from './DescriptionSection';
export { ActionButtons } from './ActionButtons';

export type {
  MobileMangaHeaderProps,
  InfoItemProps,
  HeroSectionProps,
  MonitoringToggleProps,
  MangaInfoGridProps,
  DescriptionSectionProps,
  ActionButtonsProps
} from './types';
