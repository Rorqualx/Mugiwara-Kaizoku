/**
 * PageView Component Types
 */

import type { DisplayToken } from '../types';
import type { SelectionToolType } from './selection-tools-types';

/** URL click data for URL labeling */
export interface UrlClickData {
  href: string;
  fullUrl: string;
  linkText: string;
}

/**
 * Selection data for creating TextSelection objects
 * Passed from PageView to parent when user makes a precise selection
 */
export interface SelectionData {
  text: string;
  xpath: string;
  charStart: number;
  charEnd: number;

  // === TextQuoteSelector for fuzzy reconstruction ===
  /** 32 chars before selection (for fuzzy matching if xpath fails) */
  prefix?: string;
  /** 32 chars after selection (for fuzzy matching if xpath fails) */
  suffix?: string;

  // === Global position fallback ===
  /** Character position in entire document text (fallback anchor) */
  globalCharStart?: number;
  globalCharEnd?: number;

  // === Image fields ===
  isImage?: boolean;
  imageSrc?: string;
  imageAlt?: string;
}

export interface PageViewProps {
  htmlSnapshot: string;
  tokens: DisplayToken[];
  selectedLabel: string | null;
  onElementClick: (tokenIndices: number[]) => void;
  /** Callback for URL clicks (for URL labeling) */
  onUrlClick?: ((urlData: UrlClickData) => void) | undefined;
  /** Source URL for converting relative paths to absolute */
  sourceUrl?: string | undefined;
  /** Optional ref to receive a function for triggering flash on elements */
  flashTriggerRef?: React.RefObject<((tokenIndices: number[], color?: string) => void) | null>;
  /** Whether to show label highlights (default: true) */
  showLabels?: boolean | undefined;
  /** Active brush mode label (shows + cursor when set) */
  activeBrush?: string | null | undefined;
  /** Active selection tool (brush, rectangle, block, word, column, row) */
  activeTool?: SelectionToolType;
  /** Callback for selection-based annotation - receives raw selection data */
  onSelectionCreate?: ((selectionData: SelectionData) => void) | undefined;
}

export interface ElementHighlight {
  xpath: string;
  color: string;
  label: string;
  tokenIndices: number[];
  /** Token texts for text-level highlighting */
  tokenTexts: string[];
  /** Combined selection text for precise highlighting */
  selectionText: string;
  /** When true, skip text-based highlighting and use whole element (for multi-xpath spans) */
  useWholeElement?: boolean;
  /** DOM element ID for direct getElementById resolution (Tier 0, most reliable) */
  elementId?: string;
}

export interface IframeMessage {
  type: 'element-click' | 'element-hover';
  xpath: string;
  tokenIndices: number[];
}

/**
 * Re-export selection tool types for convenience
 */
export type { SelectionToolType, SelectionToolMessage, SetSelectionToolMessage } from './selection-tools-types';
