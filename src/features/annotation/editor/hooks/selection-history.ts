/**
 * Selection History Hook
 *
 * Manages text selections with undo/redo support.
 * Selections are the source of truth for annotations - labels are derived from them.
 */

import { useCallback, useState } from 'react';

import type { EntityType } from '@/server/ml/features/bio-types';

import type { TextSelection } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single selection action for undo/redo history
 */
export interface SelectionAction {
  type: 'add' | 'remove' | 'update';
  selection: TextSelection;
  previousSelection?: TextSelection; // For update operations
  timestamp: number;
}

const MAX_HISTORY = 50;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for a selection
 */
function generateSelectionId(): string {
  return `sel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Hook
// ============================================================================

interface UseSelectionsWithHistoryReturn {
  /** Add a new selection */
  addSelection: (selection: Omit<TextSelection, 'id' | 'createdAt'>) => TextSelection;
  /** Remove a selection by ID */
  removeSelection: (id: string) => void;
  /** Update the label of an existing selection */
  updateSelectionLabel: (id: string, label: EntityType) => void;
  /** Undo the last action */
  undo: () => void;
  /** Redo the last undone action */
  redo: () => void;
  /** Clear all selections */
  clearSelections: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Undo stack for debugging */
  undoStack: SelectionAction[];
  /** Redo stack for debugging */
  redoStack: SelectionAction[];
}

/**
 * Hook to manage selections with undo/redo support.
 *
 * Usage:
 * ```tsx
 * const [selections, setSelections] = useState<TextSelection[]>([]);
 * const {
 *   addSelection,
 *   removeSelection,
 *   undo,
 *   redo,
 *   canUndo,
 *   canRedo,
 * } = useSelectionsWithHistory(selections, setSelections, setHasChanges);
 * ```
 */
export function useSelectionsWithHistory(
  selections: TextSelection[],
  setSelections: React.Dispatch<React.SetStateAction<TextSelection[]>>,
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>
): UseSelectionsWithHistoryReturn {
  const [undoStack, setUndoStack] = useState<SelectionAction[]>([]);
  const [redoStack, setRedoStack] = useState<SelectionAction[]>([]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  /**
   * Record an action to the undo stack
   */
  const recordAction = useCallback((action: Omit<SelectionAction, 'timestamp'>): void => {
    const fullAction: SelectionAction = {
      ...action,
      timestamp: Date.now(),
    };
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), fullAction]);
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  /**
   * Add a new selection
   */
  const addSelection = useCallback(
    (partial: Omit<TextSelection, 'id' | 'createdAt'>): TextSelection => {
      const selection: TextSelection = {
        ...partial,
        id: generateSelectionId(),
        createdAt: Date.now(),
      };

      setSelections((prev) => [...prev, selection]);
      setHasChanges(true);

      recordAction({
        type: 'add',
        selection,
      });

      return selection;
    },
    [setSelections, setHasChanges, recordAction]
  );

  /**
   * Remove a selection by ID
   */
  const removeSelection = useCallback(
    (id: string): void => {
      const selection = selections.find((s) => s.id === id);
      if (!selection) return;

      setSelections((prev) => prev.filter((s) => s.id !== id));
      setHasChanges(true);

      recordAction({
        type: 'remove',
        selection,
      });
    },
    [selections, setSelections, setHasChanges, recordAction]
  );

  /**
   * Update the label of an existing selection
   */
  const updateSelectionLabel = useCallback(
    (id: string, label: EntityType): void => {
      const selection = selections.find((s) => s.id === id);
      if (!selection) return;

      const updatedSelection: TextSelection = {
        ...selection,
        label,
      };

      setSelections((prev) => prev.map((s) => (s.id === id ? updatedSelection : s)));
      setHasChanges(true);

      recordAction({
        type: 'update',
        selection: updatedSelection,
        previousSelection: selection,
      });
    },
    [selections, setSelections, setHasChanges, recordAction]
  );

  /**
   * Undo the last action
   */
  const undo = useCallback((): void => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    if (!action) return;

    // Apply reverse of action
    switch (action.type) {
      case 'add':
        // Remove the added selection
        setSelections((prev) => prev.filter((s) => s.id !== action.selection.id));
        break;
      case 'remove':
        // Re-add the removed selection
        setSelections((prev) => [...prev, action.selection]);
        break;
      case 'update': {
        // Restore the previous selection
        const prevSel = action.previousSelection;
        if (prevSel) {
          setSelections((prev) =>
            prev.map((s) => (s.id === action.selection.id ? prevSel : s))
          );
        }
        break;
      }
      default:
        break;
    }

    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, action]);
    setHasChanges(true);
  }, [undoStack, setSelections, setHasChanges]);

  /**
   * Redo the last undone action
   */
  const redo = useCallback((): void => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    if (!action) return;

    // Re-apply the action
    switch (action.type) {
      case 'add':
        // Re-add the selection
        setSelections((prev) => [...prev, action.selection]);
        break;
      case 'remove':
        // Remove the selection again
        setSelections((prev) => prev.filter((s) => s.id !== action.selection.id));
        break;
      case 'update':
        // Apply the updated selection
        setSelections((prev) =>
          prev.map((s) => (s.id === action.selection.id ? action.selection : s))
        );
        break;
      default:
        break;
    }

    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, action]);
    setHasChanges(true);
  }, [redoStack, setSelections, setHasChanges]);

  /**
   * Clear all selections (without adding to history)
   */
  const clearSelections = useCallback((): void => {
    setSelections([]);
    setUndoStack([]);
    setRedoStack([]);
    setHasChanges(true);
  }, [setSelections, setHasChanges]);

  return {
    addSelection,
    removeSelection,
    updateSelectionLabel,
    undo,
    redo,
    clearSelections,
    canUndo,
    canRedo,
    undoStack,
    redoStack,
  };
}
