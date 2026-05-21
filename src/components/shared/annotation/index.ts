/**
 * Shared Annotation Components
 *
 * Reusable components for visual annotation and element selection.
 * Used by both ML annotation training and Custom Source selector configuration.
 *
 * @module components/shared/annotation
 */

// Types
export type {
  DisplayToken,
  ElementHighlight,
  ClickableElement,
  ImageHighlight,
  EntityConfig,
  EntityCategory,
  PagePreviewProps,
  TokenDisplayProps,
  EntityPaletteProps,
  TokenViewMode,
  TokenLayoutMode,
} from './types';

// Constants
export {
  DEFAULT_ENTITY_COLORS,
  CUSTOM_SOURCE_ENTITY_COLORS,
  DEFAULT_KEYBOARD_SHORTCUTS,
  getColorValue,
  getEntityColor,
  getEntityColorValue,
} from './constants';

// Components
export { PagePreview } from './PagePreview';

// Helpers (for advanced usage)
export {
  processHtmlForDisplay,
  buildHighlightMap,
  buildClickableMap,
  buildImageHighlights,
  createHighlightScript,
  createIframeStyles,
  extractNoscriptImages,
} from './PagePreview/helpers';
