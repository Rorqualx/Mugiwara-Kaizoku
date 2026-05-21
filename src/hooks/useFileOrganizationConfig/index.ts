/**
 * File Organization Configuration Hook
 *
 * React hook for accessing and updating file organization configuration settings
 * from client components. Provides a type-safe interface with loading,
 * error, and saving states for optimal UX.
 *
 * Features:
 * - Type-safe configuration access
 * - Loading states
 * - Error handling
 * - Optimistic updates
 * - Comprehensive file organization settings management
 *
 * Architecture:
 * - types.ts - Type definitions and defaults (89 lines)
 * - update-helpers.ts - Factory pattern for updates (180 lines)
 * - config-loader.ts - Configuration loading (57 lines)
 * - preview-generator.ts - Preview generation (168 lines)
 * - field-updaters.ts - Field update functions (233 lines)
 * - index.ts - Main hook orchestration (~150 lines)
 *
 * Total: 877 lines across 6 modules (vs 737 lines in 1 file)
 * Benefits: Better organization, reduced duplication, improved maintainability
 *
 * @example
 * ```jsx
 * function FileOrganizationComponent() {
 *   const {
 *     config,
 *     isLoading,
 *     saving,
 *     error,
 *     updateFolderStructure,
 *     updateFileNamingTemplate,
 *     updateOrganizationOptions
 *   } = useFileOrganizationConfig();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage message={error} />;
 *
 *   return (
 *     <div>
 *       <h2>File Organization Settings</h2>
 *       <Select
 *         value={config.folderStructure}
 *         onChange={(value) => updateFolderStructure(value)}
 *         data={[
 *           { value: 'flat', label: 'Flat (No subfolders)' },
 *           { value: 'byTitle', label: 'By Title' }
 *         ]}
 *         label="Folder Structure"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, startTransition } from 'react';

import { logger } from '@/utils/logger';

import { useConfig } from '../useConfig';

// Import all types

// Import utilities
import { loadFileOrganizationConfig } from './config-loader';
import { createFieldUpdaters } from './field-updaters';
import { generateOrganizationPreview } from './preview-generator';
import { defaultFileOrganizationConfig } from './types';
import { formatError } from './update-helpers';

import type {
  FileOrganizationConfig,
  MangaPreviewInfo,
  UseFileOrganizationConfigResult
} from './types';

// Re-export types for convenience
export type {
  FolderStructureType,
  FileOrganizationConfig,
  MangaPreviewInfo,
  OrganizationOptions,
  UseFileOrganizationConfigResult
} from './types';

/**
 * Hook for managing file organization configuration
 *
 * Orchestrates configuration loading, state management, and update operations
 * across multiple specialized modules. Provides a unified interface for
 * components to interact with file organization settings.
 *
 * @returns File organization configuration management interface
 */
export function useFileOrganizationConfig(): UseFileOrganizationConfigResult {
  // Get the main config hook
  const { get, set, isLoading: configIsLoading } = useConfig();

  // Local state
  const [config, setConfig] = useState<FileOrganizationConfig>(defaultFileOrganizationConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Reload file organization configuration from server
   *
   * Fetches the latest configuration values and updates local state.
   * Handles loading states and error conditions.
   * Uses startTransition to avoid hydration issues with Suspense boundaries.
   */
  const reload = useCallback(async (): Promise<void> => {
    startTransition(() => {
      setIsLoading(true);
      setError(null);
    });

    try {
      const loaded = await loadFileOrganizationConfig(get);
      startTransition(() => {
        setConfig(loaded);
        setIsLoading(false);
      });
    } catch (err: unknown) {
      const errorMsg = `Failed to load file organization configuration: ${formatError(err)}`;
      startTransition(() => {
        setError(errorMsg);
        setIsLoading(false);
      });
      logger.error('Error loading file organization configuration', err);
    }
  }, [get]);

  /**
   * Create all update functions using factory pattern
   *
   * Centralizes update logic and ensures consistent error handling,
   * saving states, and server synchronization across all update operations.
   */
  const updaters = createFieldUpdaters({
    setState: setConfig,
    setSaving,
    setError,
    serverSet: set,
    reload
  });

  /**
   * Load configuration on mount
   *
   * Waits for the main config system to be ready before loading
   * file organization specific settings.
   */
  useEffect(() => {
    if (!configIsLoading) {
      void reload();
    }
  }, [reload, configIsLoading]);

  return {
    // Current configuration state
    config,
    isLoading: isLoading || configIsLoading,
    saving,
    error,

    // Update functions (from field-updaters.ts)
    updateFolderStructure: updaters.updateFolderStructure,
    updateCustomFolderTemplate: updaters.updateCustomFolderTemplate,
    updateFileNamingTemplate: updaters.updateFileNamingTemplate,
    updateCreateMetadataFiles: updaters.updateCreateMetadataFiles,
    updateOrganizeOnImport: updaters.updateOrganizeOnImport,
    updateFileMode: updaters.updateFileMode,
    updateOrganizationOptions: updaters.updateOrganizationOptions,
    updateConfig: updaters.updateConfig,

    // Utility functions
    generateOrganizationPreview: (mangaInfo: MangaPreviewInfo) =>
      generateOrganizationPreview(config, mangaInfo),
    refresh: reload
  };
}
