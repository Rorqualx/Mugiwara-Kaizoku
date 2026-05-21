/**
 * Test Utilities
 *
 * Comprehensive utilities for testing React components, hooks, and other functionality
 * in the Kaizoku manga management application.
 */

import type { ReactElement, ReactNode } from 'react';
import React from 'react';

import { jest, expect } from '@jest/globals';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, act } from '@testing-library/react';

import { theme } from '@/styles/themes';

import type { RenderOptions, RenderResult} from '@testing-library/react';

/**
 * Custom render function that includes all necessary providers
 */
interface AllTheProvidersProps {
  children: ReactNode;
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Updated from cacheTime to gcTime for React Query v5
        gcTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        {children}
      </MantineProvider>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

/**
 * Jest DOM matchers with type safety
 * These provide type-safe versions of jest-dom matchers
 */
export const jestDOM = {
  toBeInTheDocument: (element: unknown): unknown => (element as { toBeInTheDocument: () => unknown }).toBeInTheDocument(),
  toHaveAttribute: (element: unknown, attr: string, value?: unknown): unknown => (element as { toHaveAttribute: (a: string, v?: unknown) => unknown }).toHaveAttribute(attr, value),
  toHaveTextContent: (element: unknown, text: string | RegExp): unknown => (element as { toHaveTextContent: (t: string | RegExp) => unknown }).toHaveTextContent(text),
  toBeVisible: (element: unknown): unknown => (element as { toBeVisible: () => unknown }).toBeVisible(),
  toBeDisabled: (element: unknown): unknown => (element as { toBeDisabled: () => unknown }).toBeDisabled(),
  toBeEnabled: (element: unknown): unknown => (element as { toBeEnabled: () => unknown }).toBeEnabled(),
  toHaveClass: (element: unknown, ...classNames: string[]): unknown => (element as { toHaveClass: (...c: string[]) => unknown }).toHaveClass(...classNames),
  toHaveValue: (element: unknown, value?: string | string[] | number | null): unknown => (element as { toHaveValue: (v?: string | string[] | number | null) => unknown }).toHaveValue(value),
  toBeChecked: (element: unknown): unknown => (element as { toBeChecked: () => unknown }).toBeChecked(),
  toHaveFocus: (element: unknown): unknown => (element as { toHaveFocus: () => unknown }).toHaveFocus(),
  toContainHTML: (element: unknown, htmlText: string): unknown => (element as { toContainHTML: (h: string) => unknown }).toContainHTML(htmlText),
  toHaveStyle: (element: unknown, css: string | Record<string, unknown>): unknown => (element as { toHaveStyle: (s: string | Record<string, unknown>) => unknown }).toHaveStyle(css),
};

/**
 * Creates a mock store for Zustand stores
 */
export const createMockStore = <T extends Record<string, unknown> = Record<string, unknown>>(
  initialState: T
): {
  getState: () => T;
  setState: (partial: Partial<T>) => void;
  subscribe: (listener: () => void) => () => boolean;
  destroy: () => void;
} => {
  const store = { ...initialState };
  const listeners = new Set<() => void>();

  return {
    getState: (): T => store,
    setState: (partial: Partial<T>): void => {
      Object.assign(store, partial);
      listeners.forEach(listener => listener());
    },
    subscribe: (listener: () => void): (() => boolean) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: (): void => {
      listeners.clear();
    },
  };
};

/**
 * Mock data factories for testing
 */
export const mockManga = {
  id: 1,
  title: 'Test Manga',
  source: 'test-source',
  libraryId: 1,
  metadataId: 1,
  lastChecked: new Date('2024-01-01'),
  libraryPath: '/test/path',
  mangaTitle: 'Test Manga Title',
  createdAt: new Date('2024-01-01'),
  errorMessage: null,
  lastErrorAt: null,
  lastSyncAt: new Date('2024-01-01'),
  summary: 'Test manga summary',
  syncCount: 5,
  updatedAt: new Date('2024-01-01'),
  status: 'ACTIVE' as const,
  searchProvider: 'anilist',
  providerMetadata: {},
  monitoringConfig: {},
};

export const mockChapter = {
  id: 1,
  fileName: 'chapter-001.cbz',
  index: 1,
  size: 1024000,
  pageCount: 20,
  resolutionWidth: 1920,
  resolutionHeight: 1080,
  resolutionLabel: '1080p',
  language: 'en',
  mangaId: 1,
  title: 'Chapter 1: Beginning',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  downloadStatus: 'COMPLETED' as const,
  downloadUrl: 'https://example.com/chapter-1',
  hash: 'abc123',
  mimeType: 'application/zip',
  manga: {},
  tasks: [],
};

export const mockLibrary = {
  id: 1,
  name: 'Test Library',
  path: '/test/library',
  createdAt: new Date('2024-01-01'),
};

export const mockUser = {
  id: 'user-123',
  userName: 'testuser',
  email: 'test@example.com',
  hashedPassword: 'hashed-password',
  avatar: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  role: 'USER' as const,
};

export const mockSettings = {
  id: 1,
  anilistEnabled: true,
  anilistUseForMetadata: true,
  prowlarrEnabled: false,
  prowlarrBaseURL: null,
  prowlarrApiKey: null,
  metadata: '{}',
  eventSettings: '{}',
};

/**
 * Mock API responses
 */
export const mockApiResponse = <T = unknown>(data: T): {
  data: T;
  success: boolean;
  error: null;
} => ({
  data,
  success: true,
  error: null,
});

export const mockApiError = (message: string, code = 500): {
  data: null;
  success: boolean;
  error: {
    message: string;
    code: number;
  };
} => ({
  data: null,
  success: false,
  error: {
    message,
    code,
  },
});

/**
 * Utility to wait for async operations
 */
export const waitFor = (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

/**
 * Async test helper that wraps operations in act()
 */
export const actAsync = async (fn: () => Promise<void> | void): Promise<void> => {
  await act(async () => {
    await fn();
  });
};

/**
 * Mock form data for testing forms
 */
export const createMockFormData = (data: Record<string, string>): FormData => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
};

/**
 * Mock file for testing file uploads
 */
export const createMockFile = (
  name: string = 'test.jpg',
  type: string = 'image/jpeg',
  size: number = 1024
): File => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/**
 * Helper to assert error states
 */
export const expectError = (fn: () => void, expectedMessage?: string): void => {
  try {
    fn();
    throw new Error('Expected function to throw an error');
  } catch (error: unknown) {
    if (expectedMessage && error instanceof Error) {
      expect((error instanceof Error ? error.message : String(error))).toBe(expectedMessage);
    }
  }
};

/**
 * Mock console methods for testing
 */
export const mockConsole = (): {
  mocks: {
    log: jest.Mock<(...args: unknown[]) => void>;
    error: jest.Mock<(...args: unknown[]) => void>;
    warn: jest.Mock<(...args: unknown[]) => void>;
    info: jest.Mock<(...args: unknown[]) => void>;
    debug: jest.Mock<(...args: unknown[]) => void>;
  };
  restore: () => void;
} => {
  const originalConsole = { ...console };

  const mocks = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  Object.assign(console, mocks);

  return {
    mocks,
    restore: (): void => {
      Object.assign(console, originalConsole);
    },
  };
};

/**
 * Mock localStorage for testing
 */
export const mockLocalStorage = (): {
  getItem: jest.Mock<(key: string) => string | undefined>;
  setItem: jest.Mock<(key: string, value: string) => void>;
  removeItem: jest.Mock<(key: string) => void>;
  clear: jest.Mock<() => void>;
  readonly store: Record<string, string>;
} => {
  const store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key]),
    setItem: jest.fn((key: string, value: string): void => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string): void => {
      delete store[key];
    }),
    clear: jest.fn((): void => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get store(): Record<string, string> {
      return { ...store };
    },
  };
};

/**
 * Creates a mock tRPC client for testing
 */
export const createMockTrpcClient = (mockedProcedures: Record<string, unknown> = {}): Record<string, unknown> => {
  return new Proxy({}, {
    get: (target, prop: string): unknown => {
      if (mockedProcedures[prop]) {
        return mockedProcedures[prop];
      }

      // Return a mock that can be chained
      return new Proxy({}, {
        get: (nestedTarget, nestedProp: string): unknown => {
          const fullPath = `${prop}.${nestedProp}`;
          if (mockedProcedures[fullPath]) {
            return mockedProcedures[fullPath];
          }

          // Return mock functions for common tRPC methods
          if (nestedProp === 'useQuery') {
            return jest.fn(() => ({
              data: null,
              isLoading: false,
              error: null,
            }));
          }

          if (nestedProp === 'useMutation') {
            return jest.fn(() => ({
              mutate: jest.fn(),
              mutateAsync: jest.fn(),
              isLoading: false,
              error: null,
            }));
          }

          return jest.fn();
        },
      });
    },
  });
};

/**
 * Mock window methods commonly used in tests
 */
export const mockWindow = (): {
  mocks: {
    alert: jest.Mock<(message?: string) => void>;
    confirm: jest.Mock<(message?: string) => boolean>;
    prompt: jest.Mock<(message?: string, defaultValue?: string) => string | null>;
    open: jest.Mock<(url?: string | URL, target?: string, features?: string) => Window | null>;
    location: {
      href: string;
      assign: jest.Mock<(url: string | URL) => void>;
      replace: jest.Mock<(url: string | URL) => void>;
      reload: jest.Mock<() => void>;
    };
  };
  restore: () => void;
} => {
  const originalWindow = { ...window };

  const mocks = {
    alert: jest.fn<(message?: string) => void>(),
    confirm: jest.fn<(message?: string) => boolean>(() => true),
    prompt: jest.fn<(message?: string, defaultValue?: string) => string | null>(),
    open: jest.fn<(url?: string | URL, target?: string, features?: string) => Window | null>(),
    location: {
      ...window.location,
      href: 'http://localhost:3000',
      assign: jest.fn<(url: string | URL) => void>(),
      replace: jest.fn<(url: string | URL) => void>(),
      reload: jest.fn<() => void>(),
    },
  };

  Object.assign(window, mocks);

  return {
    mocks,
    restore: (): void => {
      Object.assign(window, originalWindow);
    },
  };
};