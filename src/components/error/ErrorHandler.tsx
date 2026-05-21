/**
 * Error Handler Component
 * 
 * This component displays application errors and success messages in a fixed position
 * at the bottom right of the screen. It groups errors by type and provides dismissal
 * functionality. Success messages are automatically cleared after 5 seconds.
 * 
 * @module components/error/ErrorHandler
 */
import React from "react";
import { useEffect, useCallback } from 'react';

import { Box, Alert, Button, Stack, Text, rem } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { useStoreActions } from '@/store/useStoreActions';
import { useStoreSelectors } from '@/store/useStoreSelectors';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility

/**
 * ErrorHandler component that displays and manages application errors
 * 
 * This component:
 * 1. Retrieves errors from the global store
 * 2. Groups errors by type (error, success, etc.)
 * 3. Automatically clears success messages after 5 seconds
 * 4. Provides manual dismissal for error messages
 * 
 * @returns {JSX.Element|null} The error handler component or null if no errors
 * 
 * @example
 * ```tsx
 * // In your app root component
 * <ErrorHandler />
 * ```
 */
export function ErrorHandler(): JSX.Element | null {
  const storeSelectors = useStoreSelectors();
  const { errors } = storeSelectors;
  const storeActions = useStoreActions();
  // Create a local implementation of clearError since it's missing from the store
  const clearError = useCallback((_key: string) => {
    // Use setError from uiActions to set the error to null, effectively clearing it
    const setError = storeActions['setError'] as ((error: string | null) => void) | undefined;
    if (typeof setError === 'function') {
      setError(null);
    }
  }, [storeActions]);

  // Group errors by type
  const groupedErrors = Object.entries(errors).reduce<Record<string, {key: string;message: string;}[]>>((acc, [key, error]) => {
    if (!error || typeof error !== 'string') return acc;
    const type = key.split('-')[0] ?? 'UNKNOWN';
    return {
      ...acc,
      [type]: [...(acc[type] ?? []), { key, message: error }]
    };
  }, {} as Record<string, {key: string;message: string;}[]>);

  // Auto-clear successful operations after 5 seconds
  useEffect(() => {
    const timers = Object.entries(errors).
    map(([key, error]) => {
      if (error && typeof error === 'string' && error.includes('Successfully')) {
        return setTimeout(() => {
          clearError(key);
        }, 5000);
      }
      return undefined;
    }).
    filter((timer): timer is NodeJS.Timeout => timer !== undefined);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [errors, clearError]);

  if (Object.keys(groupedErrors).length === 0) return null;

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: rem(20),
        right: rem(20),
        zIndex: 1000,
        maxWidth: rem(400)
      }}>

      <Stack gap="xs">
        {Object.entries(groupedErrors).map(([type, typeErrors]) =>
        <Alert
          key={type}
          color={type === 'success' ? 'teal' : 'red'}
          icon={<IconAlertCircle />}
          withCloseButton
          onClose={() => {
            typeErrors.forEach(({ key }) => clearError(key));
          }}>

            <Stack gap="xs">
              {typeErrors.map(({ key, message }) =>
            <Box key={key}>
                  <Text fw={500} size="sm">{key.split('-')[1] ?? 'Error'}</Text>
                  {message}
                  {type === 'error' &&
              <Button
                variant="subtle"
                size="xs"
                mt="xs"
                onClick={() => clearError(key)}>

                      Dismiss
                    </Button>
              }
                </Box>
            )}
            </Stack>
          </Alert>
        )}
      </Stack>
    </Box>);

}