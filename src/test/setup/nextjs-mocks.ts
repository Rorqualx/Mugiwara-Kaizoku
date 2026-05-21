/**
 * Test Setup - Next.js Mocks
 *
 * Mock implementations of Next.js framework modules (router, navigation, link, auth).
 * Extracted from: src/test/setup.ts (lines 91-205)
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { CommonProps } from './foundation';

// Create shared mock functions for Next.js router
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterPrefetch = jest.fn();
const mockRouterBack = jest.fn();

// Create a router mock object that can be modified by tests
const mockRouterObj = {
  push: mockRouterPush,
  replace: mockRouterReplace,
  prefetch: mockRouterPrefetch,
  back: mockRouterBack,
  forward: jest.fn(),
  pathname: '/',
  route: '/',
  asPath: '/',
  query: {} as Record<string, unknown>,
  isReady: true,
  basePath: '',
  locale: undefined,
  locales: undefined,
  defaultLocale: undefined,
  isFallback: false,
  isLocaleDomain: false,
  isPreview: false,
  reload: jest.fn(),
  beforePopState: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  }
};

// Mock Next.js router with shared instances
jest.mock('next/router', () => ({
  useRouter: () => mockRouterObj
}));

// Export mock functions and router object for test access
// CRITICAL: Tests depend on these global exports
(global as unknown as { __mockRouterPush: jest.Mock }).__mockRouterPush = mockRouterPush;
(global as unknown as { __mockRouterReplace: jest.Mock }).__mockRouterReplace = mockRouterReplace;
(global as unknown as { __mockRouterObj: Record<string, unknown> }).__mockRouterObj = mockRouterObj;

// Mock Next.js navigation (App Router)
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn()
  }),
  useSearchParams: () => ({
    get: jest.fn()
  }),
  usePathname: () => '/'
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  interface LinkProps {
    children?: React.ReactNode;
    href?: string;
    passHref?: boolean;
    legacyBehavior?: boolean;
    [key: string]: unknown;
  }

  return ({ children, href, passHref, legacyBehavior, ...props }: LinkProps) => {
    if (legacyBehavior && passHref && children && typeof children === 'object' && React.isValidElement(children)) {
      // When using passHref with legacyBehavior, clone the child with href
      // Make sure children is a valid React element before cloning
      return React.cloneElement(
        children,
        {
          // @ts-ignore - Ensuring props exists before spreading
          ...(children.props ?? {}), // Ensure children.props exists before spreading
          // Ensure href is a valid attribute for the element
          ...(typeof href === 'string' ? { href } : {})
        }
      );
    }
    // Ensure props is an object and href is a valid attribute
    const safeProps = {
      ...props,
      ...(typeof href === 'string' ? { href } : {})
    };
    return React.createElement('a', safeProps, children);
  };
});

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated'
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(() => Promise.resolve(null))
}));

// Mock Next.js API helpers
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data: unknown) => ({ json: () => Promise.resolve(data) })),
    redirect: jest.fn()
  }
}));
