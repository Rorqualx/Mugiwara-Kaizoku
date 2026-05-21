/**
 * Non-JSX helper functions extracted from testHelpers.tsx
 * This file contains only the functions that don't use JSX
 */

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