/**
 * Keyboard Effects for Annotation Editor
 *
 * Extracts keyboard event handlers (undo/redo, tool shortcuts) from main component.
 */

import { useEffect } from 'react';

import type { SelectionToolType } from '@/features/annotation/editor';
import { TOOL_SHORTCUTS } from '@/features/annotation/editor';

// ============================================================================
// useUndoRedoKeyboard
// ============================================================================

export function useUndoRedoKeyboard(undo: () => void, redo: () => void): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);
}

// ============================================================================
// useToolKeyboard
// ============================================================================

export function useToolKeyboard(
  activeTab: string | null,
  activeTool: SelectionToolType,
  setActiveTool: (tool: SelectionToolType) => void
): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (activeTab !== 'page') return;

      const tool = TOOL_SHORTCUTS[e.key];
      if (tool) {
        e.preventDefault();
        setActiveTool(tool);
        return;
      }

      if (e.key === 'Escape' && activeTool !== null) {
        e.preventDefault();
        setActiveTool(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, activeTool, setActiveTool]);
}
