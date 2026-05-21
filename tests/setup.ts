/// <reference types="bun-types" />
/**
 * Bun Test Setup
 *
 * This file provides Jest compatibility helpers for Bun's test runner.
 * Preloaded by bunfig.toml for all tests.
 *
 * Provides:
 * - Happy-DOM for browser environment (DOM, window, document, navigator)
 * - jest.mocked() polyfill
 * - jest.requireActual() polyfill
 * - jest.advanceTimersByTime() polyfill (stub)
 * - Global logger mock for test isolation
 */

// Import and register Happy-DOM FIRST for browser environment
import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Register Happy-DOM globally - this provides window, document, navigator, etc.
GlobalRegistrator.register();

// Import jest from @jest/globals to extend it
import { jest } from '@jest/globals';
import { mock } from 'bun:test';

// Import jest-dom matchers for DOM assertions (toBeInTheDocument, etc.)
import '@testing-library/jest-dom';

// Note: @testing-library/react automatically calls cleanup after each test
// when using Jest. In Bun, this is also handled automatically.
// See: https://testing-library.com/docs/react-testing-library/api/#cleanup

// ============================================================================
// Global Logger Mock
// ============================================================================

// Create a mock logger that can be used across all tests
// This prevents "logger.child is not a function" errors
const createMockLogger = (): Record<string, unknown> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => createMockLogger()),
  setContext: jest.fn(),
});

// Mock the logger module globally using Bun's native mock
mock.module('@/utils/logger', () => ({
  logger: createMockLogger(),
  createLogger: jest.fn(() => createMockLogger()),
  getLogger: jest.fn(() => createMockLogger()),
  createChildLogger: jest.fn(() => createMockLogger()),
}));

// ============================================================================
// Jest Polyfills for Bun Compatibility
// ============================================================================

// Add jest.mocked helper for Bun compatibility
// In Jest 27.4+, jest.mocked is a type helper that casts functions to MockedFunction
// Bun doesn't provide this, so we add it here
if (!('mocked' in jest)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for compatibility layer
  (jest as any).mocked = <T>(source: T): T => source;
}

// Add jest.requireActual polyfill
// Used by tests to get the actual module implementation when mocking
if (!('requireActual' in jest)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for compatibility layer
  (jest as any).requireActual = (moduleName: string): unknown => {
    // In Bun, we can't dynamically require, so return empty object
    // Tests using requireActual should be updated to not rely on it
    console.warn(`jest.requireActual('${moduleName}') called - returning empty object in Bun`);
    return {};
  };
}

// Add jest.advanceTimersByTime polyfill (stub)
// Bun doesn't support fake timers the same way Jest does
if (!('advanceTimersByTime' in jest)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for compatibility layer
  (jest as any).advanceTimersByTime = (_ms: number): void => {
    console.warn('jest.advanceTimersByTime() called - not supported in Bun, skipping');
  };
}

// Add jest.useFakeTimers polyfill (stub)
if (!('useFakeTimers' in jest)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for compatibility layer
  (jest as any).useFakeTimers = (): typeof jest => {
    console.warn('jest.useFakeTimers() called - not supported in Bun');
    return jest;
  };
}

// Add jest.useRealTimers polyfill (stub)
if (!('useRealTimers' in jest)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for compatibility layer
  (jest as any).useRealTimers = (): typeof jest => {
    return jest;
  };
}

// ============================================================================
// Browser Environment Enhancements
// ============================================================================

// Happy-DOM provides the real DOM environment (window, document, navigator)
// We only need to add mocks for APIs not fully implemented in Happy-DOM

// Mock matchMedia for Mantine components (Happy-DOM doesn't fully implement this)
if (typeof globalThis.window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for browser environment stub
  (globalThis.window as any).matchMedia = jest.fn((query: unknown) => ({
    matches: false,
    media: String(query),
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

  // Mock ResizeObserver if not available
  if (typeof globalThis.ResizeObserver === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for browser environment stub
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }

  // Mock IntersectionObserver if not available
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for browser environment stub
    (globalThis as any).IntersectionObserver = class IntersectionObserver {
      constructor(
        public callback: IntersectionObserverCallback,
        public options?: IntersectionObserverInit
      ) {}
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    };
  }

  // Mock clipboard API if not fully implemented
  if (!globalThis.navigator?.clipboard) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for browser environment stub
    (globalThis.navigator as any).clipboard = {
      writeText: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      readText: jest.fn<() => Promise<string>>().mockResolvedValue(''),
    };
  }
}
