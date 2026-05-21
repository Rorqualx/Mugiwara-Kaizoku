/**
 * Visual Inspector Module
 *
 * Provides tools for interactive element selection and CSS/XPath selector generation.
 * Used for annotating web pages and generating selectors for ML training.
 *
 * Components:
 * - VisualInspectorModal: Iframe-based visual selector picker with live preview
 * - Element Picker: Interactive hover/click element selection
 * - Selector Optimizer: CSS selector generation and optimization
 * - Validation Components: Live preview and feedback panels
 *
 * @module components/shared/annotation/visual-inspector
 */

// Main modal component
export { VisualInspectorModal } from './VisualInspectorModal';
export type { VisualInspectorModalProps } from './VisualInspectorModal';

// Element picker utilities
export {
  createElementPicker,
  injectElementPickerIntoIframe,
  type ElementPickerConfig
} from './element-picker';

// Selector optimizer utilities
export {
  generateOptimizedSelector,
  generateSelectorWithValidation,
  testSelectorUniqueness,
  testSelector,
  optimizeExistingSelector,
  type SelectorOptions,
  type SelectorResult
} from './selector-optimizer';

// Types
export type {
  ExtractionType,
  SelectorType,
  ExtractionConfig,
  SelectorValidationResult,
  EnhancedSelectorState,
  UseSelectorValidationResult,
  ExtractionTypePanelProps,
  SelectorTypeToggleProps,
  LivePreviewPanelProps,
  ValidationFeedbackPanelProps
} from './types';
export { EMPTY_VALIDATION_RESULT, DEFAULT_ENHANCED_SELECTOR_STATE } from './types';

// Hooks
export { useSelectorValidation } from './hooks';

// UI Components
export {
  ExtractionTypePanel,
  SelectorTypeToggle,
  LivePreviewPanel,
  ValidationFeedbackPanel
} from './components';
