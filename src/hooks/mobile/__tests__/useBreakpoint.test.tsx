/**
 * useBreakpoint Hook Tests
 */

// Unmock the hook to test the real implementation (global mock in custom-hooks-mock.ts)
jest.unmock('@/hooks/mobile/useBreakpoint');

import { jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';

import { useBreakpoint } from '../useBreakpoint';

// Setup window mock BEFORE any tests run
beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1024
  });
});

describe('useBreakpoint Hook', () => {
  beforeEach(() => {
    // Reset window width to default for each test
    window.innerWidth = 1024;
    // Use fake timers for consistent debounce testing
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return current breakpoint on mount', () => {
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.current).toBe('lg');
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
  });

  it('should update breakpoint on window resize', () => {
    const { result } = renderHook(() => useBreakpoint());

    // Initial state
    expect(result.current.current).toBe('lg');

    // Simulate resize to mobile
    act(() => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));
      // Fast-forward timers to execute debounce
      jest.advanceTimersByTime(150);
    });

    expect(result.current.current).toBe('xs');
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('should correctly identify mobile breakpoints', () => {
    // Test xs breakpoint
    window.innerWidth = 400;
    const { result: xsResult } = renderHook(() => useBreakpoint());
    expect(xsResult.current.isMobile).toBe(true);

    // Test sm breakpoint
    window.innerWidth = 700;
    const { result: smResult } = renderHook(() => useBreakpoint());
    expect(smResult.current.isMobile).toBe(true);
  });

  it('should correctly identify tablet breakpoint', () => {
    window.innerWidth = 850;
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.current).toBe('md');
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('should correctly identify desktop breakpoints', () => {
    // Test lg breakpoint
    window.innerWidth = 1100;
    const { result: lgResult } = renderHook(() => useBreakpoint());
    expect(lgResult.current.isDesktop).toBe(true);

    // Test xl breakpoint
    window.innerWidth = 1500;
    const { result: xlResult } = renderHook(() => useBreakpoint());
    expect(xlResult.current.isDesktop).toBe(true);
  });

  it('should provide working utility functions', () => {
    window.innerWidth = 800; // md breakpoint
    const { result } = renderHook(() => useBreakpoint());

    // Test isDown
    expect(result.current.isDown('sm')).toBe(false); // 800 >= 768
    expect(result.current.isDown('lg')).toBe(true);  // 800 < 1200

    // Test isUp
    expect(result.current.isUp('sm')).toBe(true);   // 800 >= 768
    expect(result.current.isUp('lg')).toBe(false);  // 800 < 1200

    // Test isBetween
    expect(result.current.isBetween('sm', 'lg')).toBe(true);  // 768 <= 800 < 1200
    expect(result.current.isBetween('lg', 'xl')).toBe(false); // 800 < 1200
  });

  it('should debounce resize events', () => {
    const { result } = renderHook(() => useBreakpoint());

    // Initial state
    expect(result.current.current).toBe('lg');

    // Trigger multiple resize events rapidly
    act(() => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('resize'));
    });

    // Should not update immediately (debounced)
    expect(result.current.current).toBe('lg');

    // Fast-forward timers to complete debounce
    act(() => {
      jest.advanceTimersByTime(150);
    });

    expect(result.current.current).toBe('xs');
  });

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useBreakpoint());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });
});
