import { renderHook, act } from '@testing-library/react';

// Mock the logger module - must be before importing modules that use it
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

import { logger } from '@/utils/logger';

import { useHapticFeedback } from '../useHapticFeedback';

describe('useHapticFeedback', () => {
  let originalNavigator: Navigator;
  let vibrateMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Save original navigator
    originalNavigator = window.navigator;

    // Mock navigator.vibrate
    vibrateMock = jest.fn().mockReturnValue(true);

    // Create a new navigator object with vibrate
    const navigatorMock = Object.create(originalNavigator, {
      userAgent: {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive fallback for test environments
        value: originalNavigator.userAgent ?? 'Mozilla/5.0 (test)',
        writable: true,
        configurable: true,
        enumerable: true
      },
      vibrate: {
        value: vibrateMock,
        writable: true,
        configurable: true,
        enumerable: true
      }
    });

    Object.defineProperty(window, 'navigator', {
      value: navigatorMock,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true
    });
  });

  it('should detect vibration support correctly', () => {
    const { result } = renderHook(() => useHapticFeedback());
    expect(result.current.isSupported).toBe(true);
  });

  it('should handle no vibration support', () => {
    // Create a navigator without the 'vibrate' property at all
    // by using an object that doesn't inherit from the original
    const navigatorWithoutVibrate: Record<string, unknown> = {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive fallback for test environments
      userAgent: originalNavigator.userAgent ?? 'Mozilla/5.0 (test)',
      language: originalNavigator.language,
    };

    Object.defineProperty(window, 'navigator', {
      value: navigatorWithoutVibrate,
      writable: true,
      configurable: true
    });

    const { result } = renderHook(() => useHapticFeedback());
    expect(result.current.isSupported).toBe(false);
  });

  it('should vibrate with light intensity', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.trigger('light');
    });

    expect(vibrateMock).toHaveBeenCalledWith(10);
  });

  it('should vibrate with medium intensity', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.trigger('medium');
    });

    expect(vibrateMock).toHaveBeenCalledWith(20);
  });

  it('should vibrate with heavy intensity', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.trigger('heavy');
    });

    expect(vibrateMock).toHaveBeenCalledWith(30);
  });

  it('should vibrate with soft pattern', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.trigger('soft');
    });

    expect(vibrateMock).toHaveBeenCalledWith([10, 10]);
  });

  it('should not vibrate when support is not available', () => {
    // Create a navigator without the 'vibrate' property
    const navigatorWithoutVibrate: Record<string, unknown> = {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive fallback for test environments
      userAgent: originalNavigator.userAgent ?? 'Mozilla/5.0 (test)',
      language: originalNavigator.language,
    };

    Object.defineProperty(window, 'navigator', {
      value: navigatorWithoutVibrate,
      writable: true,
      configurable: true
    });

    // Disable visual fallback to avoid animate() not supported in test env
    const { result } = renderHook(() => useHapticFeedback({ fallbackToVisual: false }));

    act(() => {
      result.current.trigger('light');
    });

    // vibrateMock should not be called since navigator.vibrate doesn't exist
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('should handle vibrate function returning false', () => {
    vibrateMock.mockReturnValue(false);

    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.trigger('light');
    });

    expect(vibrateMock).toHaveBeenCalledWith(10);
  });

  it('should handle errors gracefully', () => {
    vibrateMock.mockImplementation(() => {
      throw new Error('Vibration failed');
    });

    const { result } = renderHook(() => useHapticFeedback());

    // Should not throw
    act(() => {
      result.current.trigger('light');
    });

    expect(logger.warn).toHaveBeenCalledWith('Haptic feedback failed:', expect.any(Error));
  });

  it('should respect user preferences when available', () => {
    // This would require mocking a preference API if implemented
    // For now, just ensure the hook works without preferences
    const { result } = renderHook(() => useHapticFeedback());
    
    expect(result.current).toBeDefined();
    expect(result.current.trigger).toBeDefined();
    expect(result.current.isSupported).toBeDefined();
    expect(result.current.isEnabled).toBeDefined();
  });
});