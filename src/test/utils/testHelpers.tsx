/**
 * Test Helpers
 *
 * This file contains utility functions and components to help with testing.
 * These utilities implement the common patterns established in our test fixes.
 */

import type { ReactNode } from 'react';
import React from 'react';

import { jest } from '@jest/globals';
import { MantineProvider } from '@mantine/core';
import { render as rtlRender } from '@testing-library/react';
import { act } from 'react-dom/test-utils';

import type { RenderOptions, RenderResult } from '@testing-library/react';

/**
 * Standard render function that wraps components in common providers
 */
export function render(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { wrapWithProviders?: boolean }
): RenderResult {
  const { wrapWithProviders = true, ...renderOptions } = options ?? {};

  function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    if (!wrapWithProviders) {
      return <>{children}</>;
    }

    return (
      <MantineProvider>
        {children}
      </MantineProvider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Wait for component updates to complete
 * Useful for hooks that trigger multiple state updates
 */
export async function waitForComponentToPaint<T = unknown>(
  callback?: () => T
): Promise<T | undefined> {
  let result;

  // First paint
  await act(async () => {
    if (callback) {
      result = await Promise.resolve(callback());
    }
  });

  // Wait for all promises and timers
  await act(async () => {
    await new Promise<void>(resolve => {
      setTimeout(resolve, 0);
    });
  });

  return result;
}

/**
 * Helper to mock console methods and restore them after tests
 *
 * @example
 * const { restore } = mockConsole(['error', 'warn']);
 *
 * // In your test...
 * expect(console.error).toHaveBeenCalledWith('some error');
 *
 * // After test
 * restore();
 */
export function mockConsole(methods: Array<keyof typeof console> = ['log', 'error', 'warn']): {
  mocks: Record<string, unknown>;
  restore: () => void;
} {
  const originalMethods: Partial<Record<keyof typeof console, unknown>> = {};
  const mockMethods: Record<string, unknown> = {};

  // Save original methods and create mocks
  methods.forEach(method => {
    // eslint-disable-next-line no-console -- Test utility for mocking console
    originalMethods[method] = console[method];
    const mockFn = jest.fn();
    if (typeof method === 'string') {
      mockMethods[method] = mockFn;
    }
    Object.defineProperty(console, method, {
      value: mockFn,
      writable: true,
      configurable: true,
    });
  });

  return {
    // Return mocked methods for assertions
    mocks: mockMethods,

    // Restore original console methods
    restore: (): void => {
      methods.forEach(method => {
        if (originalMethods[method]) {
          Object.defineProperty(console, method, {
            value: originalMethods[method],
            writable: true,
            configurable: true,
          });
        }
      });
    }
  };
}

/**
 * Creates a mock component factory
 * 
 * @example
 * const { Button, Stack } = createMockComponentFactory({
 *   Button: ({ children, onClick }) => (
 *     <button onClick={onClick} data-testid="mock-button">{children}</button>
 *   ),
 *   Stack: ({ children, spacing }) => (
 *     <div data-testid="mock-stack" data-gap={spacing}>{children}</div>
 *   )
 * });
 */
export function createMockComponentFactory<T extends Record<string, React.FC<unknown>>>(components: T): T {
  return components;
}

/**
 * Safely mock dates to avoid timezone issues
 *
 * @example
 * const mockDate = createMockDate('2025-01-15T12:00:00Z');
 * expect(formatDate(mockDate)).toBe('January 15, 2025');
 */
export function createMockDate(dateStringParam: string): Date {
  let dateString = dateStringParam;
  // Ensure the date is interpreted as UTC
  if (!dateString.endsWith('Z') && !dateString.includes('+')) {
    dateString += 'Z';
  }
  
  return new Date(dateString);
}

/**
 * Create a safe factory function for test data
 * 
 * @example
 * const createUser = createDataFactory({
 *   id: 1,
 *   name: 'Test User',
 *   email: 'test@example.com',
 * });
 * 
 * const user = createUser({ name: 'Custom Name' });
 */
export function createDataFactory<T extends Record<string, unknown>>(defaults: T) {
  return (overrides: Partial<T> = {}): T => ({
    ...defaults,
    ...overrides
  });
}

/**
 * Create a mock event object
 * 
 * @example
 * const event = createMockEvent('change');
 * fireEvent(input, event);
 */
export function createMockEvent(
  type: string,
  overrides?: Partial<Event>
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  
  if (overrides) {
    Object.assign(event, overrides);
  }
  
  return event;
}

/**
 * Create a mock input change event
 * 
 * @example
 * const event = createMockChangeEvent('new value');
 * fireEvent(input, event);
 */
export function createMockChangeEvent(
  value: string
): React.ChangeEvent<HTMLInputElement> {
  return {
    target: { value },
    currentTarget: { value },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

/**
 * Mock ResizeObserver for components that use it
 */
export function mockResizeObserver(): () => void {
  const originalResizeObserver = global.ResizeObserver;

  // Create mock implementation
  global.ResizeObserver = jest.fn().mockImplementation((_callback) => {
    return {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    };
  }) as unknown as typeof ResizeObserver;

  // Return function to restore original
  return () => {
    global.ResizeObserver = originalResizeObserver;
  };
}

/**
 * Mock IntersectionObserver for components that use it
 */
export function mockIntersectionObserver(): () => void {
  const originalIntersectionObserver = global.IntersectionObserver;

  // Create mock implementation
  global.IntersectionObserver = jest.fn().mockImplementation((_callback) => {
    return {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
      rootMargin: '',
      root: null,
      thresholds: [],
      takeRecords: jest.fn(),
    };
  }) as unknown as typeof IntersectionObserver;

  // Return function to restore original
  return () => {
    global.IntersectionObserver = originalIntersectionObserver;
  };
}

/**
 * Create a testing wrapper with default providers and mocks
 */
export function createTestWrapper(additionalProviders: React.FC<{ children: ReactNode }> = ({ children }) => <>{children}</>): React.FC<{ children: ReactNode }> {
  const Wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <MantineProvider>
      {React.createElement(additionalProviders, { children })}
    </MantineProvider>
  );
  return Wrapper;
}

/**
 * Helper to test React context providers
 *
 * @example
 * const { Provider, result } = createTestContext(MyContext, initialValue);
 * render(
 *   <Provider value={{ count: 5 }}>
 *     <MyComponent />
 *   </Provider>
 * );
 * expect(result.current.count).toBe(5);
 */
export function createTestContext<T>(Context: React.Context<T>, initialValue: T): {
  Provider: React.FC<{ value: T; children: ReactNode }>;
  result: { readonly current: T };
} {
  let value = initialValue;

  const Provider: React.FC<{ value: T; children: ReactNode }> = ({ value: newValue, children }) => {
    value = newValue;
    return <Context.Provider value={newValue}>{children}</Context.Provider>;
  };

  return {
    Provider,
    result: {
      get current() {
        return value;
      }
    }
  };
}