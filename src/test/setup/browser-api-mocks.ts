/**
 * Test Setup - Browser API Mocks
 *
 * Mock implementations of browser APIs for testing environment.
 * Extracted from: src/test/setup.ts (lines 1709-1792)
 */

import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';
import { MessageChannel, MessagePort } from 'worker_threads';

// Mock Web Streams API for Node.js environment (required by cheerio/undici)
// @ts-expect-error - ReadableStream type mismatch between Node and DOM types
global.ReadableStream = ReadableStream;
// @ts-expect-error - WritableStream type mismatch between Node and DOM types
global.WritableStream = WritableStream;
// @ts-expect-error - TransformStream type mismatch between Node and DOM types
global.TransformStream = TransformStream;

// Mock MessageChannel/MessagePort for Node.js environment (required by undici)
// @ts-expect-error - MessageChannel type mismatch between Node and DOM types
global.MessageChannel = MessageChannel;
// @ts-expect-error - MessagePort type mismatch between Node and DOM types
global.MessagePort = MessagePort;

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: jest.fn().mockReturnValue([])
})) as jest.MockedClass<typeof IntersectionObserver>;

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
})) as jest.MockedClass<typeof ResizeObserver>;

// Mock browser APIs only when running in jsdom environment
if (typeof window !== 'undefined') {
  // Mock matchMedia - configurable so tests can override it
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn((query: string): MediaQueryList => {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn() as unknown as () => void, // Deprecated
        removeListener: jest.fn() as unknown as () => void, // Deprecated
        addEventListener: jest.fn() as unknown as () => void,
        removeEventListener: jest.fn() as unknown as () => void,
        dispatchEvent: jest.fn() as unknown as () => boolean
      } as MediaQueryList;
    })
  });

  // Mock window.scrollTo
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: jest.fn()
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock
  });

  // Mock performance API
  if (typeof performance === 'undefined' || !performance.getEntriesByType) {
    Object.defineProperty(global, 'performance', {
      writable: true,
      configurable: true,
      value: {
        now: jest.fn(() => Date.now()),
        getEntriesByType: jest.fn((type: string) => {
          if (type === 'navigation') {
            return [{
              domContentLoadedEventEnd: 100,
              domContentLoadedEventStart: 50,
              loadEventEnd: 200,
              loadEventStart: 150,
              startTime: 0,
              duration: 200
            }];
          }
          return [];
        }),
        getEntriesByName: jest.fn((name: string) => {
          if (name === 'first-paint' || name === 'first-contentful-paint') {
            return [{ startTime: 100 }];
          }
          return [];
        }),
        mark: jest.fn(),
        measure: jest.fn(),
        clearMarks: jest.fn(),
        clearMeasures: jest.fn()
      }
    });
  }

  // Mock Touch API for mobile testing
  if (typeof Touch === 'undefined') {
    // Use a type-safe approach to avoid exactOptionalPropertyTypes issues
    (global as unknown as { Touch: typeof Touch }).Touch = class MockTouch {
      identifier: number;
      target: EventTarget;
      clientX: number;
      clientY: number;
      screenX: number;
      screenY: number;
      pageX: number;
      pageY: number;
      radiusX: number;
      radiusY: number;
      rotationAngle: number;
      force: number;

      constructor(touchInitDict: TouchInit) {
        this.identifier = touchInitDict.identifier;
        this.target = touchInitDict.target;
        // clientX and clientY can be optional in TouchInit, so provide defaults
        this.clientX = touchInitDict.clientX ?? 0;
        this.clientY = touchInitDict.clientY ?? 0;
        // Use defaults for optional properties, with full fallback chain
        this.screenX = touchInitDict.screenX ?? touchInitDict.clientX ?? 0;
        this.screenY = touchInitDict.screenY ?? touchInitDict.clientY ?? 0;
        this.pageX = touchInitDict.pageX ?? touchInitDict.clientX ?? 0;
        this.pageY = touchInitDict.pageY ?? touchInitDict.clientY ?? 0;
        this.radiusX = touchInitDict.radiusX ?? 1;
        this.radiusY = touchInitDict.radiusY ?? 1;
        this.rotationAngle = touchInitDict.rotationAngle ?? 0;
        this.force = touchInitDict.force ?? 1;
      }
    } as unknown as typeof Touch;
  }
}

// Mock TextEncoder/TextDecoder for Node.js environment
global.TextEncoder = TextEncoder as typeof global.TextEncoder;
// @ts-expect-error - TextDecoder type mismatch between Node and DOM types
global.TextDecoder = TextDecoder;

// Mock crypto for Node.js environment
type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array;

Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: <T extends TypedArray>(arr: T): T => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  }
});
