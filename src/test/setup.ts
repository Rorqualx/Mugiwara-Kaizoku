/**
 * Jest Test Setup - Main Aggregator
 *
 * Global test configuration and setup for the test environment.
 * This file is run before each test and configures the testing environment.
 *
 * Refactored from 2089-line monolithic file into 17 focused modules.
 * All modules are under 500 lines for maintainability.
 *
 * Original file backed up at: src/test/setup.ts.backup
 */

import '@testing-library/jest-dom';
import './mocks';
import { configure } from '@testing-library/react';
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

// Extend Jest matchers globally
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveAttribute(name: string, value?: string): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveClass(className: string): R;
      toHaveValue(value: string | number): R;
      toBeChecked(): R;
      toHaveFocus(): R;
      toBeEmptyDOMElement(): R;
      toContainElement(element: HTMLElement | null): R;
      toContainHTML(htmlText: string): R;
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
      toHaveFormValues(expectedValues: Record<string, unknown>): R;
      toHaveStyle(css: string | Record<string, unknown>): R;
      toBeInvalid(): R;
      toBeRequired(): R;
      toBeValid(): R;
      toHaveErrorMessage(text?: string | RegExp): R;
      toHaveDescription(text?: string | RegExp): R;
      toHaveAccessibleName(text?: string | RegExp): R;
      toHaveAccessibleDescription(text?: string | RegExp): R;
    }
  }

  // Extend global for test mocks
  interface Global {
    __mockRouterPush: jest.Mock;
    __mockRouterReplace: jest.Mock;
    __mockRouterObj: Record<string, unknown>;
  }
}

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid'
});

/**
 * Import all mock modules
 *
 * Module Structure:
 * 1. foundation.ts - Core types and utilities (50 lines)
 * 2. nextjs-mocks.ts - Next.js framework mocks (140 lines)
 * 3. component-mocks.ts - Application component mocks (190 lines)
 * 4. trpc-mocks.ts - TRPC client mocks (40 lines)
 * 5. context-mocks.ts - React context providers (60 lines)
 * 6. library-mocks.ts - External utility libraries (60 lines)
 * 7. prisma-mocks.ts - Database client mocks (110 lines)
 * 8. store-hook-mocks.ts - Zustand stores and hooks (160 lines)
 * 9. tabler-icons-mock.ts - Tabler icon components (80 lines)
 * 10. mantine-datatable-mock.ts - Mantine DataTable (60 lines)
 * 11. mantine-form-mocks.ts - Mantine form components (350 lines)
 * 12. mantine-layout-mocks.ts - Mantine layout components (300 lines)
 * 13. mantine-display-mocks.ts - Mantine display components (270 lines)
 * 14. mantine-hooks-mock.ts - Mantine hooks (70 lines)
 * 15. mantine-modals-notifications.ts - Mantine modals/notifications (270 lines)
 * 16. browser-api-mocks.ts - Browser APIs (110 lines)
 * 17. test-utils.ts - Test utilities and helpers (70 lines)
 */

// Phase 0: Feature flags mock (MUST load BEFORE foundation to prevent ML initialization)
import './setup/feature-flags-mock';

// Phase 1: Foundation (MUST load first - all other modules depend on this)
import './setup/foundation';

// Phase 2a: Independent modules (no dependencies on other test modules)
import './setup/trpc-mocks';
import './setup/library-mocks';
import './setup/prisma-mocks';
import './setup/store-hook-mocks';
import './setup/mantine-hooks-mock';
import './setup/browser-api-mocks';

// Phase 2b: Foundation-dependent modules (depend only on foundation.ts)
import './setup/nextjs-mocks';
import './setup/component-mocks';
import './setup/context-mocks';
import './setup/tabler-icons-mock';
import './setup/mantine-datatable-mock';
import './setup/mantine-display-mocks';
import './setup/mantine-layout-mocks';
import './setup/mantine-form-mocks';
import './setup/mantine-modals-notifications';

// Phase 3: Test utilities (loads last to apply global configurations)
import './setup/test-utils';

// Re-export test utilities for convenience
export { flushPromises, TEST_TIMEOUT } from './setup/test-utils';
