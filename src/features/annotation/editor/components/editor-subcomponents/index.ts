/**
 * Editor Sub-components
 *
 * Smaller UI components used by the main AnnotationEditor page.
 * Split into separate files for maintainability.
 */

// EditorHeader
export { EditorHeader } from './EditorHeader';
export type { EditorHeaderProps } from './EditorHeader';

// Alert components
export { PageInfoAlert, SelectionAlert, BrushModeAlert } from './alerts';
export type { PageInfoAlertProps, SelectionAlertProps, BrushModeAlertProps } from './alerts';

// Panel components
export { UrlAnnotationsPanel, BrushModeWrapper, ClearLabelsButton } from './panels';
export type { UrlAnnotationsPanelProps, BrushModeWrapperProps, ClearLabelsButtonProps } from './panels';

// Indicator components
export { LastActionIndicator, BatchProgressIndicator } from './indicators';
export type { LastActionIndicatorProps, BatchProgressIndicatorProps, BatchProgress } from './indicators';
