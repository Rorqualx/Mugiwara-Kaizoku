import type { ReactNode } from 'react';
import React, { useState, useCallback, Component } from 'react';

import { Alert } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconAlertCircle } from '@tabler/icons-react';

import { clientLogger } from '../utils/clientLogger';

import { useNotification } from './useNotification';

/**
 * Error information provided by React's error boundary
 * 
 * @interface ErrorInfo
 * @property {string} componentStack - Stack trace of component that caused the error
 */
interface ErrorInfo {
  componentStack: string;
}

/**
 * Hook for managing error boundary state and error handling
 * 
 * This hook provides functionality for handling and displaying React component errors,
 * including error logging, user notifications, and error state management.
 * 
 * @returns {Object} Error boundary state and handlers
 * @returns {Error | null} .error - Current error object
 * @returns {string | null} .componentStack - Component stack trace
 * @returns {Function} .handleError - Error handler function
 * @returns {Function} .resetError - Reset error state function
 * @returns {boolean} .hasError - Whether an error exists
 * 
 * @example
 * ```tsx
 * const { 
 *   error, 
 *   handleError, 
 *   resetError 
 * } = useErrorBoundary();
 * 
 * return (
 *   <ErrorBoundary onError={handleError}>
 *     {error ? (
 *       <div>
 *         Error: {(error instanceof Error ? error.message : String(error))}
 *         <button onClick={resetError}>Try Again</button>
 *       </div>
 *     ) : (
 *       <YourComponent />
 *     )}
 *   </ErrorBoundary>
 * );
 * ```
 */
export function useErrorBoundary(): {
  error: Error | null;
  componentStack: string | null;
  handleError: (error: Error, errorInfo: ErrorInfo) => void;
  resetError: () => void;
  hasError: boolean;
} {
  const [error, setError] = useState<Error | null>(null);
  const [componentStack, setComponentStack] = useState<string | null>(null);
  const { showError } = useNotification();

  const handleError = useCallback((error: Error, errorInfo: ErrorInfo) => {
    setError(error);
    setComponentStack(errorInfo.componentStack);

    // Log error details
    clientLogger.error('Component Error:', (error instanceof Error ? error.message : String(error)), {
      error: {
        message: (error instanceof Error ? error.message : String(error)),
        name: (error instanceof Error ? error["name"] : String(error)),
        stack: (error instanceof Error ? error.stack : String(error))
      },
      componentStack: errorInfo.componentStack
    });

    // Show user-friendly notification
    showError({
      title: 'Component Error',
      message: process.env.NODE_ENV === 'development' ?
      `${(error instanceof Error ? error.message : String(error))}\n\nCheck the console for more details.` :
      'An error occurred while rendering this component.'
    });
  }, [showError]);

  const resetError = useCallback(() => {
    setError(null);
    setComponentStack(null);
  }, []);

  return {
    error,
    componentStack,
    handleError,
    resetError,
    hasError: error !== null
  };
}

/**
 * Props for ErrorBoundary component
 * 
 * @interface ErrorBoundaryProps
 * @property {(error: Error, errorInfo: ErrorInfo) => void} [onError] - Error handler callback
 * @property {ReactNode} [fallback] - Custom fallback UI when error occurs
 * @property {ReactNode} children - Child components to render
 */
interface ErrorBoundaryProps {
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallback?: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * React error boundary component for catching and handling component errors
 * 
 * This component catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 * 
 * @extends {Component<ErrorBoundaryProps, ErrorBoundaryState>}
 * 
 * @example
 * ```tsx
 * <ErrorBoundary
 *   onError={(error, info) => {
 *     console.error('Component failed:', error);
 *   }}
 *   fallback={() => <div>Something went wrong</div>}
 * >
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: {componentStack: string;}): void {
    if (this.props.onError) {
      this.props.onError(error, {
        componentStack: errorInfo.componentStack || ''
      });
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ||
      <Alert
        variant="light"
        color="red"
        title="Something went wrong"
        icon={<IconAlertCircle size={16} />}>

          An error occurred while rendering this component.
          Please try refreshing the page.
        </Alert>;

    }

    return this.props.children;
  }
}