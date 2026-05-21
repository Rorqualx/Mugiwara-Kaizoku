/**
 * useImportPipeline Hook
 *
 * Main hook for the 4-stage import pipeline. Uses combined detect+match stage.
 *
 * @module components/library/import-pipeline/hooks/useImportPipeline
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch } from 'react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

import { useImportPipelineContext, createPipelineActions } from '../ImportPipelineContext';
import {
  DEFAULT_IMPORT_OPTIONS,
  STAGE_INDEX,
  calculateDetectMatchStats,
  calculateImportStats,
} from '../types';
import {
  extractMetadataFromProvider,
  autoMatchFilesToChapters,
  initializeMappings,
} from '../utils/chapter-matching-utils';

import { useDetectMatch } from './useDetectMatch';
import { useMissingChaptersBatch } from './useMissingChaptersBatch';

import type {
  PipelineStage,
  MatchFilter,
  ImportOptions,
  ImportProgress,
  DetectMatchProgress,
  DetectMatchStats,
  EnrichedProviderMatch,
  MatchedMangaItem,
  PipelineAction,
  ImportResult,
  FileToChapterMapping,
  ChapterMappingForImport,
  MetadataChapter,
  FileMode,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UseImportPipelineReturn {
  stage: PipelineStage;
  stageIndex: number;
  goToStage: (stage: PipelineStage) => void;
  nextStage: () => void;
  prevStage: () => void;
  reset: () => void;
  selectedLibraryId: number | null;
  scanPath: string;
  setLibrary: (libraryId: number) => void;
  setScanPath: (path: string) => void;
  canProceedToDetectMatch: boolean;
  detectMatchProgress: DetectMatchProgress;
  detectMatchStats: DetectMatchStats;
  isDetectMatchActive: boolean;
  matchedItems: MatchedMangaItem[];
  filteredMatchedItems: MatchedMangaItem[];
  activeFilter: MatchFilter;
  setActiveFilter: (filter: MatchFilter) => void;
  startDetectMatch: () => Promise<void>;
  cancelDetectMatch: () => void;
  matchSingleItem: (itemId: string, title: string) => Promise<void>;
  setItemMatch: (itemId: string, match: EnrichedProviderMatch | null) => void;
  canProceedToReview: boolean;
  selectedForImport: Set<string>;
  importOptions: ImportOptions;
  selectForImport: (itemId: string) => void;
  deselectForImport: (itemId: string) => void;
  selectAllForImport: () => void;
  deselectAllForImport: () => void;
  setImportOptions: (options: Partial<ImportOptions>) => void;
  setItemChapterMappings: (itemId: string, mappings: Map<string, FileToChapterMapping>) => void;
  autoMatchAllItems: () => void;
  resetAllMappings: () => void;
  canProceedToImport: boolean;
  isImporting: boolean;
  importProgress: ImportProgress;
  importResults: Map<string, ImportResult>;
  importStats: import('../types').ImportStats;
  startImport: () => void;
  cancelImport: () => void;
  errors: import('../types').PipelineError[];
  clearErrors: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

function filterMatchedItems(items: MatchedMangaItem[], filter: MatchFilter): MatchedMangaItem[] {
  switch (filter) {
    case 'all': return items;
    case 'matched': return items.filter((item) => item.status === 'matched' || item.status === 'manual');
    case 'needs_review': return items.filter((item) => item.status === 'low_confidence');
    case 'no_match': return items.filter((item) => item.status === 'no_match');
    case 'unmatched': return items.filter((item) => item.status === 'unmatched');
    default: return items;
  }
}

/** Extract chapter range from volume chapters for volume file linking */
function getChapterRange(volumeChapters: MetadataChapter[] | undefined): { start: number; end: number } | null {
  if (!volumeChapters || volumeChapters.length === 0) return null;

  const chapterNumbers = volumeChapters.map((ch) => ch.number).sort((a, b) => a - b);
  const start = chapterNumbers.at(0);
  const end = chapterNumbers.at(-1);
  if (start === undefined || end === undefined) return null;
  return { start, end };
}

function serializeMappingsForImport(mappings: Map<string, FileToChapterMapping>): ChapterMappingForImport[] {
  const result: ChapterMappingForImport[] = [];
  // eslint-disable-next-line complexity -- Mapping serialization handles multiple chapter/volume matching scenarios with conditional fields
  mappings.forEach((mapping) => {
    if (mapping.status !== 'auto_matched' && mapping.status !== 'manual_matched') return;

    // Build object conditionally to satisfy exactOptionalPropertyTypes
    const entry: ChapterMappingForImport = { filePath: mapping.filePath };

    // Determine if this is a volume file match (has multiple chapters)
    const isVolumeMatch = mapping.volumeChapters && mapping.volumeChapters.length > 1;

    if (!isVolumeMatch && mapping.metadataChapter?.number !== undefined) {
      // Single chapter match - include chapter number
      entry.chapterNumber = mapping.metadataChapter.number;
    }

    // Extract volume number from multiple sources (priority order)
    // 1. First chapter's volumeNumber in volume match
    // 2. metadataChapter.volumeNumber
    // 3. file.volumeNumber (from filename parsing)
    let volumeNum: number | undefined;
    if (isVolumeMatch && mapping.volumeChapters) {
      // For volume matches, get volumeNumber from first chapter or extract from chapters
      volumeNum = mapping.volumeChapters[0]?.volumeNumber ?? mapping.file.volumeNumber;
    } else {
      volumeNum = mapping.metadataChapter?.volumeNumber ?? mapping.file.volumeNumber;
    }
    if (volumeNum !== undefined) {
      entry.volumeNumber = volumeNum;
    }

    if (mapping.metadataChapter?.title !== undefined) {
      entry.title = mapping.metadataChapter.title;
    }

    // Include page count from metadata for validation
    if (mapping.metadataChapter?.pages !== undefined) {
      entry.pageCount = mapping.metadataChapter.pages;
    }

    // Include cover image from metadata
    if (mapping.metadataChapter?.coverImage !== undefined) {
      entry.coverImage = mapping.metadataChapter.coverImage;
    }

    // Include description/summary from metadata
    if (mapping.metadataChapter?.summary !== undefined) {
      entry.description = mapping.metadataChapter.summary;
    }

    // Include release date from metadata
    if (mapping.metadataChapter?.releaseDate !== undefined) {
      entry.releaseDate = mapping.metadataChapter.releaseDate;
    }

    // Include source URL from metadata
    if (mapping.metadataChapter?.url !== undefined) {
      entry.sourceUrl = mapping.metadataChapter.url;
    }

    // For volume files: include chapter range so backend can link to all chapters
    const range = getChapterRange(mapping.volumeChapters);
    if (range) {
      entry.chapterRangeStart = range.start;
      entry.chapterRangeEnd = range.end;
    }

    result.push(entry);
  });
  return result;
}

function dispatchImportResult(dispatch: Dispatch<PipelineAction>, itemId: string, result: ImportResult): void {
  dispatch({ type: 'SET_IMPORT_RESULT', result });
}

// ============================================================================
// Hook
// ============================================================================

export function useImportPipeline(): UseImportPipelineReturn {
  const ctx = useImportPipelineContext();
  const { state, dispatch, canProceedToDetectMatch, canProceedToReview, canProceedToImport } = ctx;
  const actions = useMemo(() => createPipelineActions(dispatch), [dispatch]);

  const detectMatchOps = useDetectMatch({
    dispatch,
    selectedLibraryId: state.selectedLibraryId,
    scanPath: state.scanPath,
    matchedItems: state.matchedItems,
    thresholds: state.confidenceThresholds,
    isCancelled: state.isCancelled,
    addError: actions.addError,
  });

  // Compute "+N new chapters" for every IN_LIBRARY row once the scan settles.
  useMissingChaptersBatch({
    dispatch,
    matchedItems: state.matchedItems,
    isScanComplete: state.detectMatchProgress.isScanComplete,
    isActive: detectMatchOps.isActive,
  });

  const importMutation = trpc.library.importFromPipeline.useMutation();

  // Seed fileMode from global config on mount. Bail if the user has already changed
  // the mode away from the initial default — their explicit choice wins over a late
  // server seed.
  const globalFileModeQuery = trpc.settings.get.useQuery({ key: 'file.organization.fileMode' });
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (globalFileModeQuery.data === undefined) return;
    if (state.importOptions.fileMode !== DEFAULT_IMPORT_OPTIONS.fileMode) {
      // User has already chosen a mode; don't override.
      seededRef.current = true;
      return;
    }
    // AsyncResult shape: { status: 'success', data: value }
    const result = globalFileModeQuery.data as { status: string; data?: unknown };
    const rawValue = result.data;
    if (typeof rawValue === 'string') {
      const validModes: FileMode[] = ['keep_in_place', 'move', 'copy'];
      if (validModes.includes(rawValue as FileMode)) {
        dispatch({ type: 'SET_IMPORT_OPTIONS', options: { fileMode: rawValue as FileMode } });
        seededRef.current = true;
      }
    }
  }, [globalFileModeQuery.data, state.importOptions.fileMode, dispatch]);

  // Auto-match all items that have a match and files (regardless of import selection).
  // Skips items whose mappings already exist so user edits aren't clobbered when
  // navigating back-and-forth between Detect-Match and Review.
  const autoMatchAllItems = useCallback((): void => {
    state.matchedItems.forEach((item) => {
      if (!item.selectedMatch) return;
      if (!item.files || item.files.length === 0) return;
      if (item.chapterMappings.size > 0) return;

      // Extract metadata from provider (pass files for volume detection)
      const { chapters, volumes } = extractMetadataFromProvider(item.selectedMatch, item.fileCount, item.files);
      if (chapters.length === 0) return;

      // Run auto-matching
      const newMappings = autoMatchFilesToChapters(item.files, chapters, volumes);
      dispatch({ type: 'SET_ITEM_CHAPTER_MAPPINGS', itemId: item.id, mappings: newMappings });
    });
  }, [state.matchedItems, dispatch]);

  // Reset all mappings for selected items
  const resetAllMappings = useCallback((): void => {
    state.matchedItems.forEach((item) => {
      // Only process selected items with files
      if (!state.selectedForImport.has(item.id)) return;
      if (!item.files || item.files.length === 0) return;

      // Initialize empty mappings
      const newMappings = initializeMappings(item.files);
      dispatch({ type: 'SET_ITEM_CHAPTER_MAPPINGS', itemId: item.id, mappings: newMappings });
    });
  }, [state.matchedItems, state.selectedForImport, dispatch]);

  /**
   * Longest common path prefix across an array of absolute paths.
   * For merged rows (Phase-1 dedup), this lifts the import to the deepest
   * directory that contains every merged source folder — so the server's
   * recursive `findMangaFiles` discovers all files in one call.
   *
   * Example:
   *   ["/lib/One Piece/Chapters/Vol 01", "/lib/One Piece/Chapters/Vol 02"]
   *   → "/lib/One Piece/Chapters"
   */
  const commonPathPrefix = useCallback((paths: readonly string[]): string => {
    if (paths.length === 0) return '';
    const first = paths[0] ?? '';
    if (paths.length === 1) return first;
    const splits = paths.map((p) => p.split('/'));
    const minLen = Math.min(...splits.map((s) => s.length));
    let i = 0;
    while (i < minLen && splits.every((s) => s[i] === splits[0]?.[i])) i++;
    return splits[0]?.slice(0, i).join('/') ?? first;
  }, []);

  const importSingleItem = useCallback(async (item: MatchedMangaItem, libraryId: number, createChapters: boolean, fileMode: import('../types').FileMode): Promise<void> => {
    const match = item.selectedMatch;
    const baseMetadata = match?.metadata as Record<string, unknown> | undefined;

    // Auto-match files to chapters if no mappings exist yet (only when provider match exists)
    let mappingsToUse = item.chapterMappings;
    if (match && mappingsToUse.size === 0 && item.files && item.files.length > 0) {
      const { chapters, volumes } = extractMetadataFromProvider(match, item.fileCount, item.files);
      if (chapters.length > 0) {
        mappingsToUse = autoMatchFilesToChapters(item.files, chapters, volumes);
        // Update state so UI reflects the auto-matched state
        dispatch({ type: 'SET_ITEM_CHAPTER_MAPPINGS', itemId: item.id, mappings: mappingsToUse });
      }
    }

    // Serialize chapter mappings and include in metadata for backend
    const chapterMappings = serializeMappingsForImport(mappingsToUse);
    const metadata = chapterMappings.length > 0
      ? { ...baseMetadata, chapterMappings }
      : baseMetadata;

    // For unmatched manga, use local provider with parsed title
    const title = match?.title ?? item.cleanTitle;
    const provider = match?.provider ?? 'local';
    const providerId = match?.providerId ?? 'local';

    // For merged rows (Phase-1 dedup), import from the common-prefix parent
    // so the server's recursive findMangaFiles picks up every merged folder.
    // For single-folder rows, this falls back to item.path unchanged.
    const importPath = item.mergedPaths && item.mergedPaths.length > 1
      ? commonPathPrefix(item.mergedPaths)
      : item.path;

    try {
      const result = await importMutation.mutateAsync({
        libraryId, path: importPath, title,
        provider, providerId,
        metadata, createChapters, fileMode
      });
      dispatchImportResult(dispatch, item.id, { itemId: item.id, status: 'success', mangaId: result.mangaId, mangaTitle: result.title, chaptersCreated: result.chaptersCreated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      dispatchImportResult(dispatch, item.id, { itemId: item.id, status: 'error', error: message });
      notify({ severity: 'ERROR', title: 'Import failed', message: `${title}: ${message}` });
    }
  }, [dispatch, importMutation, commonPathPrefix]);

  // Mutable cancel flag the import loop polls between iterations. The reducer-side
  // isCancelled is set synchronously, but the for-loop captures stale state, so we
  // mirror cancellation into a ref the loop can read each iteration.
  const isCancelledRef = useRef(false);

  const startImport = useCallback((): void => {
    isCancelledRef.current = false;
    dispatch({ type: 'START_IMPORT' });
    dispatch({ type: 'GO_TO_STAGE', stage: 'import' });
    const items = Array.from(state.matchedItems.values()).filter((i) => state.selectedForImport.has(i.id));
    if (items.length === 0 || state.selectedLibraryId === null) { dispatch({ type: 'IMPORT_COMPLETE' }); return; }
    const libId = state.selectedLibraryId;
    const createCh = state.importOptions.createChapters;
    const fMode = state.importOptions.fileMode;
    void (async (): Promise<void> => {
      for (let i = 0; i < items.length; i++) {
        if (isCancelledRef.current) break;
        const item = items[i];
        if (item) {
          dispatch({ type: 'UPDATE_IMPORT_PROGRESS', progress: { current: i + 1, total: items.length } });
          // eslint-disable-next-line no-await-in-loop -- Sequential import for progress tracking
          await importSingleItem(item, libId, createCh, fMode);
        }
      }
      dispatch({ type: 'IMPORT_COMPLETE' });
    })();
  }, [dispatch, state.matchedItems, state.selectedForImport, state.selectedLibraryId, state.importOptions.createChapters, state.importOptions.fileMode, importSingleItem]);

  // Auto-match all items when entering the review stage
  const autoMatchRanRef = useRef(false);
  useEffect(() => {
    if (state.stage !== 'review') {
      autoMatchRanRef.current = false;
      return;
    }
    if (autoMatchRanRef.current) return;
    autoMatchRanRef.current = true;
    autoMatchAllItems();
  }, [state.stage, autoMatchAllItems]);

  // Auto-tick IN_LIBRARY rows with new chapters when the topUpExisting Switch
  // is ON. Runs once per (scan-complete, topUpExisting) transition; runs again
  // if the user flips the Switch back on after deselecting.
  const topUpAutoSelectedRef = useRef<boolean>(false);
  useEffect(() => {
    const shouldRun =
      state.importOptions.topUpExisting
      && state.detectMatchProgress.isScanComplete
      && !detectMatchOps.isActive;
    if (!shouldRun) {
      if (!state.importOptions.topUpExisting) topUpAutoSelectedRef.current = false;
      return;
    }
    if (topUpAutoSelectedRef.current) return;
    let any = false;
    for (const item of state.matchedItems.values()) {
      if (!item.isDuplicate) continue;
      if (typeof item.newChapters !== 'number' || item.newChapters <= 0) continue;
      if (state.selectedForImport.has(item.id)) continue;
      dispatch({ type: 'SELECT_FOR_IMPORT', itemId: item.id });
      any = true;
    }
    if (any) topUpAutoSelectedRef.current = true;
  }, [state.importOptions.topUpExisting, state.detectMatchProgress.isScanComplete, detectMatchOps.isActive, state.matchedItems, state.selectedForImport, dispatch]);

  const cancelImport = useCallback(() => {
    isCancelledRef.current = true;
    dispatch({ type: 'CANCEL_IMPORT' });
  }, [dispatch]);
  const matchedItemsArray = useMemo(() => Array.from(state.matchedItems.values()), [state.matchedItems]);
  const detectMatchStats = useMemo(() => calculateDetectMatchStats(matchedItemsArray, state.confidenceThresholds), [matchedItemsArray, state.confidenceThresholds]);
  const importStats = useMemo(() => calculateImportStats(state.importResults), [state.importResults]);
  const filteredMatchedItems = useMemo(() => filterMatchedItems(matchedItemsArray, state.activeFilter), [matchedItemsArray, state.activeFilter]);

  return {
    stage: state.stage, stageIndex: STAGE_INDEX[state.stage], goToStage: actions.goToStage, nextStage: actions.nextStage, prevStage: actions.prevStage, reset: actions.reset,
    selectedLibraryId: state.selectedLibraryId, scanPath: state.scanPath, setLibrary: actions.setLibrary, setScanPath: actions.setScanPath, canProceedToDetectMatch,
    detectMatchProgress: detectMatchOps.progress, detectMatchStats, isDetectMatchActive: detectMatchOps.isActive, matchedItems: matchedItemsArray, filteredMatchedItems,
    activeFilter: state.activeFilter, setActiveFilter: actions.setActiveFilter, startDetectMatch: detectMatchOps.startDetectMatch, cancelDetectMatch: detectMatchOps.cancelDetectMatch,
    matchSingleItem: detectMatchOps.matchSingleItem, setItemMatch: detectMatchOps.setItemMatch, canProceedToReview,
    selectedForImport: state.selectedForImport, importOptions: state.importOptions, selectForImport: actions.selectForImport, deselectForImport: actions.deselectForImport,
    selectAllForImport: actions.selectAllForImport, deselectAllForImport: actions.deselectAllForImport, setImportOptions: actions.setImportOptions,
    setItemChapterMappings: actions.setItemChapterMappings, autoMatchAllItems, resetAllMappings, canProceedToImport,
    isImporting: state.importProgress.isImporting, importProgress: state.importProgress, importResults: state.importResults, importStats, startImport, cancelImport,
    errors: state.errors, clearErrors: actions.clearErrors,
  };
}
