/**
 * Unified Error Boundary Component
 * 
 * Consolidates all error boundary functionality from across the codebase.
 * Features:
 * - Comprehensive error logging
 * - Reset functionality
 * - Custom fallback UI
 * - Development/Production modes
 * - Sentry integration (if configured)
 * - Context provider for child components
 */

import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';

import { Button, Card, Stack, Text, Container, Alert } from '@mantine/core';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableReset?: boolean;
  maxRetries?: number;
  showDetails?: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details
    logger.error('ErrorBoundary caught error:', {
      error: (error instanceof Error ? error.message : String(error)),
      stack: (error instanceof Error ? error.stack : String(error)),
      componentStack: errorInfo.componentStack
    });

    // Update state with error details
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportToErrorService(error, errorInfo);
    }
  }

  reportToErrorService = (error: Error, errorInfo: ErrorInfo): void => {
    // Integration point for Sentry or other error tracking
    try {
      // If Sentry is configured, report the error

      if (typeof window !== 'undefined') {
        const win = window as unknown as Record<string, unknown>;
        if ('Sentry' in win && typeof win['Sentry'] === 'object' && win['Sentry'] !== null) {
          const sentry = win['Sentry'] as unknown as Record<string, unknown>;
          if ('captureException' in sentry && typeof sentry['captureException'] === 'function') {
            (sentry['captureException'] as (error: Error, options: Record<string, unknown>) => void)(error, {
              contexts: {
                react: {
                  componentStack: errorInfo.componentStack
                }
              }
            });
          }
        }
      }
    } catch (reportError: unknown) {
      const errorMessage = reportError instanceof Error ? reportError.message : String(reportError);
      logger.error('Failed to report error to tracking service:', errorMessage);
    }
  };

  resetError = (): void => {
    const { maxRetries = 3 } = this.props;

    if (this.state.errorCount >= maxRetries) {
      logger.warn(`Max retries (${maxRetries}) reached, not resetting`);
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback, enableReset = true, maxRetries = 3, showDetails = false } = this.props;

    if (hasError && error && errorInfo) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, errorInfo, this.resetError);
      }

      // Default error UI
      return (
        <Container size="sm" py="xl">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack>
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title="Something went wrong"
                color="red"
                variant="light">

                An unexpected error occurred. The issue has been logged and our team will investigate.
              </Alert>

              {showDetails && process.env.NODE_ENV === 'development' &&
              <Card withBorder padding="sm" radius="sm" style={{ backgroundColor: '#f8f9fa' }}>
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>Error Details:</Text>
                    <Text size="xs" style={{ fontFamily: 'monospace' }}>
                      {(error instanceof Error ? error.message : String(error))}
                    </Text>
                    {(error instanceof Error ? error.stack : String(error)) &&
                  <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {(error instanceof Error ? error.stack : String(error))}
                      </Text>
                  }
                  </Stack>
                </Card>
              }

              {enableReset && errorCount < maxRetries &&
              <Button
                leftSection={<IconRefresh size="1rem" />}
                onClick={this.resetError}
                variant="light">

                  Try Again ({maxRetries - errorCount} attempts remaining)
                </Button>
              }

              {errorCount >= maxRetries &&
              <Alert color="orange" variant="light">
                  Maximum retry attempts reached. Please refresh the page.
                </Alert>
              }
            </Stack>
          </Card>
        </Container>);

    }

    return children;
  }
}

// Hook for functional components
export function useErrorBoundary(): { captureError: (error: Error) => void; resetError: () => void } {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
}

// Higher-order component
export function withErrorBoundary<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WrappedComponent = (props: P): React.ReactElement => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  const displayName = Component.displayName ?? (typeof Component === 'function' && 'name' in Component ? (Component as unknown as Record<string, unknown>)['name'] : 'Unknown');
  WrappedComponent.displayName = `withErrorBoundary(${String(displayName)})`;

  return WrappedComponent;
}

export default ErrorBoundary;