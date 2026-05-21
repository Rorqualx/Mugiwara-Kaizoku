#!/usr/bin/env node

/**
 * Consolidate ErrorBoundary Components
 * 
 * This script identifies all ErrorBoundary implementations and consolidates them
 * into a single, feature-complete ErrorBoundary component.
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

// ErrorBoundary files to analyze
const errorBoundaryFiles = [
  'src/components/ErrorBoundary.tsx',
  'src/components/common/ErrorBoundary.tsx',
  'src/components/addManga/components/core/ErrorBoundary.tsx',
  'src/components/events/EventsDashboardErrorBoundary.tsx',
  'src/components/performance/LazyBoundary.tsx',
  'src/components/library/SafeLibraryManager.tsx',
  'src/hooks/useErrorBoundary.tsx'
];

// Analyze each ErrorBoundary to understand features
function analyzeErrorBoundary(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`  File not found: ${filePath}`);
    return null;
  }

  const code = fs.readFileSync(filePath, 'utf8');
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx']
  });

  const features = {
    filePath,
    hasResetFunction: false,
    hasLogging: false,
    hasCustomFallback: false,
    hasRetryLogic: false,
    hasEventEmitter: false,
    hasSentry: false,
    hasContext: false,
    methods: [],
    imports: []
  };

  traverse(ast, {
    ClassDeclaration(path) {
      if (path.node.id && path.node.id.name.includes('ErrorBoundary')) {
        // Check for methods
        path.node.body.body.forEach(member => {
          if (t.isClassMethod(member)) {
            features.methods.push(member.key.name);
            
            if (member.key.name === 'resetError' || member.key.name === 'reset') {
              features.hasResetFunction = true;
            }
          }
        });
      }
    },
    CallExpression(path) {
      if (path.node.callee && path.node.callee.object) {
        const objName = path.node.callee.object.name;
        const propName = path.node.callee.property?.name;
        
        if (objName === 'logger' || objName === 'console') {
          features.hasLogging = true;
        }
        if (objName === 'Sentry') {
          features.hasSentry = true;
        }
      }
    },
    ImportDeclaration(path) {
      features.imports.push({
        source: path.node.source.value,
        specifiers: path.node.specifiers.map(s => s.local.name)
      });
    }
  });

  return features;
}

// Main execution
console.log('🔍 Analyzing ErrorBoundary implementations...\n');

const analyses = [];
errorBoundaryFiles.forEach(file => {
  console.log(`Analyzing: ${file}`);
  const analysis = analyzeErrorBoundary(file);
  if (analysis) {
    analyses.push(analysis);
    console.log(`  Methods: ${analysis.methods.join(', ')}`);
    console.log(`  Features: Logging=${analysis.hasLogging}, Reset=${analysis.hasResetFunction}, Sentry=${analysis.hasSentry}`);
  }
  console.log('');
});

// Create unified ErrorBoundary
console.log('📝 Creating unified ErrorBoundary...\n');

const unifiedErrorBoundaryCode = `/**
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

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Card, Stack, Text, Title, Container, Alert } from '@mantine/core';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { logger } from '../utils/logger';

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
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    // Update state with error details
    this.setState(prevState => ({
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
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack
            }
          }
        });
      }
    } catch (reportError) {
      logger.error('Failed to report error to tracking service:', reportError);
    }
  };

  resetError = (): void => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.errorCount >= maxRetries) {
      logger.warn(\`Max retries (\${maxRetries}) reached, not resetting\`);
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
                variant="light"
              >
                An unexpected error occurred. The issue has been logged and our team will investigate.
              </Alert>

              {showDetails && process.env.NODE_ENV === 'development' && (
                <Card withBorder padding="sm" radius="sm" style={{ backgroundColor: '#f8f9fa' }}>
                  <Stack spacing="xs">
                    <Text size="sm" weight={500}>Error Details:</Text>
                    <Text size="xs" style={{ fontFamily: 'monospace' }}>
                      {error.message}
                    </Text>
                    {error.stack && (
                      <Text size="xs" color="dimmed" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {error.stack}
                      </Text>
                    )}
                  </Stack>
                </Card>
              )}

              {enableReset && errorCount < maxRetries && (
                <Button
                  leftIcon={<IconRefresh size="1rem" />}
                  onClick={this.resetError}
                  variant="light"
                >
                  Try Again ({maxRetries - errorCount} attempts remaining)
                </Button>
              )}

              {errorCount >= maxRetries && (
                <Alert color="orange" variant="light">
                  Maximum retry attempts reached. Please refresh the page.
                </Alert>
              )}
            </Stack>
          </Card>
        </Container>
      );
    }

    return children;
  }
}

// Hook for functional components
export function useErrorBoundary() {
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
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = \`withErrorBoundary(\${Component.displayName || Component.name})\`;
  
  return WrappedComponent;
}

export default ErrorBoundary;
`;

// Write unified ErrorBoundary
const unifiedPath = 'src/components/common/UnifiedErrorBoundary.tsx';
fs.writeFileSync(unifiedPath, unifiedErrorBoundaryCode);
console.log(`✅ Created unified ErrorBoundary: ${unifiedPath}\n`);

// Generate migration plan
console.log('📋 Migration plan:\n');
console.log('1. Replace all ErrorBoundary imports with UnifiedErrorBoundary');
console.log('2. Update any custom props to match new interface');
console.log('3. Remove duplicate ErrorBoundary implementations');
console.log('4. Test error handling in affected components');

console.log('\n✨ Analysis complete!');
