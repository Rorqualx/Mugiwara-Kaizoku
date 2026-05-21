/**
 * Editor Sub-components
 *
 * Re-exports from split modules for backward compatibility.
 * See ./editor-subcomponents/ for the actual implementations.
 */

// Re-export everything from the split modules
export {
  EditorHeader,
  PageInfoAlert,
  SelectionAlert,
  BrushModeAlert,
  UrlAnnotationsPanel,
  BrushModeWrapper,
  ClearLabelsButton,
  LastActionIndicator,
  BatchProgressIndicator,
} from './editor-subcomponents/index';

export type {
  EditorHeaderProps,
  PageInfoAlertProps,
  SelectionAlertProps,
  BrushModeAlertProps,
  UrlAnnotationsPanelProps,
  BrushModeWrapperProps,
  ClearLabelsButtonProps,
  LastActionIndicatorProps,
  BatchProgressIndicatorProps,
  BatchProgress,
} from './editor-subcomponents/index';
