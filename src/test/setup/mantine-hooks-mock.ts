/**
 * Test Setup - Mantine Hooks Mocks
 *
 * Mock implementations of all Mantine hooks.
 * Extracted from: src/test/setup.ts (lines 1657-1707)
 */

import { jest } from '@jest/globals';
import { useState, useCallback } from 'react';

jest.mock('@mantine/hooks', () => ({
  useReducedMotion: jest.fn(() => false),
  useUncontrolled: jest.fn((options: Record<string, unknown>) => [options["value"] || options["defaultValue"], jest.fn()]),
  useId: jest.fn(() => 'test-id'),
  useDisclosure: jest.fn((initialState?: boolean) => [initialState ?? false, { open: jest.fn(), close: jest.fn(), toggle: jest.fn() }]),
  useClipboard: jest.fn(() => ({ copy: jest.fn(), copied: false })),
  useLocalStorage: jest.fn(() => [null, jest.fn()]),
  useWindowScroll: jest.fn(() => [{ x: 0, y: 0 }, jest.fn()]),
  useViewportSize: jest.fn(() => ({ height: 768, width: 1024 })),
  useMediaQuery: jest.fn(() => false),
  useDebouncedValue: jest.fn((value: unknown) => [value]),
  useDebouncedCallback: jest.fn((callback: (...args: unknown[]) => unknown) => callback),
  useThrottledValue: jest.fn((value: unknown) => [value]),
  useHover: jest.fn(() => ({ hovered: false, ref: jest.fn() })),
  useFocusTrap: jest.fn(() => jest.fn()),
  useClickOutside: jest.fn(() => jest.fn()),
  useHotkeys: jest.fn(),
  useInterval: jest.fn(() => ({ start: jest.fn(), stop: jest.fn(), active: false })),
  useTimeout: jest.fn((callback: () => void, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null;
    return {
      start: jest.fn(() => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(callback, delay);
      }),
      clear: jest.fn(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      })
    };
  }),
  useCounter: jest.fn(() => [0, { increment: jest.fn(), decrement: jest.fn(), set: jest.fn(), reset: jest.fn() }]),
  useToggle: jest.fn(() => [false, jest.fn()]),
  useListState: jest.fn(() => [[], { append: jest.fn(), prepend: jest.fn(), insert: jest.fn(), apply: jest.fn(), remove: jest.fn(), pop: jest.fn(), shift: jest.fn(), unshift: jest.fn(), move: jest.fn(), swap: jest.fn(), setState: jest.fn() }]),
  useInputState: jest.fn(() => ['', jest.fn()]),
  useSetState: jest.fn(() => [{}, jest.fn()]),
  useForceUpdate: jest.fn(() => jest.fn()),
  usePrevious: jest.fn(() => undefined),
  useDidUpdate: jest.fn(),
  useIsomorphicEffect: jest.fn(),
  useShallowEffect: jest.fn(),
  useOs: jest.fn(() => 'undetermined'),
  useNetwork: jest.fn(() => ({ online: true })),
  useBattery: jest.fn(() => ({ charging: false, level: 1 })),
  useIdle: jest.fn(() => false),
  useDocumentTitle: jest.fn(),
  useColorScheme: jest.fn(() => 'light'),
  usePageLeave: jest.fn(),
  useResizeObserver: jest.fn(() => [jest.fn(), { width: 0, height: 0 }]),
  useElementSize: jest.fn(() => ({ ref: jest.fn(), width: 0, height: 0 })),
  useMove: jest.fn(() => ({ ref: jest.fn(), active: false })),
  useMouse: jest.fn(() => ({ ref: jest.fn(), x: 0, y: 0 })),
  useMergedRef: jest.fn(() => jest.fn()),
  mergeRefs: jest.fn((...refs: unknown[]) => (node: unknown) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref && typeof ref === 'object') {
        (ref as { current: unknown }).current = node;
      }
    });
  }),
  assignRef: jest.fn((ref: unknown, value: unknown) => {
    if (typeof ref === 'function') {
      ref(value);
    } else if (ref && typeof ref === 'object') {
      (ref as { current: unknown }).current = value;
    }
  }),
  clamp: jest.fn((value: number, min?: number, max?: number) => {
    if (min !== undefined && value < min) return min;
    if (max !== undefined && value > max) return max;
    return value;
  }),
  useCallbackRef: jest.fn((callback: (...args: unknown[]) => unknown) => jest.fn()),
  useScrollIntoView: jest.fn(() => ({ scrollIntoView: jest.fn(), targetRef: jest.fn(), rootRef: jest.fn() })),
  useFocusWithin: jest.fn(() => ({ ref: jest.fn(), focused: false })),
  useEyeDropper: jest.fn(() => ({ open: jest.fn(), close: jest.fn(), supported: false })),
  useQueue: (options?: { initialValues?: unknown[]; limit?: number }) => {
     
    const [state, setState] = useState<any[]>(options?.initialValues ?? []);

     
    const add = useCallback((item: any) => {
      setState((prevState) => {
        const newState = [...prevState, item];
        if (options?.limit && newState.length > options.limit) {
          return newState.slice(-options.limit);
        }
        return newState;
      });
    }, [options?.limit]);

     
    const update = useCallback((fn: (items: any[]) => any[]) => {
      setState((prevState) => fn(prevState));
    }, []);

    const remove = useCallback((index: number) => {
      setState((prevState) => prevState.filter((_, i) => i !== index));
    }, []);

    return { state, add, update, remove };
  },
  useFocusReturn: jest.fn(() => ({ ref: jest.fn(), focused: false })),
  useIntersection: jest.fn(() => ({ ref: { current: null }, entry: null })),
  useEventListener: jest.fn(),
  useWindowEvent: jest.fn(),
  useDocumentVisibility: jest.fn(() => 'visible')
}));
