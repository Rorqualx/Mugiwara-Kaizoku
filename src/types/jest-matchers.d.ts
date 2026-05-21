/**
 * Jest DOM matchers override
 * This file overrides Jest's default matchers to include jest-dom matchers
 */

declare global {
  namespace jest {
    interface Matchers<R> extends import('@testing-library/jest-dom/matchers').TestingLibraryMatchers<typeof expect.stringMatching, R> {}
  }
}