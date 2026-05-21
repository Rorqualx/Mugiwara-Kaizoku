/**
 * Safe Library Manager Component
 *
 * Wraps the import-pipeline wizard (`<ImportPipeline />`) in an error boundary
 * + Suspense boundary so a thrown render error surfaces a friendly retry UI
 * rather than crashing the settings page. The earlier
 * `FullFunctionalityLibraryManager` implementation this file used to wrap was
 * removed when its UI was superseded by the import pipeline.
 *
 * Features:
 * - Error boundary catches render-time errors and shows a Retry button
 * - Suspense boundary renders a loading fallback while children resolve
 */
import React, { Suspense } from 'react';

import { Box, Text, Alert, Button } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconAlertCircle } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

import { ImportPipeline } from './import-pipeline';
/**
 * Error Fallback Component
 *
 * Displays a user-friendly error message with a retry button
 * when an error occurs inside the wrapped import pipeline.
 */
function ErrorFallback({ error, resetErrorBoundary }: {
    error: Error;
    resetErrorBoundary: () => void;
}): React.ReactElement {
    return (<Box p="md">
      <Alert icon={<IconAlertCircle size={16}/>} title="Library Manager Error" color="red" mb="md">

        <Text size="sm" mb="md">
          An error occurred while loading the library manager:
        </Text>
        <Text size="xs" mb="md" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {(error instanceof Error ? error.message : String(error))}
        </Text>
        <Button onClick={resetErrorBoundary} size="sm">
          Retry
        </Button>
      </Alert>
    </Box>);
}
/**
 * Loading Fallback Component
 *
 * Displays a loading message while the wrapped import pipeline children resolve.
 */
function LoadingFallback(): React.ReactElement {
    return (<Box p="md">
      <Text>Loading library manager...</Text>
    </Box>);
}
/**
 * Custom Error Boundary Component
 *
 * Catches errors in the wrapped import pipeline subtree and
 * displays a fallback UI.
 */
class LibraryManagerErrorBoundary extends React.Component<{
    children: React.ReactNode;
}, {
    hasError: boolean;
    error: Error | null;
}> {
    constructor(props: {
        children: React.ReactNode;
    }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
        return { hasError: true, error };
    }
    override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        logger.error('Library Manager Error:', error, errorInfo);
    }
    override render(): React.ReactNode {
        if (this.state.hasError) {
            return (<ErrorFallback error={this.state.error ?? new Error('Unknown error')} resetErrorBoundary={() => this.setState({ hasError: false, error: null })}/>);
        }
        return this.props.children;
    }
}
/**
 * Safe Library Manager Component
 *
 * Wraps the import pipeline with an error boundary + Suspense fallback.
 */
export function SafeLibraryManager(): React.ReactElement {
    return (<LibraryManagerErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <ImportPipeline />
      </Suspense>
    </LibraryManagerErrorBoundary>);
}
