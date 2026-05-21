/**
 * Feature Flags Mock for Jest
 *
 * Disables ML pattern recognition during tests to prevent async initialization
 * from logging after tests complete.
 */

import { jest } from '@jest/globals';

// In-memory flag store for tests
const testFlagStore = new Map<string, boolean>();

// Mock the feature flags module to disable ML patterns during tests
jest.mock('@/server/config/feature-flags', () => ({
  isFeatureEnabled: jest.fn((feature: string) => {
    // Check test-specific overrides first
    if (testFlagStore.has(feature)) {
      return testFlagStore.get(feature);
    }
    // Disable ML pattern recognition during tests to prevent async logging issues
    if (feature === 'mlPatternRecognition') {
      return false;
    }
    // Default to false for all feature flags in tests
    return false;
  }),
  getFeatureFlagManager: jest.fn(() => ({
    isEnabled: jest.fn((feature: string) => {
      if (testFlagStore.has(feature)) {
        return testFlagStore.get(feature);
      }
      if (feature === 'mlPatternRecognition') {
        return false;
      }
      return false;
    }),
    setFlag: jest.fn((flag: string, value: boolean) => {
      testFlagStore.set(flag, value);
      return Promise.resolve();
    }),
    getMLConfig: jest.fn(() => ({
      enabled: false,
      modelPath: '',
      cacheEnabled: false,
      learningEnabled: false
    }))
  })),
  getMLConfig: jest.fn(() => ({
    enabled: false,
    modelPath: '',
    cacheEnabled: false,
    learningEnabled: false
  }))
}));

// Also mock the parser-specific feature flags
jest.mock('@/server/parsers/config/FeatureFlags', () => {
  // In-memory flag store for parser feature flags
  const parserFlagStore = new Map<string, boolean>();

  return {
    isFeatureEnabled: jest.fn((feature: string) => {
      if (parserFlagStore.has(feature)) {
        return parserFlagStore.get(feature);
      }
      if (feature === 'mlPatternRecognition') {
        return false;
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
      useMLPatterns: false,
      enableCaching: false
    }))
  };
});
