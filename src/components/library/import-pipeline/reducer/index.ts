/**
 * Import Pipeline Reducer
 *
 * State management reducer for 4-stage import pipeline with combined detect+match.
 *
 * @module components/library/import-pipeline/reducer
 */

import { DEFAULT_CONFIDENCE_THRESHOLDS, DEFAULT_DETECT_MATCH_PROGRESS, DEFAULT_IMPORT_OPTIONS } from '@/components/library/import-pipeline/types';
import type { ImportPipelineState, PipelineAction, PipelineStage } from '@/components/library/import-pipeline/types';

import { handleDetectMatch, handleErrors, handleImport, handleNavigation, handleReviewSelection, handleSourceSelection } from './handlers';

// ============================================================================
// Initial State
// ============================================================================

export const initialPipelineState: ImportPipelineState = {
  stage: 'select',
  selectedLibraryId: null,
  scanPath: '',
  detectMatchProgress: DEFAULT_DETECT_MATCH_PROGRESS,
  scannedItems: [],
  matchedItems: new Map(),
  scanJobId: null,
  activeFilter: 'all',
  confidenceThresholds: DEFAULT_CONFIDENCE_THRESHOLDS,
  isCancelled: false,
  selectedForImport: new Set(),
  importOptions: DEFAULT_IMPORT_OPTIONS,
  importProgress: { current: 0, total: 0, isImporting: false, isCancelled: false },
  importResults: new Map(),
  errors: [],
};

// ============================================================================
// Stage Navigation Helpers
// ============================================================================

const STAGE_ORDER: PipelineStage[] = ['select', 'detect_match', 'review', 'import', 'complete'];

export function getNextStage(current: PipelineStage): PipelineStage {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return current;
  const next = STAGE_ORDER[idx + 1];
  return next ?? current;
}

export function getPrevStage(current: PipelineStage): PipelineStage {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx <= 0) return current;
  const prev = STAGE_ORDER[idx - 1];
  return prev ?? current;
}

// ============================================================================
// Main Reducer
// ============================================================================

// eslint-disable-next-line complexity -- State machine reducer handling all pipeline actions
export function pipelineReducer(state: ImportPipelineState, action: PipelineAction): ImportPipelineState {
  switch (action.type) {
    // Navigation
    case 'GO_TO_STAGE':
    case 'NEXT_STAGE':
    case 'PREV_STAGE':
    case 'RESET':
      return handleNavigation(state, action);

    // Source selection
    case 'SET_LIBRARY':
    case 'SET_SCAN_PATH':
      return handleSourceSelection(state, action);

    // Combined Detect + Match
    case 'START_DETECT_MATCH':
    case 'UPDATE_DETECT_MATCH_PROGRESS':
    case 'ITEM_DISCOVERED':
    case 'SET_SCANNED_ITEMS':
    case 'ITEM_MATCH_STARTED':
    case 'ITEM_MATCH_COMPLETE':
    case 'SET_ITEM_MATCH':
    case 'SET_ITEM_STATUS':
    case 'SET_MATCHED_ITEMS':
    case 'DETECT_MATCH_SCAN_COMPLETE':
    case 'DETECT_MATCH_COMPLETE':
    case 'CANCEL_DETECT_MATCH':
    case 'SET_ACTIVE_FILTER':
    case 'SET_CONFIDENCE_THRESHOLDS':
    case 'SET_MISSING_CHAPTERS_RESULTS':
    case 'SET_ITEM_SEARCH_RESULTS':
      return handleDetectMatch(state, action);

    // Review
    case 'SELECT_FOR_IMPORT':
    case 'DESELECT_FOR_IMPORT':
    case 'SELECT_ALL_FOR_IMPORT':
    case 'DESELECT_ALL_FOR_IMPORT':
    case 'SET_IMPORT_OPTIONS':
    case 'SET_ITEM_CHAPTER_MAPPINGS':
      return handleReviewSelection(state, action);

    // Import
    case 'START_IMPORT':
    case 'UPDATE_IMPORT_PROGRESS':
    case 'SET_IMPORT_RESULT':
    case 'IMPORT_COMPLETE':
    case 'CANCEL_IMPORT':
      return handleImport(state, action);

    // Errors
    case 'ADD_ERROR':
    case 'CLEAR_ERRORS':
      return handleErrors(state, action);

    default:
      return state;
  }
}
