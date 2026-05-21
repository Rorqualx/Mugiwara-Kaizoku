/**
 * BasicInfoStep Hooks
 *
 * Barrel export file for custom hooks used in BasicInfoStep component.
 *
 * @module components/addManga/steps/wizard/basic-info-step/hooks
 */

export { useProviderSearch } from './useProviderSearch';
export type { UseProviderSearchParams, UseProviderSearchReturn } from './useProviderSearch';

export { useResultSelection } from './useResultSelection';
export type { UseResultSelectionParams, UseResultSelectionReturn } from './useResultSelection';

export { useQuickAdd } from './useQuickAdd';
export type { UseQuickAddParams, UseQuickAddReturn } from './useQuickAdd';

export { useAlreadyAddedCheck } from './useAlreadyAddedCheck';
export type {
  UseAlreadyAddedCheckParams,
  UseAlreadyAddedCheckReturn,
  AlreadyAddedResult,
  SearchResultItem,
} from './useAlreadyAddedCheck';
