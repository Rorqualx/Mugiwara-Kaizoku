/**
 * Test Setup - TRPC Client Mocks
 *
 * Mock implementation of the tRPC client with all routers.
 * Extracted from: src/test/setup.ts (lines 262-285)
 */

import { jest } from '@jest/globals';

jest.mock('@/utils/trpc-client', () => ({
  trpc: {
    manga: {
      getAll: { useQuery: jest.fn(() => ({ data: [], _loading: false })) },
      getById: { useQuery: jest.fn(() => ({ data: null, _loading: false })) },
      create: { useMutation: jest.fn(() => ({ mutate: jest.fn(), _loading: false })) },
      update: { useMutation: jest.fn(() => ({ mutate: jest.fn(), _loading: false })) },
      delete: { useMutation: jest.fn(() => ({ mutate: jest.fn(), _loading: false })) }
    },
    library: {
      getAll: { useQuery: jest.fn(() => ({ data: [], _loading: false })) },
      create: { useMutation: jest.fn(() => ({ mutate: jest.fn(), _loading: false })) }
    },
    settings: {
      get: { useQuery: jest.fn(() => ({ data: {}, _loading: false })) },
      update: { useMutation: jest.fn(() => ({ mutate: jest.fn(), _loading: false })) }
    },
    prowlarr: {
      getConfig: { useQuery: jest.fn(() => ({ data: null, _loading: false, error: { message: 'Prowlarr configuration not found' } })) },
      testConnection: { useMutation: jest.fn(() => ({ mutate: jest.fn(), _loading: false })) }
    }
  }
}));
