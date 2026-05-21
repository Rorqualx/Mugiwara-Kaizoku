/**
 * Annotation Editor Hooks
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { BIOTag, EntityType } from '@/server/ml/features/bio-types';

export { useKeyboardShortcuts } from './hooks/keyboard-shortcuts';
export type { NavigationCallbacks } from './hooks/keyboard-shortcuts';

export { useSelectionsWithHistory } from './hooks/selection-history';
export type { SelectionAction } from './hooks/selection-history';

export {
  useComputeLabelsFromSelections,
  computeLabelsFromSelections,
  computeEntityCountsFromSelections,
} from './hooks/compute-labels';

import type { DisplayToken } from './types';

// ============================================================================
// Undo/Redo Types
// ============================================================================

/**
 * Represents a single label action for undo/redo history
 */
export interface LabelAction {
  type: 'apply' | 'clear';
  indices: number[];
  previousLabels: BIOTag[];
  newLabels: BIOTag[];
  timestamp: number;
  entityType: EntityType | undefined;
}

/**
 * History state for undo/redo functionality
 */
export interface HistoryState {
  undoStack: LabelAction[];
  redoStack: LabelAction[];
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_HISTORY = 50;

// ============================================================================
// Undo/Redo Token Update Helpers
// ============================================================================

/** Apply previous labels to tokens (for undo operation) */
function applyPreviousLabels(
  tokens: DisplayToken[],
  action: LabelAction
): DisplayToken[] {
  const next = [...tokens];
  action.indices.forEach((tokenIdx, i) => {
    const prevLabel = action.previousLabels[i];
    if (next[tokenIdx] && prevLabel !== undefined) {
      next[tokenIdx] = { ...next[tokenIdx], label: prevLabel };
    }
  });
  return next;
}

/** Apply new labels to tokens (for redo operation) */
function applyNewLabels(
  tokens: DisplayToken[],
  action: LabelAction
): DisplayToken[] {
  const next = [...tokens];
  action.indices.forEach((tokenIdx, i) => {
    const newLabel = action.newLabels[i];
    if (next[tokenIdx] && newLabel !== undefined) {
      next[tokenIdx] = { ...next[tokenIdx], label: newLabel };
    }
  });
  return next;
}

interface SelectionState {
  selectedTokens: Set<number>;
  setSelectedTokens: React.Dispatch<React.SetStateAction<Set<number>>>;
  lastSelectedIndex: number | null;
  setLastSelectedIndex: React.Dispatch<React.SetStateAction<number | null>>;
}

// ============================================================================
// Selection Helpers
// ============================================================================

function addRangeToSelection(
  prev: Set<number>,
  lastIndex: number,
  currentIndex: number
): Set<number> {
  const next = new Set(prev);
  const start = Math.min(lastIndex, currentIndex);
  const end = Math.max(lastIndex, currentIndex);
  for (let i = start; i <= end; i++) {
    next.add(i);
  }
  return next;
}

function toggleSelection(prev: Set<number>, index: number): Set<number> {
  const next = new Set(prev);
  if (next.has(index)) {
    next.delete(index);
  } else {
    next.add(index);
  }
  return next;
}

// ============================================================================
// Token Click Hook
// ============================================================================

export function useTokenClick(
  selectionState: SelectionState
): (index: number, shiftKey: boolean) => void {
  const { setSelectedTokens, lastSelectedIndex, setLastSelectedIndex } = selectionState;

  return useCallback(
    (index: number, shiftKey: boolean): void => {
      setSelectedTokens((prev) => {
        if (shiftKey && lastSelectedIndex !== null) {
          return addRangeToSelection(prev, lastSelectedIndex, index);
        }
        return toggleSelection(prev, index);
      });
      setLastSelectedIndex(index);
    },
    [lastSelectedIndex, setSelectedTokens, setLastSelectedIndex]
  );
}

// ============================================================================
// Initialize Tokens Hook
// ============================================================================

/** Raw token from the API — contains all linearized fields from the database */
type ApiToken = Record<string, unknown> & {
  id: string;
  text: string;
  tagName: string;
  xpath?: string | null;
  isImage?: boolean;
  imageSrc?: string | null;
  imageAlt?: string | null;
};

export function useInitializeTokens(
  pageData: { tokens: unknown; labels: unknown } | undefined,
  setTokens: React.Dispatch<React.SetStateAction<DisplayToken[]>>,
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>
): void {
  useEffect(() => {
    if (!pageData?.tokens || !pageData.labels) return;

    const apiTokens = pageData.tokens as ApiToken[];
    const apiLabels = pageData.labels as string[];

    const displayTokens: DisplayToken[] = apiTokens.map((t, i) => ({
      // Spread all token fields from the API (text features, styling, DOM structure, etc.)
      ...t,
      // Override/ensure core required fields
      label: (apiLabels[i] ?? 'O') as BIOTag,
      index: i,
      xpath: t.xpath ?? null,
      isImage: t.isImage ?? false,
      imageSrc: t.imageSrc ?? null,
      imageAlt: t.imageAlt ?? null,
    }));

    setTokens(displayTokens);
    setHasChanges(false);
  }, [pageData, setTokens, setHasChanges]);
}

// ============================================================================
// Undo/Redo Hook
// ============================================================================

interface UndoRedoCallbacks {
  onUndo?: (action: LabelAction) => void;
  onRedo?: (action: LabelAction) => void;
}

interface UndoRedoReturn {
  undoStack: LabelAction[];
  redoStack: LabelAction[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  recordAction: (action: Omit<LabelAction, 'timestamp'>) => void;
  clearHistory: () => void;
}

/**
 * Hook to manage undo/redo history for label operations
 */
export function useUndoRedo(
  setTokens: React.Dispatch<React.SetStateAction<DisplayToken[]>>,
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>,
  callbacks?: UndoRedoCallbacks
): UndoRedoReturn {
  const [undoStack, setUndoStack] = useState<LabelAction[]>([]);
  const [redoStack, setRedoStack] = useState<LabelAction[]>([]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const recordAction = useCallback((action: Omit<LabelAction, 'timestamp'>): void => {
    const fullAction: LabelAction = {
      ...action,
      timestamp: Date.now(),
    };
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), fullAction]);
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  // Use ref to store callbacks to avoid stale closure issues
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const undo = useCallback((): void => {
    // Use functional update to access current undo stack and avoid stale closure
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;

      const action = prevUndo[prevUndo.length - 1];
      if (!action) return prevUndo;

      // Restore previous labels using extracted helper
      setTokens((prevTokens) => applyPreviousLabels(prevTokens, action));

      // Move to redo stack
      setRedoStack((prevRedo) => [...prevRedo, action]);
      setHasChanges(true);
      callbacksRef.current?.onUndo?.(action);

      return prevUndo.slice(0, -1);
    });
  }, [setTokens, setHasChanges]);

  const redo = useCallback((): void => {
    // Use functional update to access current redo stack and avoid stale closure
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;

      const action = prevRedo[prevRedo.length - 1];
      if (!action) return prevRedo;

      // Reapply new labels using extracted helper
      setTokens((prevTokens) => applyNewLabels(prevTokens, action));

      // Move back to undo stack
      setUndoStack((prevUndo) => [...prevUndo, action]);
      setHasChanges(true);
      callbacksRef.current?.onRedo?.(action);

      return prevRedo.slice(0, -1);
    });
  }, [setTokens, setHasChanges]);

  const clearHistory = useCallback((): void => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    undo,
    redo,
    recordAction,
    clearHistory,
  };
}

// ============================================================================
// Apply Label with History Hook
// ============================================================================

interface ApplyLabelWithHistoryReturn {
  applyLabel: (entity: EntityType | null) => void;
  applyLabelToIndices: (entity: EntityType | null, indices: number[]) => void;
}

/** Options for useApplyLabelWithHistory hook */
export interface ApplyLabelWithHistoryOptions {
  tokens: DisplayToken[];
  setTokens: React.Dispatch<React.SetStateAction<DisplayToken[]>>;
  selectedTokens: Set<number>;
  setSelectedTokens: React.Dispatch<React.SetStateAction<Set<number>>>;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  recordAction: (action: Omit<LabelAction, 'timestamp'>) => void;
  /** 'B' for Begin or 'I' for Inside prefix */
  bioPrefix?: 'B' | 'I';
  /** Callback after label is applied (for auto-switching B→I) */
  onLabelApplied?: () => void;
}

/**
 * Hook that wraps label application with history tracking.
 * Uses explicit B/I prefix provided by user (no auto-propagation).
 */
export function useApplyLabelWithHistory(options: ApplyLabelWithHistoryOptions): ApplyLabelWithHistoryReturn {
  const {
    tokens,
    setTokens,
    selectedTokens,
    setSelectedTokens,
    setHasChanges,
    recordAction,
    bioPrefix = 'B',
    onLabelApplied,
  } = options;

  // Use ref to always get latest bioPrefix (avoids stale closure issues with rapid clicks)
  const bioPrefixRef = useRef(bioPrefix);
  bioPrefixRef.current = bioPrefix;

  const applyLabel = useCallback(
    (entity: EntityType | null): void => {
      if (selectedTokens.size === 0) return;

      const sortedIndices = Array.from(selectedTokens).sort((a, b) => a - b);

      // Build labels: B mode applies B to first, I to rest; I mode applies I to all
      const allIndices = sortedIndices;
      const allPreviousLabels: BIOTag[] = [];
      const allNewLabels: BIOTag[] = [];

      // Get current bioPrefix from ref to avoid stale closure
      const currentPrefix = bioPrefixRef.current;

      for (let i = 0; i < allIndices.length; i++) {
        const tokenIdx = allIndices[i];
        allPreviousLabels.push(tokens[tokenIdx ?? 0]?.label ?? 'O');
        if (entity) {
          // B mode: first token gets B, rest get I
          // I mode: all tokens get I
          const prefix = currentPrefix === 'B' && i === 0 ? 'B' : 'I';
          allNewLabels.push(`${prefix}-${entity}`);
        } else {
          allNewLabels.push('O');
        }
      }

      // Record action for undo/redo
      recordAction({
        type: entity ? 'apply' : 'clear',
        indices: allIndices,
        previousLabels: allPreviousLabels,
        newLabels: allNewLabels,
        entityType: entity ?? undefined,
      });

      // Build a map of index -> new label for quick access
      const labelMap = new Map<number, BIOTag>();
      for (let i = 0; i < allIndices.length; i++) {
        const idx = allIndices[i];
        const label = allNewLabels[i];
        if (idx !== undefined && label !== undefined) {
          labelMap.set(idx, label);
        }
      }

      // Apply new labels to all tokens
      setTokens((prev) =>
        prev.map((token) => {
          if (!selectedTokens.has(token.index)) return token;
          const newLabel = labelMap.get(token.index);
          return newLabel !== undefined ? { ...token, label: newLabel } : token;
        })
      );

      setSelectedTokens(new Set());
      setHasChanges(true);

      // Auto-switch B→I: update ref immediately (before React re-renders)
      if (currentPrefix === 'B') {
        bioPrefixRef.current = 'I';
      }
      // Notify parent to sync state
      onLabelApplied?.();
    },
    [tokens, selectedTokens, setTokens, setSelectedTokens, setHasChanges, recordAction, onLabelApplied]
  );

  const applyLabelToIndices = useCallback(
    (entity: EntityType | null, indices: number[]): void => {
      if (indices.length === 0) return;

      const sortedIndices = [...indices].sort((a, b) => a - b);

      // Build labels: B mode applies B to first, I to rest; I mode applies I to all
      const allIndices = sortedIndices;
      const allPreviousLabels: BIOTag[] = [];
      const allNewLabels: BIOTag[] = [];

      // Get current bioPrefix from ref to avoid stale closure
      const currentPrefix = bioPrefixRef.current;

      for (let i = 0; i < allIndices.length; i++) {
        const tokenIdx = allIndices[i];
        allPreviousLabels.push(tokens[tokenIdx ?? 0]?.label ?? 'O');
        if (entity) {
          // B mode: first token gets B, rest get I
          // I mode: all tokens get I
          const prefix = currentPrefix === 'B' && i === 0 ? 'B' : 'I';
          allNewLabels.push(`${prefix}-${entity}`);
        } else {
          allNewLabels.push('O');
        }
      }

      // Record action for undo/redo
      recordAction({
        type: entity ? 'apply' : 'clear',
        indices: allIndices,
        previousLabels: allPreviousLabels,
        newLabels: allNewLabels,
        entityType: entity ?? undefined,
      });

      // Build a map of index -> new label for quick access
      const labelMap = new Map<number, BIOTag>();
      for (let i = 0; i < allIndices.length; i++) {
        const idx = allIndices[i];
        const label = allNewLabels[i];
        if (idx !== undefined && label !== undefined) {
          labelMap.set(idx, label);
        }
      }

      // Apply new labels to all tokens
      const indicesToUpdate = new Set(allIndices);
      setTokens((prev) =>
        prev.map((token) => {
          if (!indicesToUpdate.has(token.index)) return token;
          const newLabel = labelMap.get(token.index);
          return newLabel !== undefined ? { ...token, label: newLabel } : token;
        })
      );

      setHasChanges(true);

      // Auto-switch B→I: update ref immediately (before React re-renders)
      if (currentPrefix === 'B') {
        bioPrefixRef.current = 'I';
      }
      // Notify parent to sync state
      onLabelApplied?.();
    },
    [tokens, setTokens, setHasChanges, recordAction, onLabelApplied]
  );

  return { applyLabel, applyLabelToIndices };
}
