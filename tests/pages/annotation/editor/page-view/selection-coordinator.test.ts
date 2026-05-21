/**
 * Test 4: Race Condition Handling (Selection Coordinator)
 *
 * Tests for the selection coordinator that prevents race conditions
 * between selection events and click events.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock requestAnimationFrame
let rafCallbacks: FrameRequestCallback[] = [];
const mockRaf = jest.fn((callback: FrameRequestCallback) => {
  rafCallbacks.push(callback);
  return rafCallbacks.length;
});

// Helper to flush RAF callbacks
function flushRaf(): void {
  const callbacks = [...rafCallbacks];
  rafCallbacks = [];
  callbacks.forEach(cb => cb(performance.now()));
}

// The selection coordinator implementation (as in helpers.ts)
interface SelectionCoordinator {
  handlingSelection: boolean;
  startSelection: () => void;
  endSelection: () => void;
  shouldHandleClick: () => boolean;
}

function createSelectionCoordinator(
  raf: (cb: FrameRequestCallback) => number,
  getSelection: () => { isCollapsed: boolean; toString: () => string } | null
): SelectionCoordinator {
  const coordinator: SelectionCoordinator = {
    handlingSelection: false,

    startSelection(): void {
      this.handlingSelection = true;
    },

    endSelection(): void {
      const self = this;
      // Double RAF ensures click event has fully processed
      raf(() => {
        raf(() => {
          self.handlingSelection = false;
        });
      });
    },

    shouldHandleClick(): boolean {
      if (this.handlingSelection) return false;
      const selection = getSelection();
      return !selection || selection.isCollapsed || !selection.toString().trim();
    },
  };

  return coordinator;
}

describe('Selection Coordinator (Race Condition Handling)', () => {
  let coordinator: SelectionCoordinator;
  let mockGetSelection: jest.Mock<() => { isCollapsed: boolean; toString: () => string } | null>;

  beforeEach(() => {
    rafCallbacks = [];
    mockRaf.mockClear();
    mockGetSelection = jest.fn(() => ({ isCollapsed: true, toString: () => '' }));
    coordinator = createSelectionCoordinator(mockRaf, mockGetSelection);
  });

  describe('startSelection', () => {
    it('should set handlingSelection to true', () => {
      expect(coordinator.handlingSelection).toBe(false);
      coordinator.startSelection();
      expect(coordinator.handlingSelection).toBe(true);
    });
  });

  describe('endSelection', () => {
    it('should use double RAF to clear handlingSelection', () => {
      coordinator.startSelection();
      expect(coordinator.handlingSelection).toBe(true);

      coordinator.endSelection();
      // First RAF scheduled
      expect(mockRaf).toHaveBeenCalledTimes(1);
      expect(coordinator.handlingSelection).toBe(true);

      // Execute first RAF
      flushRaf();
      // Second RAF scheduled
      expect(mockRaf).toHaveBeenCalledTimes(2);
      expect(coordinator.handlingSelection).toBe(true);

      // Execute second RAF
      flushRaf();
      expect(coordinator.handlingSelection).toBe(false);
    });

    it('should not immediately clear handlingSelection', () => {
      coordinator.startSelection();
      coordinator.endSelection();
      // Still true because RAF hasn't executed
      expect(coordinator.handlingSelection).toBe(true);
    });
  });

  describe('shouldHandleClick', () => {
    it('should return false during active selection', () => {
      coordinator.startSelection();
      expect(coordinator.shouldHandleClick()).toBe(false);
    });

    it('should return true when no selection is active', () => {
      expect(coordinator.shouldHandleClick()).toBe(true);
    });

    it('should return true after selection ends (RAF completes)', () => {
      coordinator.startSelection();
      coordinator.endSelection();

      // Before RAF
      expect(coordinator.shouldHandleClick()).toBe(false);

      // After double RAF
      flushRaf();
      flushRaf();
      expect(coordinator.shouldHandleClick()).toBe(true);
    });

    it('should return false when text is selected', () => {
      mockGetSelection.mockReturnValue({
        isCollapsed: false,
        toString: () => 'selected text',
      });
      expect(coordinator.shouldHandleClick()).toBe(false);
    });

    it('should return true when selection is collapsed', () => {
      mockGetSelection.mockReturnValue({
        isCollapsed: true,
        toString: () => '',
      });
      expect(coordinator.shouldHandleClick()).toBe(true);
    });

    it('should return true when getSelection returns null', () => {
      mockGetSelection.mockReturnValue(null);
      expect(coordinator.shouldHandleClick()).toBe(true);
    });

    it('should return true when selected text is only whitespace', () => {
      mockGetSelection.mockReturnValue({
        isCollapsed: false,
        toString: () => '   ',
      });
      expect(coordinator.shouldHandleClick()).toBe(true);
    });
  });

  describe('rapid sequential operations', () => {
    it('should handle start/end cycles correctly', () => {
      // First cycle
      coordinator.startSelection();
      expect(coordinator.handlingSelection).toBe(true);
      coordinator.endSelection();
      flushRaf();
      flushRaf();
      expect(coordinator.handlingSelection).toBe(false);

      // Second cycle
      coordinator.startSelection();
      expect(coordinator.handlingSelection).toBe(true);
      coordinator.endSelection();
      flushRaf();
      flushRaf();
      expect(coordinator.handlingSelection).toBe(false);
    });

    it('should handle multiple startSelection calls', () => {
      coordinator.startSelection();
      coordinator.startSelection();
      coordinator.startSelection();
      expect(coordinator.handlingSelection).toBe(true);

      coordinator.endSelection();
      flushRaf();
      flushRaf();
      expect(coordinator.handlingSelection).toBe(false);
    });

    it('should handle endSelection without startSelection', () => {
      // endSelection when not started should still work
      coordinator.endSelection();
      flushRaf();
      flushRaf();
      expect(coordinator.handlingSelection).toBe(false);
    });
  });

  describe('timing behavior', () => {
    it('should prevent click during selection processing', () => {
      // Start selection
      coordinator.startSelection();

      // Try to handle click - should be blocked
      expect(coordinator.shouldHandleClick()).toBe(false);

      // End selection
      coordinator.endSelection();

      // Click should still be blocked during RAF delay
      expect(coordinator.shouldHandleClick()).toBe(false);

      // First RAF - still blocked
      flushRaf();
      expect(coordinator.shouldHandleClick()).toBe(false);

      // Second RAF - now allowed
      flushRaf();
      expect(coordinator.shouldHandleClick()).toBe(true);
    });
  });
});
