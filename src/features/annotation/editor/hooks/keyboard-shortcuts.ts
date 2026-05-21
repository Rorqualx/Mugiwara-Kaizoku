/**
 * Keyboard Shortcuts Hook
 *
 * Handles keyboard shortcuts for B/I mode switching, clear, and navigation.
 * Entity shortcuts removed - use B/I toggle + entity palette buttons.
 */

import { useEffect } from 'react';

import type { EntityType } from '@/server/ml/features/bio-types';

import { BIO_MODE_SHORTCUTS, CLEAR_SHORTCUT } from '../types';

import type { BioMode } from '../types';

/**
 * Navigation callbacks for keyboard navigation shortcuts
 */
export interface NavigationCallbacks {
  nextUnlabeled: () => void;
  prevUnlabeled: () => void;
  gotoToken: () => void;
  showLabeledOnly?: () => void;
  showUnlabeledOnly?: () => void;
}

/** Check if event target is an input element */
function isInputElement(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/** Handle Ctrl/Cmd navigation shortcuts, returns true if handled */
function handleNavShortcut(e: KeyboardEvent, key: string, navigation?: NavigationCallbacks): boolean {
  if (!navigation) return false;

  const navHandlers: Record<string, (() => void) | undefined> = {
    n: navigation.nextUnlabeled,
    p: navigation.prevUnlabeled,
    g: navigation.gotoToken,
    l: navigation.showLabeledOnly,
    u: navigation.showUnlabeledOnly,
  };

  const handler = navHandlers[key];
  if (handler) {
    e.preventDefault();
    handler();
    return true;
  }
  return false;
}

export function useKeyboardShortcuts(
  applyLabel: (entity: EntityType | null) => void,
  clearSelection: () => void,
  clearBrush?: () => void,
  navigation?: NavigationCallbacks,
  setBioPrefix?: (prefix: BioMode) => void
): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (isInputElement(e.target)) return;

      const key = e.key.toLowerCase();

      // Navigation shortcuts (Ctrl+key or Cmd+key on Mac)
      if (e.ctrlKey || e.metaKey) {
        handleNavShortcut(e, key, navigation);
        return; // Skip other shortcuts when Ctrl/Cmd is held
      }

      // Escape handling
      if (e.key === 'Escape') {
        clearSelection();
        clearBrush?.();
        return;
      }

      // Clear label (O key)
      if (key === CLEAR_SHORTCUT) {
        applyLabel(null);
        return;
      }

      // B/I mode switching
      const bioMode = BIO_MODE_SHORTCUTS[key];
      if (bioMode && setBioPrefix) {
        setBioPrefix(bioMode);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [applyLabel, clearSelection, clearBrush, navigation, setBioPrefix]);
}
