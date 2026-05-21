/**
 * File Organization Configuration Types
 *
 * Type definitions and interfaces for file organization configuration.
 * Shared across all file organization modules.
 *
 * Extracted from: useFileOrganizationConfig.ts (lines 68-132)
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Available folder structure types
 */
export type FolderStructureType = 'flat' | 'byTitle' | 'byTitleYear' | 'byPublisher' | 'custom';

/** How files are handled during import */
export type FileMode = 'keep_in_place' | 'move' | 'copy';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Interface for file organization configuration
 */
export interface FileOrganizationConfig {
  folderStructure: FolderStructureType;
  customFolderTemplate: string;
  fileNamingTemplate: string;
  createMetadataFiles: boolean;
  /** How files are handled: keep_in_place (reference), move (relocate), copy (duplicate) */
  fileMode: FileMode;
  organizeOnImport: boolean;
}

/**
 * Manga information for preview generation
 */
export interface MangaPreviewInfo {
  title: string;
  chapter: string | number;
  volume?: string | number;
  year?: string | number;
  publisher?: string;
}

/**
 * Organization options for partial updates
 */
export interface OrganizationOptions {
  createMetadataFiles?: boolean;
  organizeOnImport?: boolean;
  fileMode?: FileMode;
}

/**
 * Return type for useFileOrganizationConfig hook
 */
export interface UseFileOrganizationConfigResult {
  config: FileOrganizationConfig;
  isLoading: boolean;
  saving: boolean;
  error: string | null;
  updateFolderStructure: (folderStructure: FolderStructureType) => Promise<void>;
  updateCustomFolderTemplate: (template: string) => Promise<void>;
  updateFileNamingTemplate: (template: string) => Promise<void>;
  updateCreateMetadataFiles: (create: boolean) => Promise<void>;
  updateOrganizeOnImport: (organize: boolean) => Promise<void>;
  updateFileMode: (mode: FileMode) => Promise<void>;
  updateOrganizationOptions: (options: OrganizationOptions) => Promise<void>;
  updateConfig: (config: Partial<FileOrganizationConfig>) => Promise<void>;
  generateOrganizationPreview: (mangaInfo: MangaPreviewInfo) => string;
  refresh: () => Promise<void>;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default file organization configuration values
 */
export const defaultFileOrganizationConfig: FileOrganizationConfig = {
  folderStructure: 'byTitle',
  customFolderTemplate: '',
  fileNamingTemplate: '{title} - Chapter {chapter}',
  createMetadataFiles: true,
  fileMode: 'move',
  organizeOnImport: true,
};
