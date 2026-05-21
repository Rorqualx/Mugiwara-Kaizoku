/**
 * Safe wrapper for CalendarProviderSettings with error boundary
 *
 * This component wraps the CalendarProviderSettings with an error boundary
 * to catch any rendering errors related to objects being rendered as React children.
 */
import React from 'react';

import { Alert, Stack, Text, Button } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

import { CalendarProviderSettings } from './CalendarProviderSettings';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class CalendarSettingsErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        // Log the error to console for debugging
        logger.error('CalendarProviderSettings Error:', error, errorInfo);

        // Check if it's the specific object rendering error
        if (error.message.includes('Objects are not valid as a React child')) {
            logger.error('Settings object was being rendered directly. Check mutation responses and error handling.');
        }
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <Alert
                    icon={<IconAlertCircle size={16} />}
                    title="Configuration Error"
                    color="red"
                >
                    <Stack gap="sm">
                        <Text>
                            There was an error displaying the calendar provider settings.
                        </Text>
                        {this.state.error && (
                            <Text size="sm" c="dimmed">
                                {this.state.error.message}
                            </Text>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                // Force a re-render
                                window.location.reload();
                            }}
                        >
                            Reload Settings
                        </Button>
                    </Stack>
                </Alert>
            );
        }

        return this.props.children;
    }
}

/**
 * Safe wrapper component for CalendarProviderSettings
 *
 * This component ensures that any rendering errors in CalendarProviderSettings
 * are caught and displayed gracefully.
 */
export function SafeCalendarProviderSettings(): React.ReactElement {
    return (
        <CalendarSettingsErrorBoundary>
            <CalendarProviderSettings />
        </CalendarSettingsErrorBoundary>
    );
}