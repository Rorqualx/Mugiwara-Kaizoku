/**
 * Test Setup - Custom Hooks Mocks
 *
 * Mock implementations of custom application hooks
 */

import { jest } from '@jest/globals';

// Mock useBreakpoint to return mobile by default for mobile component tests
jest.mock('@/hooks/mobile/useBreakpoint', () => ({
  useBreakpoint: jest.fn(() => ({
    current: 'xs' as const,
    isDown: jest.fn(() => true),
    isUp: jest.fn(() => false),
    isBetween: jest.fn(() => false),
    isMobile: true,
    isTablet: false,
    isDesktop: false
  }))
}));
