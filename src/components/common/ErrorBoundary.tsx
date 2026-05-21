/**
 * Error Boundary Component
 * 
 * This component catches JavaScript errors in child components,
 * logs them, and displays a fallback UI. Prevents entire app crashes
 * and navigation locks due to uncaught errors.
 * 
 * @module components/common/ErrorBoundary
 */
import React from 'react';

import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('ErrorBoundary caught error:', {
      error: (error instanceof Error ? error.message : String(error)),
      stack: (error instanceof Error ? error.stack : String(error)),
      componentStack: errorInfo.componentStack,
    });
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Something went wrong"
          color="red"
          mt="md"
        >
          <Stack gap="md">
            <Text size="sm">{this.state.error instanceof Error ? this.state.error.message : String(this.state.error)}</Text>
            <Button
              variant="light"
              color="red"
              size="sm"
              onClick={this.resetError}
            >
              Try Again
            </Button>
          </Stack>
        </Alert>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to easily wrap components with error boundary
 */
export function withErrorBoundary<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
): React.ComponentType<P> {
  return (props: P) => (
    <ErrorBoundary {...(fallback ? { fallback } : {})}>
      <Component {...props} />
    </ErrorBoundary>
  );
}
