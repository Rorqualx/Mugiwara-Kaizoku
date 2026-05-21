/**
 * Shared Annotation Types
 *
 * Core types used by both ML annotation and Custom Source selector configuration.
 * These types are designed to be generic and configurable for different use cases.
 *
 * @module components/shared/annotation/types
 */

/**
 * A linearized token from DOM content
 * Represents a single text node or image that can be labeled
 */
export interface DisplayToken {
  id: string;
  text: string;
  tagName: string;
  label: string; // BIO tag like 'B-TITLE', 'I-TITLE', 'O'
  index: number;
  xpath: string | null;
  // Image fields
  isImage: boolean;
  imageSrc: string | null;
  imageAlt: string | null;
}

/**
 * Highlight data for an element in the PagePreview
 */
export interface ElementHighlight {
  xpath: string;
  color: string;
  label: string;
  tokenIndices: number[];
  tokenTexts: string[];
  selectionText: string;
}

/**
 * Clickable element data for token selection
 */
export interface ClickableElement {
  xpath: string;
  tokenIndices: number[];
}

/**
 * Image highlight data for matching by src/alt
 */
export interface ImageHighlight {
  imageSrc: string;
  imageAlt: string;
  color: string;
  label: string;
  tokenIndices: number[];
}

/**
 * Configuration for an entity type that can be labeled
 */
export interface EntityConfig {
  id: string;
  label: string;
  color: string;
  description?: string;
  shortcut?: string;
}

/**
 * Category of related entity types
 */
export interface EntityCategory {
  id: string;
  title: string;
  description: string;
  entities: EntityConfig[];
  defaultOpen: boolean;
  badge?: { text: string; color: string };
}

/**
 * Props for PagePreview component
 */
export interface PagePreviewProps {
  /** HTML content to display in the iframe */
  htmlSnapshot: string;
  /** Tokens extracted from the HTML */
  tokens: DisplayToken[];
  /** Currently selected entity for labeling (brush mode) */
  selectedLabel?: string | null;
  /** Callback when an element is clicked */
  onElementClick: (tokenIndices: number[]) => void;
  /** Source URL for converting relative paths to absolute */
  sourceUrl?: string;
  /** Ref to receive a function for triggering flash animations */
  flashTriggerRef?: React.RefObject<((tokenIndices: number[], color?: string) => void) | null>;
  /** Whether to show label highlights (default: true) */
  showLabels?: boolean;
  /** Active brush mode label (shows + cursor when set) */
  activeBrush?: string | null;
  /** Entity color map for highlighting */
  entityColors?: Record<string, string>;
}

/**
 * Props for TokenDisplay component
 */
export interface TokenDisplayProps {
  tokens: DisplayToken[];
  onTokenClick: (index: number, shiftKey: boolean) => void;
  selectedTokens: Set<number>;
  /** Entity color map for badge colors */
  entityColors?: Record<string, string>;
}

/**
 * Props for EntityPalette component
 */
export interface EntityPaletteProps {
  /** Categories of entities to display */
  categories: EntityCategory[];
  /** Callback when a label is applied */
  onApply: (entityId: string | null) => void;
  /** Number of currently selected tokens */
  selectedCount: number;
  /** Currently active brush mode entity */
  activeBrush?: string | null;
  /** Callback when brush mode entity is selected */
  onBrushSelect?: (entityId: string | null) => void;
  /** Callback to clear brush mode */
  onBrushClear?: () => void;
  /** Entity color map */
  entityColors?: Record<string, string>;
}

/**
 * Token view filter modes
 */
export type TokenViewMode = 'all' | 'labeled' | 'unlabeled';

/**
 * Token layout display modes
 */
export type TokenLayoutMode = 'flow' | 'compact' | 'grouped';
