/**
 * Update Helpers Module
 *
 * Factory functions and utilities for creating type-safe update handlers
 * with optimistic updates, error handling, and notifications.
 *
 * This module eliminates ~300 lines of duplicated code by providing
 * a factory pattern for creating update functions.
 */

import { createElement, type Dispatch, type SetStateAction } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

import type { FileOrganizationConfig } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for update handler factory
 */
export interface UpdateHandlerConfig<T> {
  /** Configuration key for server storage (e.g., 'file.organization.folderStructure') */
  configKey: string;

  /** Field name in FileOrganizationConfig interface */
  fieldName: keyof FileOrganizationConfig;

  /** Success message to display in notification */
  successMessage: string;

  /** Error message prefix (actual error appended) */
  errorMessagePrefix: string;

  /** Optional validator function (return true or error message) */
  validator?: (value: T) => boolean | string;
}

/**
 * State setters for update handler
 */
export interface UpdateHandlerDependencies {
  setState: Dispatch<SetStateAction<FileOrganizationConfig>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  serverSet: (key: string, value: unknown) => Promise<void>;
  reload: () => Promise<void>;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a type-safe update handler with optimistic updates and notifications
 *
 * This factory eliminates code duplication by generating update functions
 * that follow the standard pattern:
 * 1. Validate input (optional)
 * 2. Update state optimistically
 * 3. Update server configuration
 * 4. Show success notification
 * 5. Handle errors with revert and error notification
 *
 * @param config - Configuration for the update handler
 * @param deps - State setters and server functions
 * @returns Async update function
 *
 * @example
 * ```typescript
 * const updateFolderStructure = createUpdateHandler<FolderStructureType>({
 *   configKey: 'file.organization.folderStructure',
 *   fieldName: 'folderStructure',
 *   successMessage: 'Folder structure updated successfully',
 *   errorMessagePrefix: 'Failed to update folder structure',
 *   validator: (value) => {
 *     const valid = ['flat', 'byTitle', 'byTitleYear', 'byPublisher', 'custom'];
 *     return valid.includes(value) || 'Invalid folder structure type';
 *   }
 * }, dependencies);
 * ```
 */
export function createUpdateHandler<T>(
  config: UpdateHandlerConfig<T>,
  deps: UpdateHandlerDependencies
): (value: T) => Promise<void> {
  return async (value: T): Promise<void> => {
    const { setState, setSaving, setError, serverSet, reload } = deps;

    setSaving(true);
    setError(null);

    try {
      // Optional validation
      if (config.validator !== undefined) {
        const validationResult = config.validator(value);
        if (typeof validationResult === 'string') {
          throw new Error(validationResult);
        }
        if (!validationResult) {
          throw new Error('Validation failed');
        }
      }

      // Optimistic update
      setState((prev) => ({
        ...prev,
        [config.fieldName]: value
      }));

      // Server update
      await serverSet(config.configKey, value);

      // Success notification
      showSuccessNotification(config.successMessage);
    } catch (err: unknown) {
      // Revert optimistic update
      void reload();

      // Error handling
      const errorMsg = `${config.errorMessagePrefix}: ${formatError(err)}`;
      setError(errorMsg);
      logger.error(`Error: ${config.errorMessagePrefix}`, err);

      // Error notification
      showErrorNotification(errorMsg);
    } finally {
      setSaving(false);
    }
  };
}

// ============================================================================
// Notification Helpers
// ============================================================================

/**
 * Show success notification
 *
 * @param message - Success message to display
 */
export function showSuccessNotification(message: string): void {
  notifications.show({
    title: 'Success',
    message,
    color: 'green',
    icon: createElement(IconCheck, { size: 16 })
  });
}

/**
 * Show error notification
 *
 * @param message - Error message to display
 */
export function showErrorNotification(message: string): void {
  notifications.show({
    title: 'Error',
    message,
    color: 'red',
    icon: createElement(IconAlertCircle, { size: 16 })
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format error for display
 *
 * Converts unknown error types to user-friendly strings
 *
 * @param err - Error of unknown type
 * @returns Formatted error message
 */
export function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
