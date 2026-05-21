/**
 * Mock Helpers for React Component Testing
 *
 * This module provides specialized mocking utilities for common dependencies
 * and patterns in our React component tests, making it easier to write consistent
 * and reliable tests.
 */

/* global require:readonly */

import type { ReactNode } from 'react';
// @ts-ignore - Importing React without esModuleInterop
import * as React from 'react';

import { jest } from '@jest/globals';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
// @ts-ignore - Import from our local mock instead of the library
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { logger } from '@/utils/logger';

import { Notifications } from '../mocks/mantineNotifications';

/**
 * Creates a standard test wrapper with all common providers
 * @param customProviders - Additional providers to include
 * @returns A wrapper component for testing
 */
export const createTestWrapper = (customProviders: React.FC<{children: ReactNode}>[]): React.FC<{ children: ReactNode }> => {
  const TestWrapper: React.FC<{ children: ReactNode }> = ({ children }): JSX.Element => {
    // Create a new QueryClient for each test
    // Configure QueryClient with compatible options for React Query v5
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          // Updated from cacheTime to gcTime for React Query v5
          gcTime: 0,
        },
      },
      // @ts-ignore - Logger property might not be available in the current version
      // but is required for compatibility with older versions
      logger: {
        log: logger.info,
        warn: logger.warn,
        error: () => {}, // Silence errors in tests
      },
    });

    // Wrap the children with all providers
    let wrappedChildren = children;
    
    // Apply custom providers in reverse order
    [...customProviders].reverse().forEach(Provider => {
      wrappedChildren = <Provider>{wrappedChildren}</Provider>;
    });

    return (
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <ModalsProvider>
            {/* Use Notifications component instead of NotificationsProvider */}
            <Notifications position="top-right" />
            {wrappedChildren}
          </ModalsProvider>
        </MantineProvider>
      </QueryClientProvider>
    );
  };

  return TestWrapper;
};

/**
 * Standard test wrapper with all common providers
 */
export const StandardTestWrapper: React.FC<{children: ReactNode}> = ({ children }): JSX.Element => {
  const Wrapper = createTestWrapper([]);
  return <Wrapper>{children}</Wrapper>;
};

/**
 * Creates a mock for the tRPC context and procedures
 * @param mockImplementations - Custom implementations for tRPC procedures
 * @returns A mock tRPC client
 */
export const createMockTRPC = (mockImplementations: Record<string, unknown> = {}): Record<string, unknown> => {
  // Create mock functions for Jest
  const createMockFn = (): jest.Mock => {
    // Create a function that behaves like a Jest mock but is compatible with TypeScript
    const fn = jest.fn() as jest.Mock & {
      mockReturnValue: (val: unknown) => jest.Mock;
      mockResolvedValue: (val: unknown) => jest.Mock;
      mockImplementation: (impl: (...args: unknown[]) => unknown) => jest.Mock;
      mockClear: () => jest.Mock;
      mockReset: () => jest.Mock;
      getMockName: () => string;
      mock: {
        calls: unknown[][];
        results: unknown[];
        instances: unknown[];
      };
    };

    // Add mock properties
    fn.mockReturnValue = function(_val: unknown) { return fn; };
    fn.mockResolvedValue = function(_val: unknown) { return fn; };
    fn.mockImplementation = function(_impl: (...args: unknown[]) => unknown) { return fn; };
    fn.mockClear = function() { return fn; };
    fn.mockReset = function() { return fn; };
    fn.getMockName = function() { return 'mock'; };
    // Use proper Jest mock structure
    Object.assign(fn.mock, { calls: [], results: [], instances: [] });
    return fn;
  };

  // Default implementations
  const defaultImplementations = {
    useQuery: () => ({
      data: null,
      isLoading: false,
      error: null,
      refetch: createMockFn(),
      isFetching: false,
    }),
    useMutation: () => ({
      mutate: createMockFn(),
      mutateAsync: jest.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({}),
      isLoading: false,
      error: null,
      reset: createMockFn(),
    }),
  };

  // Create a proxy that handles property access and returns mocks
  return new Proxy({}, {
    get: (target, prop: string) => {
      // If the property exists in mockImplementations, return it
      if (prop in mockImplementations) {
        return mockImplementations[prop];
      }

      // Otherwise return a proxy that handles nested property access
      return new Proxy({}, {
        get: (nestedTarget, nestedProp: string) => {
          const fullPath = `${prop}.${nestedProp}`;
          
          // If the full path exists in mockImplementations, return it
          if (fullPath in mockImplementations) {
            return mockImplementations[fullPath];
          }

          // Handle common tRPC method patterns
          if (nestedProp === 'useQuery' || nestedProp === 'useMutation') {
            return defaultImplementations[nestedProp];
          }

          // Return a proxy for further nesting
          return new Proxy({}, {
            get: (deepTarget, deepProp: string) => {
              const deeperPath = `${prop}.${nestedProp}.${deepProp}`;
              
              if (deeperPath in mockImplementations) {
                return mockImplementations[deeperPath];
              }

              // Finally return a mock function for any other property
              return jest.fn();
            }
          });
        }
      });
    }
  });
};

/**
 * Creates a mock provider for contexts
 * @param ContextObject - The React context object to mock
 * @param value - The value to provide in the context
 * @returns A mock context provider component
 */
export const createMockContextProvider = <T,>(
  ContextObject: React.Context<T>,
  value: T
): React.FC<{ children: ReactNode }> => {
  return ({ children }: { children: ReactNode }): JSX.Element => (
    <ContextObject.Provider value={value}>
      {children}
    </ContextObject.Provider>
  );
};

/**
 * Creates a mock for the File System Access API
 * @param config - Configuration options for the mock
 * @returns A mock File System Access API
 */
export const mockFileSystemAccessAPI = (config: {
  isSupported?: boolean;
  directoryHandle?: Partial<FileSystemDirectoryHandle>;
  shouldThrowError?: boolean;
  errorType?: 'AbortError' | 'SecurityError' | 'NotFoundError';
} = {}): {
  mockShowDirectoryPicker: jest.Mock;
  cleanup: () => void;
} => {
  const {
    isSupported = true,
    directoryHandle = { name: 'mock-directory', kind: 'directory' as const },
    shouldThrowError = false,
    errorType = 'SecurityError',
  } = config;

  // Create error if needed
  let error: Error | null = null;
  if (shouldThrowError) {
    error = new Error('File system access error');
    (error as Error & { name: string }).name = errorType;
  }

  // Mock the showDirectoryPicker function
  const mockShowDirectoryPicker = jest.fn(() => {
    if (shouldThrowError && error) {
      return Promise.reject(error);
    }
    return Promise.resolve(directoryHandle as FileSystemDirectoryHandle);
  });

  // Apply the mock to window
  if (isSupported) {
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: mockShowDirectoryPicker,
      writable: true,
      configurable: true,
    });
  } else {
    // If not supported, delete the property
    if ('showDirectoryPicker' in window) {
      delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker;
    }
  }

  return {
    mockShowDirectoryPicker,
    cleanup: () => {
      // Restore the original window.showDirectoryPicker or delete it
      if ('showDirectoryPicker' in window) {
        delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker;
      }
    },
  };
};

/**
 * Creates a mock for Mantine notifications
 * @returns A mock notifications object
 */
export const mockMantineNotifications = (): {
  show: jest.Mock;
  update: jest.Mock;
  hide: jest.Mock;
  clean: jest.Mock;
} => {
  const showMock = jest.fn().mockImplementation((_props) => `notification-${Date.now()}`);
  const updateMock = jest.fn();
  const hideMock = jest.fn();
  const cleanMock = jest.fn();

  // Create a mock for @mantine/notifications
  jest.mock('@mantine/notifications', () => ({
    notifications: {
      show: showMock,
      update: updateMock,
      hide: hideMock,
      clean: cleanMock,
    },
    // Use our imported TypeScript-compatible Notifications component
    Notifications,
  }));

  return {
    show: showMock,
    update: updateMock,
    hide: hideMock,
    clean: cleanMock,
  };
};

interface ModalCallArg {
  modalId?: string;
  children?: {
    props?: {
      onSubmit?: (data: unknown) => void;
      onClose?: () => void;
    };
  };
}

/**
 * Creates a mock for Mantine modals
 * @returns A mock modals object and control functions
 */
export const mockMantineModals = (): {
  openModal: jest.Mock;
  closeModal: jest.Mock;
  openConfirmModal: jest.Mock;
  closeAllModals: jest.Mock;
  getOpenedModals: () => string[];
  simulateFormSubmission: (modalId: string, onSubmitData?: unknown) => void;
  getModalOnCloseFunction: (modalIndex?: number) => (() => void) | null;
  simulateModalClose: (modalIndex?: number) => void;
} => {
  const openModalMock = jest.fn().mockReturnValue('modal-id-1');
  const closeModalMock = jest.fn();
  const openConfirmModalMock = jest.fn().mockReturnValue('confirm-modal-id-1');
  const closeAllModalsMock = jest.fn();

  // List of opened modals
  const openedModals: string[] = [];

  // Create a mock for @mantine/modals
  jest.mock('@mantine/modals', () => ({
    useModals: () => ({
      openModal: (...args: unknown[]) => {
        const modalId = openModalMock(...args) as string;
        openedModals.push(modalId);
        return modalId;
      },
      closeModal: (id: string) => {
        closeModalMock(id);
        const index = openedModals.indexOf(id);
        if (index !== -1) {
          openedModals.splice(index, 1);
        }
      },
      openConfirmModal: (...args: unknown[]) => {
        const modalId = openConfirmModalMock(...args) as string;
        openedModals.push(modalId);
        return modalId;
      },
      closeAllModals: () => {
        closeAllModalsMock();
        openedModals.length = 0;
      },
    }),
    ModalsProvider: ({ children }: { children: ReactNode }) => (
      <div data-testid="modals-provider">{children}</div>
    ),
  }));

  return {
    openModal: openModalMock,
    closeModal: closeModalMock,
    openConfirmModal: openConfirmModalMock,
    closeAllModals: closeAllModalsMock,
    getOpenedModals: () => [...openedModals],

    // Helper to simulate the modal form submission
    simulateFormSubmission: (modalId: string, onSubmitData: unknown = {}): void => {
      // Get the modal data and call the onSubmit prop
      const modalData = openModalMock.mock.calls.find((call: unknown[]) => {
        const arg = call[0] as ModalCallArg | undefined;
        return arg?.modalId === modalId;
      });

      if (modalData) {
        const arg = modalData[0] as ModalCallArg | undefined;
        if (arg?.children?.props?.onSubmit) {
          arg.children.props.onSubmit(onSubmitData);
        }
      }
    },

    // Helper to get the onClose function from a modal
    getModalOnCloseFunction: (modalIndex = 0): (() => void) | null => {
      if (openModalMock.mock.calls.length <= modalIndex) {
        return null;
      }

      const modalCall = openModalMock.mock.calls[modalIndex];
      if (modalCall) {
        const arg = modalCall[0] as ModalCallArg | undefined;
        if (arg?.children?.props?.onClose) {
          return arg.children.props.onClose;
        }
      }

      return null;
    },

    // Helper to close a specific modal
    simulateModalClose: (modalIndex = 0): void => {
      const onClose = (() => {
        if (openModalMock.mock.calls.length <= modalIndex) {
          return null;
        }

        const modalCall = openModalMock.mock.calls[modalIndex];
        if (modalCall) {
          const arg = modalCall[0] as ModalCallArg | undefined;
          if (arg?.children?.props?.onClose) {
            return arg.children.props.onClose;
          }
        }

        return null;
      })();
      if (onClose) {
        onClose();
      }
    },
  };
};

/**
 * Creates a mock for Mantine hooks
 * @returns Mock implementations of common Mantine hooks
 */
export const mockMantineHooks = (): void => {
  jest.mock('@mantine/hooks', () => ({
    useColorScheme: jest.fn().mockReturnValue('light'),
    useMediaQuery: jest.fn().mockReturnValue(true),
    useViewportSize: jest.fn().mockReturnValue({ width: 1920, height: 1080 }),
    useHover: jest.fn().mockReturnValue({ hovered: false, ref: { current: null } }),
    useFocusReturn: jest.fn(),
    useId: jest.fn(() => 'mocked-id'),
    useUncontrolled: jest.fn(({ value, defaultValue, onChange }: {
      value?: unknown;
      defaultValue?: unknown;
      onChange?: jest.Mock;
    }): [unknown, jest.Mock] => [
      value !== undefined ? value : defaultValue,
      onChange ?? jest.fn(),
    ]),
    useIsomorphicEffect: jest.fn((callback: (() => void) | undefined) => {
      if (callback) {
        callback();
      }
    }),
    useForm: jest.fn(({ initialValues = {}, validate: _validate = {} }: { initialValues?: Record<string, unknown>; validate?: Record<string, unknown> }) => ({
      values: { ...initialValues },
      errors: {},
      setFieldValue: jest.fn(),
      setValues: jest.fn(),
      onSubmit: jest.fn(cb => cb),
      reset: jest.fn(),
      validate: jest.fn(() => true),
      getInputProps: jest.fn((name: string) => ({
        value: initialValues[name] ?? '',
        onChange: jest.fn(),
        error: undefined,
      })),
    })),
  }));
};

/**
 * Creates a mock for specific React contexts
 * @param contextValues - Values to provide for different contexts
 * @returns A wrapper component that provides the mocked contexts
 */
export const createContextWrapper = (contextValues: Record<string, unknown>): React.FC<{ children: ReactNode }> => {
  return ({ children }: { children: ReactNode }): JSX.Element => {
    // Create a wrapper component for each context
    const wrappers = Object.entries(contextValues).map(([name, value]) => {
      // Try to load the context dynamically
      try {
        // Note: Dynamic imports in test environment
        // This is a test utility that needs to dynamically load context providers
        // In a real environment, you should statically import contexts
        const contextPath = `../../contexts/${name}`;
        let ContextProvider: React.ComponentType<Record<string, unknown>> | undefined;

        try {
          // Dynamic require is necessary for test flexibility in CommonJS environment
          const contextModule = require(contextPath) as Record<string, unknown>;
          ContextProvider = contextModule[`${name}Provider`] as React.ComponentType<Record<string, unknown>> | undefined;
        } catch (_e: unknown) {
          logger.warn(`Failed to load context from path: ${contextPath}`);
          return (Component: React.ComponentType<{children: ReactNode}>) => Component;
        }
        
        if (ContextProvider) {
          // Capture the provider in a const to satisfy TypeScript
          const Provider = ContextProvider;
          // Fix the return type with a properly typed function
          return (Component: React.ComponentType<{children: ReactNode}>): React.FC<{children: ReactNode}> => {
            const WrappedComponent: React.FC<{children: ReactNode}> = (props: {children: ReactNode}) => {
              const providerValue = value && typeof value === 'object' ? value : {};
              return (
                <Provider {...providerValue}>
                  <Component {...props} />
                </Provider>
              );
            };
            return WrappedComponent;
          };
        }
      } catch (error: unknown) {
        logger.warn(`Failed to mock context: ${name}`, error);
      }
      
      // Return a passthrough wrapper if context not found
      return (Component: React.ComponentType<{children: ReactNode}>) => Component;
    });
    
    // Fix the composition pattern to ensure proper typing
    const PassthroughComponent: React.FC<{children: ReactNode}> = ({children}) => <>{children}</>;
    
    // Use proper type for the reducer
    const FinalComponent = wrappers.reduce<React.ComponentType<{children: ReactNode}>>(
      (Acc, Wrapper) => Wrapper(Acc),
      PassthroughComponent
    );
    
    // Use the composed component with proper JSX typing
    return React.createElement(FinalComponent, { children });
  };
};

/**
 * Creates a simple mock for a component
 * @param displayName - Display name for the component
 * @param dataTestId - Test ID for finding the component in tests
 * @returns A mock component
 */
export const createMockComponent = (
  displayName: string,
  dataTestId = displayName.toLowerCase().replace(/\s+/g, '-')
): React.FC<Record<string, unknown>> => {
  const MockComponent: React.FC<Record<string, unknown>> = (props: Record<string, unknown>) => {
    const { children, ...rest } = props;
    return (
      <div data-testid={dataTestId} data-mock-component={displayName} {...rest}>
        {children as ReactNode}
      </div>
    );
  };

  MockComponent.displayName = displayName;
  return MockComponent;
};