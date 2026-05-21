/**
 * Annotation Editor Page - Extracted Modules
 *
 * Re-exports hooks and helpers extracted from [pageId].tsx
 */

export { useAnnotationMutations } from './useAnnotationMutations';
export type { AnnotationMutationsResult } from './useAnnotationMutations';

export {
  useHandleSave,
  useHandleMarkReviewed,
  useHandleReprocess,
} from './usePageHandlers';

export {
  useElementClickHandler,
  useUrlClickHandler,
  useSelectionCreateHandler,
} from './useEditorHandlers';

export {
  createUpdateLabelsCallbacks,
  createUpdateMangaTitleCallbacks,
  createFetchHtmlOnlyCallbacks,
  createAddFromUrlCallbacks,
  createReprocessCallbacks,
} from './useMutationCallbacks';

export {
  useUndoRedoKeyboard,
  useToolKeyboard,
} from './useKeyboardEffects';
