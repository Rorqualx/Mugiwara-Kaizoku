/**
 * Annotation Editor Module
 */

export type { DisplayToken, TextSelection, BioMode } from './types';
export type { LabelAction, HistoryState, SelectionAction, ApplyLabelWithHistoryOptions } from './hooks';
export type { SelectionToolType } from './page-view/selection-tools-types';
export type { UrlClickData, SelectionData } from './page-view/types';
export { ENTITY_COLORS, KEYBOARD_SHORTCUTS, BIO_MODE_SHORTCUTS, CLEAR_SHORTCUT } from './types';
export { TOOL_SHORTCUTS } from './page-view/selection-tools-types';
export { LabelPalette, TokenDisplay, StatsPanel, ShortcutsPanel, ImageToken, SummaryTable, SelectionsSummary, SelectionToolbar } from './components';
export { SuggestionPanel, type Suggestion } from './components/SuggestionPanel';
export { TokenSuggestionBadge, getSuggestionForToken } from './components/TokenSuggestionBadge';
export { useSuggestions } from './hooks/useSuggestions';
export {
  useTokenClick,
  useKeyboardShortcuts,
  useInitializeTokens,
  useUndoRedo,
  useApplyLabelWithHistory,
  useSelectionsWithHistory,
  useComputeLabelsFromSelections,
  computeLabelsFromSelections,
  computeEntityCountsFromSelections,
} from './hooks';
export { PageView, getColorValue } from './page-view';
export {
  EditorHeader,
  PageInfoAlert,
  SelectionAlert,
  BrushModeAlert,
  UrlAnnotationsPanel,
  BrushModeWrapper,
  LastActionIndicator,
  ClearLabelsButton,
} from './components/editor-subcomponents';
