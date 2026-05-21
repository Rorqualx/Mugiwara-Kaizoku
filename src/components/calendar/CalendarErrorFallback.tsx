/**
 * Calendar Error Fallback Component
 *
 * Error boundary fallback UI for calendar-related errors.
 * Provides user-friendly error display with retry functionality.
 *
 * @module components/calendar/CalendarErrorFallback
 */

import { Button, Paper, Stack, Text, Title, Group, ThemeIcon } from '@mantine/core';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

// ============================================================================
// Types
// ============================================================================

export interface CalendarErrorFallbackProps {
  /** Error that occurred */
  error: Error;
  /** Function to reset the error boundary and retry */
  resetErrorBoundary: () => void;
  /** Optional title for the error display */
  title?: string;
  /** Optional description */
  description?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Fallback UI displayed when calendar encounters an error
 */
export function CalendarErrorFallback({
  error,
  resetErrorBoundary,
  title = 'Calendar Error',
  description = 'Something went wrong loading the calendar.',
}: CalendarErrorFallbackProps): React.ReactElement {
  return (
    <Paper p="xl" radius="md" withBorder>
      <Stack align="center" gap="md">
        <ThemeIcon size={60} radius="xl" color="red" variant="light">
          <IconAlertTriangle size={32} />
        </ThemeIcon>

        <Title order={3} ta="center">
          {title}
        </Title>

        <Text c="dimmed" ta="center" maw={400}>
          {description}
        </Text>

        <Text size="sm" c="dimmed" ta="center" style={{ fontFamily: 'monospace' }}>
          {error.message}
        </Text>

        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={resetErrorBoundary}
            variant="light"
          >
            Try Again
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

// ============================================================================
// Specialized Fallbacks
// ============================================================================

/**
 * Error fallback for calendar event list
 */
export function CalendarListErrorFallback({
  error,
  resetErrorBoundary,
}: Omit<CalendarErrorFallbackProps, 'title' | 'description'>): React.ReactElement {
  return (
    <CalendarErrorFallback
      error={error}
      resetErrorBoundary={resetErrorBoundary}
      title="Failed to Load Events"
      description="We couldn't load the calendar events. Please try again."
    />
  );
}

/**
 * Error fallback for sidebar
 */
export function CalendarSidebarErrorFallback({
  error,
  resetErrorBoundary,
}: Omit<CalendarErrorFallbackProps, 'title' | 'description'>): React.ReactElement {
  return (
    <CalendarErrorFallback
      error={error}
      resetErrorBoundary={resetErrorBoundary}
      title="Sidebar Error"
      description="Failed to load upcoming releases."
    />
  );
}

/**
 * Minimal inline error for smaller components
 */
export function CalendarInlineError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}): React.ReactElement {
  return (
    <Group gap="xs" c="red">
      <IconAlertTriangle size={16} />
      <Text size="sm">{error.message}</Text>
      {onRetry && (
        <Button size="xs" variant="subtle" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Group>
  );
}
