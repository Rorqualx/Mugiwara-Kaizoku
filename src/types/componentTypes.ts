/** 
 * React Component Type Definitions
 * 
 * This module provides type definitions for React components used in the application.
 * It includes interfaces for:
 * - Manga display components
 * - Grid layout components
 * - Component styling
 * 
 * @module types/components
 */

import type { MangaMetadata } from './search.types';
import type { Chapter, Library} from '@prisma/client';

// Type aliases for clarity
type ChapterEntity = Chapter;
type LibraryEntity = Library;

/** 
 * Manga display component props
 * Properties for rendering manga information in UI components
 * 
 * @interface MangaDisplay
 * @property {number} id - Unique manga identifier
 * @property {string} title - Display title
 * @property {string} source - Content source/provider
 * @property {string} interval - Update check interval
 * @property {MangaMetadata | null} [metadata] - Extended manga information
 * @property {ChapterEntity[]} [chapters] - Available chapters
 * @property {LibraryEntity | null} [library] - Parent library
 */
export interface MangaDisplay {
  id: number;
  title: string;
  source: string;
  interval: string;
  metadata?: MangaMetadata | null;
  chapters?: ChapterEntity[];
  library?: LibraryEntity | null;
}

/** 
 * Grid layout style props
 * Configuration for grid-based layouts
 * 
 * @interface GridStyle
 * @property {number} cols - Number of grid columns
 * @property {('xs' | 'sm' | 'md' | 'lg')} [spacing] - Grid gap size
 * @property {string} [className] - Additional CSS classes
 */
export interface GridStyle {
  cols: number;
  spacing?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}
