/**
 * Test Setup - Test Utilities
 *
 * Utility functions and global configuration for tests.
 * Extracted from: src/test/setup.ts (lines 1794-1838)
 */

// Console error suppression
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Suppress specific warnings that are expected in tests
  if (
    typeof args[0] === 'string' && (
      args[0].includes('Warning: ReactDOM.render is no longer supported') ||
      args[0].includes('Warning: validateDOMNesting') ||
      args[0].includes('Failed to parse metadata string:')
    )
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

// Setup for async tests
export const flushPromises = () => new Promise(setImmediate);

// Common test timeout for async operations
export const TEST_TIMEOUT = 5000;

// Mock fetch for API tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  } as Response)
) as unknown as typeof fetch;

// Suppress console warnings that are expected in tests
const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  // Suppress specific warnings that are expected in tests
  if (
    typeof args[0] === 'string' && (
      args[0].includes('Warning: Each child in a list should have a unique "key" prop') ||
      args[0].includes('Warning: A component is changing an uncontrolled input') ||
      args[0].includes('MantineProvider was not found')
    )
  ) {
    return;
  }
  originalConsoleWarn.call(console, ...args);
};
