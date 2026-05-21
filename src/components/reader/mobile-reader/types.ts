/**
 * Mobile Reader Type Definitions
 *
 * Shared TypeScript interfaces and types for the mobile manga reader component.
 *
 * Extracted from: MobileReader.tsx
 * Purpose: Foundation types for all mobile reader modules
 */

import type { ReactNode } from 'react';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Represents a single page in the manga reader
 */
export interface ReaderPage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  pageNumber: number;
}

/**
 * Represents a chapter with its pages
 */
export interface ReaderChapter {
  id: string;
  title: string;
  number: number;
  pages: ReaderPage[];
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for the main MobileReader component
 */
export interface MobileReaderProps {
  /** Current chapter to display */
  chapter: ReaderChapter;
  /** Current page index (0-based) */
  currentPage: number;
  /** Reading mode */
  mode?: 'vertical' | 'single' | 'double';
  /** Reading direction */
  direction?: 'ltr' | 'rtl';
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback for chapter navigation */
  onChapterChange?: (direction: 'prev' | 'next') => void;
  /** Show UI controls */
  showControls?: boolean;
  /** Custom header component */
  header?: ReactNode;
  /** Custom footer component */
  footer?: ReactNode;
  /** Enable haptic feedback on mobile devices */
  hapticFeedback?: boolean;
}

/**
 * Props for the ReaderSettings modal component
 */
export interface ReaderSettingsProps {
  opened: boolean;
  onClose: () => void;
  mode: 'vertical' | 'single' | 'double';
  direction: 'ltr' | 'rtl';
  zoom: number;
  onModeChange: (mode: 'vertical' | 'single' | 'double') => void;
  onDirectionChange: (direction: 'ltr' | 'rtl') => void;
  onZoomChange: (zoom: number) => void;
}

/**
 * Props for the PageListModal component
 */
export interface PageListModalProps {
  opened: boolean;
  onClose: () => void;
  pages: ReaderPage[];
  currentPage: number;
  readingProgress: Set<number>;
  onPageSelect: (page: number) => void;
}

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Reading mode options
 */
export type ReadingMode = 'vertical' | 'single' | 'double';

/**
 * Reading direction options
 */
export type ReadingDirection = 'ltr' | 'rtl';

/**
 * Navigation direction options
 */
export type NavigationDirection = 'prev' | 'next';
