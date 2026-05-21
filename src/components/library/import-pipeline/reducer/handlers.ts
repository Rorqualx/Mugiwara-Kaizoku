/**
 * Import Pipeline Reducer Handlers
 *
 * Handler functions for pipeline state management.
 *
 * @module components/library/import-pipeline/reducer/handlers
 */

import { normalizeSearchTitle } from '@/components/library/import-pipeline/hooks/useDetectMatch/helpers';
import { DEFAULT_DETECT_MATCH_PROGRESS } from '@/components/library/import-pipeline/types';
import type { EnrichedProviderMatch, ImportPipelineState, MatchedMangaItem, PipelineAction, ScannedMangaItem } from '@/components/library/import-pipeline/types';

import { initialPipelineState, getNextStage, getPrevStage } from './index';

// ============================================================================
// Helper Functions
// ============================================================================

function createMatchedItem(item: ScannedMangaItem): MatchedMangaItem {
  // For duplicates with existing manga data, auto-match to existing entry
  if (item.isDuplicate && item.duplicateOfId !== undefined && item.duplicateOfTitle) {
    const existingMatch: EnrichedProviderMatch = {
      id: `library-${item.duplicateOfId}`,
      provider: 'library',
      providerId: String(item.duplicateOfId),
      title: item.duplicateOfTitle,
      confidence: item.duplicateScore ?? 0.95,
      metadata: {
        coverImage: item.duplicateCoverImage ?? null,
        source: 'existing_library',
      },
    };
    const confidence = existingMatch.confidence;
    const providerMatches = new Map<string, EnrichedProviderMatch>();
    providerMatches.set('library', existingMatch);
    return {
      ...item,
      status: 'matched',
      selectedMatch: existingMatch,
      confidence,
      availableMatches: [existingMatch],
      providerMatches,
      isSearching: false,
      searchResults: [],
      lastUpdated: Date.now(),
      chapterMappings: new Map(),
    };
  }
  return { ...item, status: item.isDuplicate ? 'skipped' : 'pending', selectedMatch: null, confidence: 0, availableMatches: [], providerMatches: new Map(), isSearching: false, searchResults: [], lastUpdated: Date.now(), chapterMappings: new Map() };
}

/**
 * Pick the best match per provider from available matches.
 * Returns a Map of provider → best EnrichedProviderMatch for that provider.
 */
function selectBestPerProvider(matches: EnrichedProviderMatch[]): Map<string, EnrichedProviderMatch> {
  const byProvider = new Map<string, EnrichedProviderMatch>();
  for (const match of matches) {
    const provider = match.provider;
    const existing = byProvider.get(provider);
    if (!existing || match.confidence > existing.confidence) {
      byProvider.set(provider, match);
    }
  }
  return byProvider;
}

/** Helper to get a metadata field from a match */
function getMetaField(match: EnrichedProviderMatch, key: string): unknown {
  const meta = match.metadata;
  if (meta === null || meta === undefined || typeof meta !== 'object') return undefined;
  return (meta as Record<string, unknown>)[key];
}

/** Pick the best string value: longest non-empty string across all provider matches */
function bestString(matches: EnrichedProviderMatch[], key: string): string | undefined {
  let best: string | undefined;
  for (const m of matches) {
    const val = getMetaField(m, key);
    if (typeof val === 'string' && val.length > 0 && (!best || val.length > best.length)) best = val;
  }
  return best;
}

/** Pick the best number value: highest non-null number */
function bestNumber(matches: EnrichedProviderMatch[], key: string): number | undefined {
  let best: number | undefined;
  for (const m of matches) {
    const val = getMetaField(m, key);
    if (typeof val === 'number' && (best === undefined || val > best)) best = val;
  }
  return best;
}

/** Pick the best array value: longest non-empty array */
function bestArray(matches: EnrichedProviderMatch[], key: string): unknown[] | undefined {
  let best: unknown[] | undefined;
  for (const m of matches) {
    const val = getMetaField(m, key);
    if (Array.isArray(val) && val.length > 0 && (!best || val.length > best.length)) best = val;
  }
  return best;
}

/**
 * Merge the best metadata fields across all provider matches into the selected match.
 * For each field, picks the most complete value from any provider.
 */
function enrichMatchWithBestFields(
  selected: EnrichedProviderMatch,
  providerMatches: Map<string, EnrichedProviderMatch>
): EnrichedProviderMatch {
  const allMatches = Array.from(providerMatches.values());
  if (allMatches.length <= 1) return selected;

  const base = typeof selected.metadata === 'object' && selected.metadata !== null
    ? { ...(selected.metadata as Record<string, unknown>) }
    : {};

  // Merge each field — only override if the selected match's value is missing/empty
  const stringFields = ['coverImage', 'description', 'status', 'publisher', 'url', 'siteDetailUrl', 'wikiUrl'];
  for (const field of stringFields) {
    const current = base[field];
    if (!current || (typeof current === 'string' && current.length === 0)) {
      const val = bestString(allMatches, field);
      if (val !== undefined) base[field] = val;
    }
  }

  const numberFields = ['year', 'chapters', 'volumes'];
  for (const field of numberFields) {
    if (base[field] === undefined || base[field] === null) {
      const val = bestNumber(allMatches, field);
      if (val !== undefined) base[field] = val;
    }
  }

  const arrayFields = ['genres', 'authors', 'artists'];
  for (const field of arrayFields) {
    const current = base[field];
    if (!Array.isArray(current) || current.length === 0) {
      const val = bestArray(allMatches, field);
      if (val !== undefined) base[field] = val;
    }
  }

  // Track which providers contributed
  base['_mergedFrom'] = allMatches.map((m) => m.provider);

  return { ...selected, metadata: base };
}

// ============================================================================
// Navigation Handlers
// ============================================================================

export function handleNavigation(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'GO_TO_STAGE' | 'NEXT_STAGE' | 'PREV_STAGE' | 'RESET' }>): ImportPipelineState {
  switch (action.type) {
    case 'GO_TO_STAGE': return { ...state, stage: action.stage };
    case 'NEXT_STAGE': return { ...state, stage: getNextStage(state.stage) };
    case 'PREV_STAGE': return { ...state, stage: getPrevStage(state.stage) };
    case 'RESET': return initialPipelineState;
    default: return state;
  }
}

export function handleSourceSelection(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'SET_LIBRARY' | 'SET_SCAN_PATH' }>): ImportPipelineState {
  switch (action.type) {
    case 'SET_LIBRARY': return { ...state, selectedLibraryId: action.libraryId };
    case 'SET_SCAN_PATH': return { ...state, scanPath: action.path };
    default: return state;
  }
}

// ============================================================================
// Detect+Match Handlers
// ============================================================================

function handleDetectMatchStart(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'START_DETECT_MATCH' }>): ImportPipelineState {
  return { ...state, stage: 'detect_match', scanJobId: action.jobId, detectMatchProgress: { ...DEFAULT_DETECT_MATCH_PROGRESS, scanStatus: 'Starting scan...' }, scannedItems: [], matchedItems: new Map(), selectedForImport: new Set(), isCancelled: false };
}

/**
 * Compute the cross-row grouping key for an item.
 *   - IN_LIBRARY (duplicate of an existing manga) → `dup:<mangaId>`
 *   - everything else → `nodup:<normalized-title>|<parent-dir>`
 *
 * The scanner emits one row per on-disk folder. A user's library typically
 * has `<Series>/Chapters/Vol NN/` and `<Series>/Volumes/<Series> V NN/`
 * sub-folders that each become their own row. Rolling them up by mangaId
 * (for known series) or by normalized-title+parent (for unknown series)
 * collapses Berserk × 43 → 1, One Piece × 111 → 1, etc.
 */
function groupKeyFor(item: ScannedMangaItem): string {
  if (item.isDuplicate && typeof item.duplicateOfId === 'number') {
    return `dup:${item.duplicateOfId}`;
  }
  const parent = item.path.replace(/\/[^/]+\/?$/, '');
  return `nodup:${normalizeSearchTitle(item.parsedTitle).toLowerCase()}|${parent}`;
}

/** Merge `incoming` into `existing`, summing files/size and tracking source paths. */
function mergeScannedItems(existing: ScannedMangaItem, incoming: ScannedMangaItem): ScannedMangaItem {
  const mergedPaths = existing.mergedPaths ?? [existing.path];
  if (!mergedPaths.includes(incoming.path)) mergedPaths.push(incoming.path);
  const mergedFiles = existing.files !== undefined || incoming.files !== undefined
    ? [...(existing.files ?? []), ...(incoming.files ?? [])]
    : undefined;
  return {
    ...existing,
    fileCount: existing.fileCount + incoming.fileCount,
    fileSize: existing.fileSize + incoming.fileSize,
    ...(mergedFiles !== undefined && { files: mergedFiles }),
    mergedPaths,
    mergedCount: mergedPaths.length,
  };
}

/** Index `scannedItems` by their group key for O(1) merge lookup. */
function buildGroupIndex(items: readonly ScannedMangaItem[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const it of items) {
    const key = groupKeyFor(it);
    if (!out.has(key)) out.set(key, it.id);
  }
  return out;
}

/** Apply a merge of `incoming` into the existing same-key row, returning new scanned + matched maps. */
function applyMerge(
  state: ImportPipelineState,
  newMatchedItems: Map<string, MatchedMangaItem>,
  existingItem: ScannedMangaItem,
  incoming: ScannedMangaItem
): { scanned: ScannedMangaItem[]; matched: Map<string, MatchedMangaItem> } {
  const merged = mergeScannedItems(existingItem, incoming);
  const scanned = state.scannedItems.map((i) => (i.id === existingItem.id ? merged : i));
  const existingMatched = newMatchedItems.get(existingItem.id);
  if (existingMatched) {
    const next: MatchedMangaItem = {
      ...existingMatched,
      fileCount: merged.fileCount,
      fileSize: merged.fileSize,
      lastUpdated: Date.now(),
    };
    if (merged.files !== undefined) next.files = merged.files;
    if (merged.mergedPaths !== undefined) next.mergedPaths = merged.mergedPaths;
    if (merged.mergedCount !== undefined) next.mergedCount = merged.mergedCount;
    newMatchedItems.set(existingItem.id, next);
  }
  return { scanned, matched: newMatchedItems };
}

function handleItemDiscovered(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'ITEM_DISCOVERED' }>): ImportPipelineState {
  const groupIndex = buildGroupIndex(state.scannedItems);
  const incomingKey = groupKeyFor(action.item);
  const existingId = groupIndex.get(incomingKey);
  const existingItem = existingId === undefined ? undefined : state.scannedItems.find((i) => i.id === existingId);

  let newScannedItems: ScannedMangaItem[];
  const newMatchedItems = new Map(state.matchedItems);

  if (existingItem) {
    const out = applyMerge(state, newMatchedItems, existingItem, action.item);
    newScannedItems = out.scanned;
  } else {
    const seeded: ScannedMangaItem = {
      ...action.item,
      mergedPaths: action.item.mergedPaths ?? [action.item.path],
      mergedCount: 1,
    };
    newScannedItems = [...state.scannedItems, seeded];
    newMatchedItems.set(seeded.id, createMatchedItem(seeded));
  }

  const queueCount = newScannedItems.filter((i) => !i.isDuplicate && !i.error).length;
  const matchedCount = Array.from(newMatchedItems.values()).filter((i) => i.status === 'matched' || i.status === 'manual' || i.status === 'no_match').length;
  return { ...state, scannedItems: newScannedItems, matchedItems: newMatchedItems, detectMatchProgress: { ...state.detectMatchProgress, matchTotal: queueCount, matchQueue: queueCount - matchedCount } };
}

/** Collapse an entire batch by group key before initializing matched items. */
function dedupBatch(items: readonly ScannedMangaItem[]): ScannedMangaItem[] {
  const byKey = new Map<string, ScannedMangaItem>();
  for (const it of items) {
    const key = groupKeyFor(it);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, mergeScannedItems(existing, it));
    } else {
      byKey.set(key, { ...it, mergedPaths: it.mergedPaths ?? [it.path], mergedCount: 1 });
    }
  }
  return Array.from(byKey.values());
}

function handleSetScannedItems(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'SET_SCANNED_ITEMS' }>): ImportPipelineState {
  const deduped = dedupBatch(action.items);
  const newMatchedItems = new Map<string, MatchedMangaItem>();
  deduped.forEach((item) => newMatchedItems.set(item.id, createMatchedItem(item)));
  const queueCount = deduped.filter((i) => !i.isDuplicate && !i.error).length;
  return { ...state, scannedItems: deduped, matchedItems: newMatchedItems, detectMatchProgress: { ...state.detectMatchProgress, matchTotal: queueCount, matchQueue: queueCount } };
}

function handleItemMatchStarted(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'ITEM_MATCH_STARTED' }>): ImportPipelineState {
  const newMatchedItems = new Map(state.matchedItems);
  const existing = newMatchedItems.get(action.itemId);
  if (!existing) return state;
  newMatchedItems.set(action.itemId, { ...existing, status: 'matching', isSearching: true, lastUpdated: Date.now() });
  return { ...state, matchedItems: newMatchedItems };
}

function handleItemMatchComplete(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'ITEM_MATCH_COMPLETE' }>): ImportPipelineState {
  const newMatchedItems = new Map(state.matchedItems);
  const existing = newMatchedItems.get(action.itemId);
  if (!existing) return state;
  const confidence = action.match?.confidence ?? 0;
  let status: MatchedMangaItem['status'] = 'no_match';
  if (action.match) {
    if (confidence >= state.confidenceThresholds.high) status = 'matched';
    else if (confidence >= state.confidenceThresholds.low) status = 'low_confidence';
  }
  const providerMatches = selectBestPerProvider(action.availableMatches);
  // Enrich selected match with best fields from all providers
  const enrichedMatch = action.match && providerMatches.size > 1
    ? enrichMatchWithBestFields(action.match, providerMatches)
    : action.match;
  newMatchedItems.set(action.itemId, { ...existing, status, selectedMatch: enrichedMatch, confidence, availableMatches: action.availableMatches, providerMatches, isSearching: false, lastUpdated: Date.now() });
  const matchedCount = Array.from(newMatchedItems.values()).filter((i) => i.status === 'matched' || i.status === 'manual' || i.status === 'no_match' || i.status === 'low_confidence').length;
  const queueCount = state.detectMatchProgress.matchTotal - matchedCount;

  // Auto-select high-confidence matches for import — only on the first transition
  // out of pending/matching, so a late-arriving result can't undo a deliberate
  // user deselection. Rows flagged `requiresManualTitle` are skipped: the
  // backend couldn't derive a real title from filenames or the directory name,
  // so even a fuzzy AniList hit shouldn't be auto-applied — the user must
  // explicitly confirm via the search modal (which clears the flag).
  const newSelectedForImport = new Set(state.selectedForImport);
  const wasInFlight = existing.status === 'pending' || existing.status === 'matching';
  if (action.match && status === 'matched' && wasInFlight && existing.requiresManualTitle !== true) {
    newSelectedForImport.add(action.itemId);
  }

  return { ...state, matchedItems: newMatchedItems, selectedForImport: newSelectedForImport, detectMatchProgress: { ...state.detectMatchProgress, matchCurrent: matchedCount, matchQueue: Math.max(0, queueCount) } };
}

function handleSetItemMatch(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'SET_ITEM_MATCH' }>): ImportPipelineState {
  const newMatchedItems = new Map(state.matchedItems);
  const existing = newMatchedItems.get(action.itemId);
  if (!existing) return state;
  // Manually picking a match counts as user-provided title — clear the
  // requiresManualTitle gate so the row can advance through Import.
  newMatchedItems.set(action.itemId, {
    ...existing,
    selectedMatch: action.match,
    confidence: action.match?.confidence ?? 0,
    availableMatches: action.availableMatches ?? existing.availableMatches,
    status: action.match ? 'manual' : 'unmatched',
    lastUpdated: Date.now(),
    requiresManualTitle: action.match ? false : (existing.requiresManualTitle ?? false),
  });

  // Auto-select item for import when a match is set
  const newSelectedForImport = new Set(state.selectedForImport);
  if (action.match) {
    newSelectedForImport.add(action.itemId);
  } else {
    newSelectedForImport.delete(action.itemId);
  }

  return { ...state, matchedItems: newMatchedItems, selectedForImport: newSelectedForImport };
}

function handleSetItemStatus(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'SET_ITEM_STATUS' }>): ImportPipelineState {
  const newMatchedItems = new Map(state.matchedItems);
  const existing = newMatchedItems.get(action.itemId);
  if (!existing) return state;
  const updatedItem: MatchedMangaItem = { ...existing, status: action.status, lastUpdated: Date.now() };
  if (action.error !== undefined) updatedItem.errorMessage = action.error;
  newMatchedItems.set(action.itemId, updatedItem);
  return { ...state, matchedItems: newMatchedItems };
}

function handleSetItemSearchResults(
  state: ImportPipelineState,
  action: Extract<PipelineAction, { type: 'SET_ITEM_SEARCH_RESULTS' }>
): ImportPipelineState {
  const newMatchedItems = new Map(state.matchedItems);
  const existing = newMatchedItems.get(action.itemId);
  if (!existing) return state;
  // Populate available matches but DO NOT auto-pick a selection. The user
  // must explicitly click a result card to choose. `selectedMatch` and
  // `status` are intentionally left untouched.
  newMatchedItems.set(action.itemId, {
    ...existing,
    availableMatches: action.availableMatches,
    isSearching: false,
    lastUpdated: Date.now(),
  });
  return { ...state, matchedItems: newMatchedItems };
}

function handleSetMissingChaptersResults(
  state: ImportPipelineState,
  action: Extract<PipelineAction, { type: 'SET_MISSING_CHAPTERS_RESULTS' }>
): ImportPipelineState {
  if (action.results.length === 0) return state;
  const byMangaId = new Map<number, number>();
  for (const r of action.results) byMangaId.set(r.mangaId, r.newChapters);
  const newMatchedItems = new Map(state.matchedItems);
  for (const [id, item] of newMatchedItems) {
    if (!item.isDuplicate || typeof item.duplicateOfId !== 'number') continue;
    const n = byMangaId.get(item.duplicateOfId);
    if (n === undefined) continue;
    newMatchedItems.set(id, { ...item, newChapters: n, lastUpdated: Date.now() });
  }
  return { ...state, matchedItems: newMatchedItems };
}

export function handleDetectMatch(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'START_DETECT_MATCH' | 'UPDATE_DETECT_MATCH_PROGRESS' | 'ITEM_DISCOVERED' | 'SET_SCANNED_ITEMS' | 'ITEM_MATCH_STARTED' | 'ITEM_MATCH_COMPLETE' | 'SET_ITEM_MATCH' | 'SET_ITEM_STATUS' | 'SET_MATCHED_ITEMS' | 'DETECT_MATCH_SCAN_COMPLETE' | 'DETECT_MATCH_COMPLETE' | 'CANCEL_DETECT_MATCH' | 'SET_ACTIVE_FILTER' | 'SET_CONFIDENCE_THRESHOLDS' | 'SET_MISSING_CHAPTERS_RESULTS' | 'SET_ITEM_SEARCH_RESULTS' }>): ImportPipelineState {
  switch (action.type) {
    case 'START_DETECT_MATCH': return handleDetectMatchStart(state, action);
    case 'UPDATE_DETECT_MATCH_PROGRESS': return { ...state, detectMatchProgress: { ...state.detectMatchProgress, ...action.progress } };
    case 'ITEM_DISCOVERED': return handleItemDiscovered(state, action);
    case 'SET_SCANNED_ITEMS': return handleSetScannedItems(state, action);
    case 'ITEM_MATCH_STARTED': return handleItemMatchStarted(state, action);
    case 'ITEM_MATCH_COMPLETE': return handleItemMatchComplete(state, action);
    case 'SET_ITEM_MATCH': return handleSetItemMatch(state, action);
    case 'SET_ITEM_STATUS': return handleSetItemStatus(state, action);
    case 'SET_MATCHED_ITEMS': return { ...state, matchedItems: action.items };
    case 'DETECT_MATCH_SCAN_COMPLETE': return { ...state, detectMatchProgress: { ...state.detectMatchProgress, isScanComplete: true, scanStatus: 'Scan complete' } };
    case 'DETECT_MATCH_COMPLETE': return { ...state, detectMatchProgress: { ...state.detectMatchProgress, isScanComplete: true, isMatchComplete: true, scanStatus: 'Complete', matchQueue: 0 } };
    case 'CANCEL_DETECT_MATCH': return { ...state, isCancelled: true, detectMatchProgress: { ...state.detectMatchProgress, scanStatus: 'Cancelled' } };
    case 'SET_ACTIVE_FILTER': return { ...state, activeFilter: action.filter };
    case 'SET_CONFIDENCE_THRESHOLDS': return { ...state, confidenceThresholds: action.thresholds };
    case 'SET_MISSING_CHAPTERS_RESULTS': return handleSetMissingChaptersResults(state, action);
    case 'SET_ITEM_SEARCH_RESULTS': return handleSetItemSearchResults(state, action);
    default: return state;
  }
}

// ============================================================================
// Review and Import Handlers
// ============================================================================

function handleSetItemChapterMappings(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'SET_ITEM_CHAPTER_MAPPINGS' }>): ImportPipelineState {
  const newMatchedItems = new Map(state.matchedItems);
  const existing = newMatchedItems.get(action.itemId);
  if (!existing) return state;
  newMatchedItems.set(action.itemId, { ...existing, chapterMappings: action.mappings, lastUpdated: Date.now() });
  return { ...state, matchedItems: newMatchedItems };
}

export function handleReviewSelection(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'SELECT_FOR_IMPORT' | 'DESELECT_FOR_IMPORT' | 'SELECT_ALL_FOR_IMPORT' | 'DESELECT_ALL_FOR_IMPORT' | 'SET_IMPORT_OPTIONS' | 'SET_ITEM_CHAPTER_MAPPINGS' }>): ImportPipelineState {
  switch (action.type) {
    case 'SELECT_FOR_IMPORT': { const newSelected = new Set(state.selectedForImport); newSelected.add(action.itemId); return { ...state, selectedForImport: newSelected }; }
    case 'DESELECT_FOR_IMPORT': { const newSelected = new Set(state.selectedForImport); newSelected.delete(action.itemId); return { ...state, selectedForImport: newSelected }; }
    case 'SELECT_ALL_FOR_IMPORT': { const allIds = new Set<string>(); state.matchedItems.forEach((item, id) => { if (item.status === 'matched' || item.status === 'manual') allIds.add(id); }); return { ...state, selectedForImport: allIds }; }
    case 'DESELECT_ALL_FOR_IMPORT': return { ...state, selectedForImport: new Set() };
    case 'SET_IMPORT_OPTIONS': return { ...state, importOptions: { ...state.importOptions, ...action.options } };
    case 'SET_ITEM_CHAPTER_MAPPINGS': return handleSetItemChapterMappings(state, action);
    default: return state;
  }
}

export function handleImport(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'START_IMPORT' | 'UPDATE_IMPORT_PROGRESS' | 'SET_IMPORT_RESULT' | 'IMPORT_COMPLETE' | 'CANCEL_IMPORT' }>): ImportPipelineState {
  switch (action.type) {
    case 'START_IMPORT': return { ...state, importProgress: { current: 0, total: state.selectedForImport.size, isImporting: true, isCancelled: false }, importResults: new Map() };
    case 'UPDATE_IMPORT_PROGRESS': return { ...state, importProgress: { ...state.importProgress, ...action.progress } };
    case 'SET_IMPORT_RESULT': { const newResults = new Map(state.importResults); newResults.set(action.result.itemId, action.result); return { ...state, importResults: newResults }; }
    case 'IMPORT_COMPLETE': return { ...state, stage: 'complete', importProgress: { ...state.importProgress, isImporting: false } };
    case 'CANCEL_IMPORT': return { ...state, importProgress: { ...state.importProgress, isCancelled: true, isImporting: false } };
    default: return state;
  }
}

export function handleErrors(state: ImportPipelineState, action: Extract<PipelineAction, { type: 'ADD_ERROR' | 'CLEAR_ERRORS' }>): ImportPipelineState {
  switch (action.type) {
    case 'ADD_ERROR': return { ...state, errors: [...state.errors, action.error] };
    case 'CLEAR_ERRORS': return { ...state, errors: [] };
    default: return state;
  }
}
