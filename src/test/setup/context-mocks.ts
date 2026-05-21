/**
 * Test Setup - Context Provider Mocks
 *
 * Mock implementations of React context providers.
 * Extracted from: src/test/setup.ts (lines 287-327)
 */

import { jest } from '@jest/globals';
import * as React from 'react';

// Mock ColorSchemeProvider
jest.mock('@/styles/ColorSchemeProvider', () => ({
  ColorSchemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useColorSchemeContext: jest.fn(() => ({
    colorScheme: 'light',
    toggleColorScheme: jest.fn(),
    setColorScheme: jest.fn()
  }))
}));

// Mock UserContext
jest.mock('@/contexts/UserContext', () => ({
  UserProvider: ({ children }: { children: React.ReactNode }) => children,
  useUser: jest.fn(() => ({
    user: null,
    _loading: false,
    error: null,
    login: jest.fn(),
    logout: jest.fn()
  }))
}));

// Mock IntegrationStatusContext
jest.mock('@/contexts/IntegrationStatusContext', () => ({
  IntegrationStatusProvider: ({ children }: { children: React.ReactNode }) => children,
  useIntegrationStatus: jest.fn(() => ({
    status: 'idle',
    isConnected: false,
    lastChecked: null,
    checkStatus: jest.fn()
  }))
}));
