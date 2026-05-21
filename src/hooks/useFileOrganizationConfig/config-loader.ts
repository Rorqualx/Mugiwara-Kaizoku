/**
 * Configuration Loader Module
 *
 * Handles loading file organization configuration from the server.
 *
 * Extracted from: useFileOrganizationConfig.ts (lines 152-186)
 */

import { defaultFileOrganizationConfig } from './types';

import type { FileOrganizationConfig, FolderStructureType } from './types';

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load file organization configuration from server
 *
 * Loads all file organization settings and returns a complete configuration object.
 * Falls back to default values if any setting is undefined.
 *
 * @param get - Function to retrieve configuration value from server
 * @returns Complete file organization configuration
 *
 * @example
 * ```typescript
 * const config = await loadFileOrganizationConfig(get);
 * // config.folderStructure => 'byTitle'
 * ```
 */
export async function loadFileOrganizationConfig(
  get: <T>(key: string) => Promise<T | undefined>
): Promise<FileOrganizationConfig> {
  // Folder structure settings
  const folderStructure = (await get<FolderStructureType>('file.organization.folderStructure')) ?? defaultFileOrganizationConfig.folderStructure;

  const customFolderTemplate = (await get<string>('file.organization.customFolderTemplate')) ?? defaultFileOrganizationConfig.customFolderTemplate;

  const fileNamingTemplate = (await get<string>('file.organization.fileNamingTemplate')) ?? defaultFileOrganizationConfig.fileNamingTemplate;

  // Organization options
  const createMetadataFiles = (await get<boolean>('file.organization.createMetadataFiles')) ?? defaultFileOrganizationConfig.createMetadataFiles;

  const organizeOnImport = (await get<boolean>('file.organization.organizeOnImport')) ?? defaultFileOrganizationConfig.organizeOnImport;

  const fileMode = (await get<'keep_in_place' | 'move' | 'copy'>('file.organization.fileMode')) ?? defaultFileOrganizationConfig.fileMode;

  // Return complete configuration
  return {
    folderStructure,
    customFolderTemplate,
    fileNamingTemplate,
    createMetadataFiles,
    fileMode,
    organizeOnImport,
  };
}
