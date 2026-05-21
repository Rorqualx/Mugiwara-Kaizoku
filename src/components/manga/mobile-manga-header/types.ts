/**
 * Mobile Manga Header Type Definitions
 *
 * Shared TypeScript interfaces and types for the mobile manga header component.
 *
 * Extracted from: MobileMangaHeader.tsx
 * Purpose: Foundation types for all mobile manga header modules
 */

import type { ReactNode } from 'react';

import type { MangaWithRelations } from '@/types/search.types';

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for the main MobileMangaHeader component
 */
export interface MobileMangaHeaderProps {
  manga: MangaWithRelations;
  isMonitoring: boolean;
  onToggleMonitoring: (monitored: boolean) => void;
  onRefresh: () => void;
  onEdit: () => void;
  onRemove: () => void;
  isUpdating?: boolean;
}

/**
 * Props for InfoItem component
 */
export interface InfoItemProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  color?: string;
}

/**
 * Props for HeroSection component
 */
export interface HeroSectionProps {
  manga: MangaWithRelations;
  coverUrl: string;
  showActions: boolean;
  setShowActions: (show: boolean) => void;
  onEdit: () => void;
  onRefresh: () => void;
  onRemove: () => void;
  isUpdating: boolean;
}

/**
 * Props for MonitoringToggle component
 */
export interface MonitoringToggleProps {
  isMonitoring: boolean;
  onToggleMonitoring: (monitored: boolean) => void;
}

/**
 * Props for MangaInfoGrid component
 */
export interface MangaInfoGridProps {
  manga: MangaWithRelations;
}

/**
 * Props for DescriptionSection component
 */
export interface DescriptionSectionProps {
  summary: string | null | undefined;
  showDescription: boolean;
  setShowDescription: (show: boolean) => void;
}

/**
 * Props for ActionButtons component
 */
export interface ActionButtonsProps {
  isMonitoring: boolean;
  onToggleMonitoring: (monitored: boolean) => void;
  onRefresh: () => void;
  isUpdating: boolean;
}
