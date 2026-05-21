/**
 * Field Updaters Module
 *
 * Type-safe update functions for all file organization configuration fields.
 * Uses factory pattern to eliminate code duplication.
 *
 * Original: 8 functions × ~45 lines = ~360 lines
 * Refactored: ~100 lines (72% reduction)
 */

import { logger } from '@/utils/logger';

import { createUpdateHandler, type UpdateHandlerDependencies } from './update-helpers';

import type { FolderStructureType, FileOrganizationConfig, OrganizationOptions } from './types';

// ============================================================================
// Field Update Functions
// ============================================================================

/**
 * Create all field update functions using factory pattern
 *
 * @param deps - State setters and server functions
 * @returns Object with all update functions
 */
export function createFieldUpdaters(deps: UpdateHandlerDependencies): {
  updateFolderStructure: (folderStructure: FolderStructureType) => Promise<void>;
  updateCustomFolderTemplate: (template: string) => Promise<void>;
  updateFileNamingTemplate: (template: string) => Promise<void>;
  updateCreateMetadataFiles: (create: boolean) => Promise<void>;
  updateOrganizeOnImport: (organize: boolean) => Promise<void>;
  updateFileMode: (mode: 'keep_in_place' | 'move' | 'copy') => Promise<void>;
  updateOrganizationOptions: (options: OrganizationOptions) => Promise<void>;
  updateConfig: (config: Partial<FileOrganizationConfig>) => Promise<void>;
} {
  return {
    /**
     * Update folder structure type
     */
    updateFolderStructure: createUpdateHandler<FolderStructureType>(
      {
        configKey: 'file.organization.folderStructure',
        fieldName: 'folderStructure',
        successMessage: 'Folder structure updated successfully',
        errorMessagePrefix: 'Failed to update folder structure',
        validator: (value) => {
          const validStructures: FolderStructureType[] = [
            'flat',
            'byTitle',
            'byTitleYear',
            'byPublisher',
            'custom'
          ];
          return validStructures.includes(value) || 'Invalid folder structure type';
        }
      },
      deps
    ),

    /**
     * Update custom folder template
     */
    updateCustomFolderTemplate: createUpdateHandler<string>(
      {
        configKey: 'file.organization.customFolderTemplate',
        fieldName: 'customFolderTemplate',
        successMessage: 'Custom folder template updated successfully',
        errorMessagePrefix: 'Failed to update custom folder template'
      },
      deps
    ),

    /**
     * Update file naming template
     */
    updateFileNamingTemplate: createUpdateHandler<string>(
      {
        configKey: 'file.organization.fileNamingTemplate',
        fieldName: 'fileNamingTemplate',
        successMessage: 'File naming template updated successfully',
        errorMessagePrefix: 'Failed to update file naming template'
      },
      deps
    ),

    /**
     * Update create metadata files option
     */
    updateCreateMetadataFiles: createUpdateHandler<boolean>(
      {
        configKey: 'file.organization.createMetadataFiles',
        fieldName: 'createMetadataFiles',
        successMessage: 'Create metadata files setting updated successfully',
        errorMessagePrefix: 'Failed to update create metadata files setting'
      },
      deps
    ),

    /**
     * Update organize on import option
     */
    updateOrganizeOnImport: createUpdateHandler<boolean>(
      {
        configKey: 'file.organization.organizeOnImport',
        fieldName: 'organizeOnImport',
        successMessage: 'Organize on import setting updated successfully',
        errorMessagePrefix: 'Failed to update organize on import setting'
      },
      deps
    ),

    /**
     * Update file mode (keep_in_place, move, or copy)
     */
    updateFileMode: createUpdateHandler<'keep_in_place' | 'move' | 'copy'>(
      {
        configKey: 'file.organization.fileMode',
        fieldName: 'fileMode',
        successMessage: 'File mode updated successfully',
        errorMessagePrefix: 'Failed to update file mode',
        validator: (value) => {
          const validModes: Array<'keep_in_place' | 'move' | 'copy'> = ['keep_in_place', 'move', 'copy'];
          return validModes.includes(value) || 'Invalid file mode';
        }
      },
      deps
    ),

    /**
     * Update multiple organization options at once
     */
    updateOrganizationOptions: async (options: OrganizationOptions): Promise<void> => {
      const { setState, setSaving, setError, serverSet, reload } = deps;

      setSaving(true);
      setError(null);

      try {
        // Optimistic update
        setState((prev) => ({
          ...prev,
          ...options
        }));

        // Update server (all options in parallel)
        const updatePromises: Promise<void>[] = [];

        if (options.createMetadataFiles !== undefined) {
          updatePromises.push(serverSet('file.organization.createMetadataFiles', options.createMetadataFiles));
        }

        if (options.organizeOnImport !== undefined) {
          updatePromises.push(serverSet('file.organization.organizeOnImport', options.organizeOnImport));
        }

        if (options.fileMode !== undefined) {
          updatePromises.push(serverSet('file.organization.fileMode', options.fileMode));
        }

        await Promise.all(updatePromises);

        // Success notification
        const { showSuccessNotification } = await import('./update-helpers');
        showSuccessNotification('Organization options updated successfully');
      } catch (err: unknown) {
        // Revert and show error
        void reload();
        const { formatError, showErrorNotification } = await import('./update-helpers');
        const errorMsg = `Failed to update organization options: ${formatError(err)}`;
        setError(errorMsg);
        logger.error('Error updating organization options', err);
        showErrorNotification(errorMsg);
      } finally {
        setSaving(false);
      }
    },

    /**
     * Update entire configuration (multiple fields at once)
     */
    updateConfig: async (config: Partial<FileOrganizationConfig>): Promise<void> => {
      const { setState, setSaving, setError, serverSet, reload } = deps;

      setSaving(true);
      setError(null);

      try {
        // Optimistic update
        setState((prev) => ({
          ...prev,
          ...config
        }));

        // Update server (all fields in parallel)
        const updatePromises: Promise<void>[] = [];

        if (config.folderStructure !== undefined) {
          updatePromises.push(serverSet('file.organization.folderStructure', config.folderStructure));
        }

        if (config.customFolderTemplate !== undefined) {
          updatePromises.push(serverSet('file.organization.customFolderTemplate', config.customFolderTemplate));
        }

        if (config.fileNamingTemplate !== undefined) {
          updatePromises.push(serverSet('file.organization.fileNamingTemplate', config.fileNamingTemplate));
        }

        if (config.createMetadataFiles !== undefined) {
          updatePromises.push(serverSet('file.organization.createMetadataFiles', config.createMetadataFiles));
        }

        if (config.organizeOnImport !== undefined) {
          updatePromises.push(serverSet('file.organization.organizeOnImport', config.organizeOnImport));
        }

        if (config.fileMode !== undefined) {
          updatePromises.push(serverSet('file.organization.fileMode', config.fileMode));
        }

        await Promise.all(updatePromises);

        // Success notification
        const { showSuccessNotification } = await import('./update-helpers');
        showSuccessNotification('File organization settings updated successfully');
      } catch (err: unknown) {
        // Revert and show error
        void reload();
        const { formatError, showErrorNotification } = await import('./update-helpers');
        const errorMsg = `Failed to update file organization settings: ${formatError(err)}`;
        setError(errorMsg);
        logger.error('Error updating file organization settings', err);
        showErrorNotification(errorMsg);
      } finally {
        setSaving(false);
      }
    }
  };
}
