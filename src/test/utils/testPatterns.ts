/**
 * Test Patterns
 *
 * This file contains reusable patterns and utilities for testing components
 * in the Mugiwara-Kaizoku project. It includes helpers for working with
 * global mocks, accessibility testing, API response testing, and patterns
 * for testing hooks with TRPC dependencies.
 */

import type { RenderResult } from '@testing-library/react';

import React, { useState, useMemo } from 'react';
import { AsyncResult, createSuccessResult, createErrorResult, isSuccess, isError, isLoading, isIdle } from "@/utils/async-result";
import { render, screen } from '@testing-library/react';
import { logger } from '@/utils/logger';

// Mock TestWrapper if testUtils module doesn't exist
const TestWrapper: React.FC<{children: React.ReactNode;}> = ({ children }) => {
  return React.createElement('div', { 'data-testid': 'test-wrapper' }, children);
};

/**
 * Helper for testing components that may have multiple instances of the same role
 * Useful for accessibility testing with landmarks (main, navigation, etc.)
 */
export const findByRoleSafely = (
role: string,
options?: Parameters<typeof screen.getAllByRole>[1])
: HTMLElement => {
  const elements = screen.getAllByRole(role, options);

  // If only one element, return it directly
  if (elements.length === 1 && elements[0]) {
    return elements[0];
  }

  // If multiple elements, log a warning and return the first one
  if (elements.length > 1 && elements[0]) {
    logger.warn(`Found ${elements.length} elements with role "${role}". Using the first one.`);
    return elements[0];
  }

  // Should never happen since getAllByRole throws if no elements found
  throw new Error(`No elements found with role "${role}"`);
};

/**
 * Safely renders a component and handles unmounting
 * Useful for testing component remounting scenarios
 */
export const renderAndUnmount = (component: React.ReactElement): {
  unmount: () => void;
  rerender: (newComponent: React.ReactElement) => void;
} => {
  const { unmount, rerender } = render(component, { wrapper: TestWrapper });

  return {
    unmount,
    rerender: (newComponent: React.ReactElement) => {
      // Don't use rerender after unmounting
      if (document.body.innerHTML === '') {
        render(newComponent, { wrapper: TestWrapper });
      } else {
        rerender(newComponent);
      }
    }
  };
};

/**
 * Type for structured API error responses
 */
export interface StructuredErrorResponse {
  error: string;
  errors?: Array<{
    field?: string;
    type?: string;
    message: string;
  }>;
}

/**
 * Validates a structured error response
 * Useful for testing API endpoints that return structured error responses
 */
export const expectStructuredError = (
response: unknown,
options?: {
  errorMessage?: string;
  fieldErrors?: Array<{
    field: string;
    messagePattern: string;
  }>;
})
: void => {
  // Type guard
  if (!response || typeof response !== 'object') {
    throw new Error('Response is not an object');
  }

  const typedResponse = response as Record<string, unknown>;

  // Check for error field
  expect(typedResponse).toHaveProperty('error');

  // Check for specific error message if provided
  if (options?.errorMessage) {
    expect(typedResponse["error"]).toBe(options.errorMessage);
  }

  // Check for field-specific errors if provided
  if (options?.fieldErrors && Array.isArray(typedResponse["errors"])) {
    const errors = typedResponse["errors"] as Array<Record<string, unknown>>;

    options.fieldErrors.forEach((fieldError) => {
      const matchingError = errors.find((error) =>
        error["field"] === fieldError.field
      );
      expect(matchingError).toBeTruthy();
    });
  }
};

/**
 * Mounts a component for testing, handling global mocks
 * by creating a custom test wrapper
 */
export const mountForTesting = (
Component: React.ComponentType<unknown>,
props: Record<string, unknown> = {})
: RenderResult => {
  return render(
    React.createElement(TestWrapper, { children: React.createElement(Component, props) })
  );
};

/**
 * Creates a testing version of a component that might be globally mocked
 * Useful when you want to test the mock implementation
 */
export const createTestableVersion = <P extends Record<string, unknown>,>(
Component: React.ComponentType<P>,
customProps: Partial<P> = {})
: React.FC<P> => {
  const TestableComponent = (props: P) => {
    return React.createElement(Component, {
      ...customProps,
      ...props,
      'data-testid': 'testable-component'
    });
  };

  return TestableComponent;
};

/**
 * Tests if an element is visible and interactive
 * Useful for accessibility testing
 */
export const expectVisibleAndInteractive = (element: HTMLElement): void => {
  expect(element).toBeVisible();
  expect(element).not.toHaveAttribute('aria-hidden', 'true');
  expect(element.tabIndex).not.toBe(-1);
};

/**
 * Factory pattern for creating mock functions before module imports
 * Avoids Jest variable hoisting issues
 * 
 * Usage:
 * ```
 * // 1. Create a mock factory
 * const mockFactory = createMockFactory();
 * 
 * // 2. Generate mocks
 * mockFactory.create('showSuccess');
 * mockFactory.create('showError');
 * mockFactory.create('trpcQuery', () => ({
 *   data: null,
 *   isLoading: false,
 *   error: null,
 *   refetch: jest.fn()
 * }));
 * 
 * // 3. Access mocks later
 * const { showSuccess, showError, trpcQuery } = mockFactory.getMocks();
 * ```
 */
export const createMockFactory = () => {
  const mocks: Record<string, jest.Mock> = {};

  return {
    create: <T = unknown>(name: string, implementation?: (...args: unknown[]) => T): jest.Mock<T> => {
      const mock = implementation ? jest.fn().mockImplementation(implementation) : jest.fn();
      mocks[name] = mock;
      return mock;
    },
    getMocks: () => ({ ...mocks }),
    reset: () => {
      Object.values(mocks).forEach((mock) => mock.mockReset());
    },
    clear: () => {
      Object.values(mocks).forEach((mock) => mock.mockClear());
    }
  };
};

/**
 * Helper for safely handling null/undefined values in component tests
 * For use when mocking components that require string props
 *
 * @param value - The value that might be null or undefined
 * @param fallback - Fallback value if null/undefined (default: '')
 */
export const safeProp = <T,>(value: T | null | undefined, fallback: T): T => {
  return value ?? fallback;
};

/**
 * Create a simple pagination implementation for testing
 * Useful for testing hooks that use pagination without causing infinite loops
 *
 * NOTE: This is a React Hook and must be called from a React component or custom hook.
 * Renamed from createTestPagination to follow React Hook naming convention.
 *
 * @param items - Array of items to paginate
 * @param options - Pagination options
 */
export const useTestPagination = <T,>(
items: T[],
options: {
  itemsPerPage?: number;
  initialPage?: number;
} = {}): {
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  paginatedItems: T[];
  totalPages: number;
} =>
{
  const { itemsPerPage = 10, initialPage = 1 } = options;
  const [currentPage, setCurrentPage] = useState(initialPage);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, items, itemsPerPage]);

  return {
    currentPage,
    setCurrentPage,
    paginatedItems,
    totalPages: Math.ceil(items.length / itemsPerPage)
  };
};

/**
 * Create a test implementation for a TRPC hook
 * Useful for testing hooks that depend on TRPC queries and mutations
 *
 * @param mockData - Optional mock data to return from the query
 * @param mockStatus - Optional status for the query
 */
export const createTrpcTestHook = <TData = unknown, TInput = unknown>(
mockData?: TData,
mockStatus: {isLoading?: boolean;isError?: boolean;error?: Error;} = {}) =>
{
  const { isLoading = false, isError = false, error = undefined } = mockStatus;
  const mockRefetch = jest.fn().mockResolvedValue({ data: mockData });
  const mockMutate = jest.fn().mockResolvedValue({ data: mockData });

  return {
    useQuery: jest.fn().mockReturnValue({
      data: mockData,
      isLoading,
      isError,
      error,
      refetch: mockRefetch
    }),
    useMutation: jest.fn().mockReturnValue({
      mutate: mockMutate,
      mutateAsync: mockMutate,
      isLoading,
      isError,
      error,
      reset: jest.fn()
    }),
    refetch: mockRefetch,
    mutate: mockMutate
  };
};

export default {
  findByRoleSafely,
  renderAndUnmount,
  expectStructuredError,
  mountForTesting,
  createTestableVersion,
  expectVisibleAndInteractive,
  createMockFactory,
  safeProp,
  useTestPagination,
  createTrpcTestHook
};