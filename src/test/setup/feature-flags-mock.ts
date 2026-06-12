/**
 * Feature Flags Mock for Jest
 *
 * Forces all feature flags off during tests so suites are deterministic.
 */

import { jest } from '@jest/globals';

// In-memory flag store for tests
const testFlagStore = new Map<string, boolean>();

// Mock the feature flags module so flags default to off during tests
jest.mock('@/server/config/feature-flags', () => ({
  isFeatureEnabled: jest.fn((feature: string) => {
    // Check test-specific overrides first
    if (testFlagStore.has(feature)) {
      return testFlagStore.get(feature);
    }
    // Default to false for all feature flags in tests
    return false;
  }),
  getFeatureFlagManager: jest.fn(() => ({
    isEnabled: jest.fn((feature: string) => {
      if (testFlagStore.has(feature)) {
        return testFlagStore.get(feature);
      }
      return false;
    }),
    setFlag: jest.fn((flag: string, value: boolean) => {
      testFlagStore.set(flag, value);
      return Promise.resolve();
    })
  }))
}));

// Also mock the parser-specific feature flags (unified parser rollout)
jest.mock('@/server/parsers/config/FeatureFlags', () => {
  // In-memory flag store for parser feature flags
  const parserFlagStore = new Map<string, boolean>();

  return {
    isFeatureEnabled: jest.fn((feature: string) => {
      if (parserFlagStore.has(feature)) {
        return parserFlagStore.get(feature);
      }
      return false;
    }),
    getFeatureFlags: jest.fn(() => ({
      isEnabled: jest.fn((feature: string) => {
        if (parserFlagStore.has(feature)) {
          return parserFlagStore.get(feature);
        }
        return false;
      }),
      setFlag: jest.fn((flag: string, value: boolean) => {
        parserFlagStore.set(flag, value);
        return Promise.resolve();
      })
    })),
    getParserConfig: jest.fn(() => ({
      enableCaching: false
    }))
  };
});
