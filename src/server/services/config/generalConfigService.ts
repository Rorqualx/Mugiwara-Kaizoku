/**
 * General Configuration Service
 *
 * Provides centralized access to general application settings.
 * This service acts as an adapter between the main configuration system
 * and application-wide settings, abstracting away configuration storage details.
 *
 * Features:
 * - Type-safe configuration access
 * - Default values
 * - Centralized configuration schema
 * - General application settings
 */

import { ConfigScope } from '@prisma/client';
import { ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';


import type { ConfigService } from './configService';
/**
 * Interface for folder structure settings
 */
export type FolderStructure = 'flat' | 'byTitle' | 'byTitleYear' | 'byPublisher' | 'custom';
/**
 * Interface for file organization settings
 */
/** How files are handled during import */
export type FileMode = 'keep_in_place' | 'move' | 'copy';

export interface FileOrganizationSettings {
    folderStructure: FolderStructure;
    customFolderTemplate?: string;
    fileNamingTemplate: string;
    createMetadataFiles: boolean;
    organizeOnImport: boolean;
    fileMode: FileMode;
}
/**
 * Interface for backup settings
 */
export interface BackupSettings {
    autoBackup: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
    backupLocation: string;
    maxBackups: number;
    includeImages: boolean;
}
/**
 * Interface for general application settings
 */
export interface GeneralSettings {
    fileOrganization: FileOrganizationSettings;
    backup: BackupSettings;
    theme: string;
    language: string;
    developerMode: boolean;
    debug: boolean;
}
/**
 * Service for managing general application settings
 */
export class GeneralConfigService {
    /**
     * Default configuration values
     */
    private defaultConfig: GeneralSettings = {
        fileOrganization: {
            folderStructure: 'byTitle',
            fileNamingTemplate: '${title} - ${chapter}',
            createMetadataFiles: true,
            organizeOnImport: true,
            fileMode: 'move',
        },
        backup: {
            autoBackup: false,
            backupFrequency: 'weekly',
            backupLocation: '/config/backups',
            maxBackups: 5,
            includeImages: false
        },
        theme: 'light',
        language: 'en',
        developerMode: false,
        debug: false
    };
    // Store loaded config
    private configCache: Partial<GeneralSettings> | null = null;
    constructor(private configService: ConfigService) { }
    /**
     * Load the current general settings
     *
     * @returns Promise resolving to the current configuration
     */
    async loadConfig(): Promise<Partial<GeneralSettings>> {
        try {
            // If we have cached config, return it
            if (this.configCache) {
                return this.configCache;
            }
            // Load file organization settings
            const folderStructure = await this.get<FolderStructure>('fileOrganization.folderStructure', this.defaultConfig.fileOrganization.folderStructure);
            const customFolderTemplate = await this.get<string | undefined>('fileOrganization.customFolderTemplate', this.defaultConfig.fileOrganization.customFolderTemplate);
            const fileNamingTemplate = await this.get<string>('fileOrganization.fileNamingTemplate', this.defaultConfig.fileOrganization.fileNamingTemplate);
            const createMetadataFiles = await this.get<boolean>('fileOrganization.createMetadataFiles', this.defaultConfig.fileOrganization.createMetadataFiles);
            const organizeOnImport = await this.get<boolean>('fileOrganization.organizeOnImport', this.defaultConfig.fileOrganization.organizeOnImport);
            const fileMode = await this.get<FileMode>('fileOrganization.fileMode', this.defaultConfig.fileOrganization.fileMode);
            // Load backup settings
            const autoBackup = await this.get<boolean>('backup.autoBackup', this.defaultConfig.backup.autoBackup);
            const backupFrequency = await this.get<'daily' | 'weekly' | 'monthly' | 'never'>('backup.backupFrequency', this.defaultConfig.backup.backupFrequency);
            const backupLocation = await this.get<string>('backup.backupLocation', this.defaultConfig.backup.backupLocation);
            const maxBackups = await this.get<number>('backup.maxBackups', this.defaultConfig.backup.maxBackups);
            const includeImages = await this.get<boolean>('backup.includeImages', this.defaultConfig.backup.includeImages);
            // Load other general settings
            const theme = await this.get<string>('theme', this.defaultConfig.theme);
            const language = await this.get<string>('language', this.defaultConfig.language);
            const developerMode = await this.get<boolean>('developerMode', this.defaultConfig.developerMode);
            const debug = await this.get<boolean>('debug', this.defaultConfig.debug);
            // Build the full config
            const config: GeneralSettings = {
                fileOrganization: {
                    folderStructure,
                    ...(customFolderTemplate !== undefined ? { customFolderTemplate } : {}),
                    fileNamingTemplate,
                    createMetadataFiles,
                    organizeOnImport,
                    fileMode
                },
                backup: {
                    autoBackup,
                    backupFrequency,
                    backupLocation,
                    maxBackups,
                    includeImages
                },
                theme,
                language,
                developerMode,
                debug
            };
            // Cache the config
            this.configCache = config;
            return config;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error loading general configuration: ${errorMessage}`);
            return this.defaultConfig;
        }
    }
    /**
     * Get a specific configuration value
     *
     * @param key - The configuration key (dot notation)
     * @param defaultValue - Default value if not found
     * @returns Promise resolving to the configuration value
     */
    async get<T>(key: string, _defaultValue: T): Promise<T> {
        // Type system guarantees get() returns T (never null/undefined based on type signature)
        return this.configService.get<T>(`general.${key}`);
    }
    /**
     * Set a specific configuration value
     *
     * @param key - The configuration key (dot notation)
     * @param value - The value to set
     * @param metadata - Optional metadata about the configuration
     * @returns Promise resolving when the update is complete
     */
    async set<T>(key: string, value: T, metadata?: {
        scope?: ConfigScope;
        valueType?: ConfigValueType;
        metadata?: Record<string, unknown>;
    }): Promise<void> {
        // Clear the cache when setting a value
        this.configCache = null;
        // Determine value type based on the value type
        const valueType = typeof value === 'string' ? ConfigValueType.STRING :
            typeof value === 'number' ? ConfigValueType.NUMBER :
                typeof value === 'boolean' ? ConfigValueType.BOOLEAN :
                    Array.isArray(value) ? ConfigValueType.ARRAY :
                        value instanceof Date ? ConfigValueType.DATE :
                            ConfigValueType.OBJECT;
        // Default metadata if not provided
        const configMetadata = {
            scope: ConfigScope.USER,
            ...(metadata ?? {}),
            valueType: metadata?.valueType ?? valueType
        };
        await this.configService.set(`general.${key}`, value, configMetadata);
    }
    /**
     * Update file organization settings
     *
     * @param settings - Partial file organization settings to update
     * @returns Promise resolving when the update is complete
     */
    async updateFileOrganization(settings: Partial<FileOrganizationSettings>): Promise<void> {
        // Clear the cache
        this.configCache = null;
        // Update each provided setting
        if (settings.folderStructure !== undefined) {
            await this.set<FolderStructure>('fileOrganization.folderStructure', settings.folderStructure, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.STRING,
                metadata: {
                    label: 'Folder Structure',
                    description: 'How to organize manga folders',
                    category: 'File Organization',
                    ui: {
                        order: 1
                    },
                    options: [
                        { value: 'flat', label: 'Flat (No subfolders)' },
                        { value: 'byTitle', label: 'By Title' },
                        { value: 'byTitleYear', label: 'By Title/Year' },
                        { value: 'byPublisher', label: 'By Publisher' },
                        { value: 'custom', label: 'Custom' }
                    ]
                }
            });
        }
        if (settings.customFolderTemplate !== undefined) {
            await this.set<string | undefined>('fileOrganization.customFolderTemplate', settings.customFolderTemplate, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.STRING,
                metadata: {
                    label: 'Custom Folder Template',
                    description: 'Template for custom folder structure',
                    category: 'File Organization',
                    ui: {
                        order: 2
                    }
                }
            });
        }
        if (settings.fileNamingTemplate !== undefined) {
            await this.set<string>('fileOrganization.fileNamingTemplate', settings.fileNamingTemplate, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.STRING,
                metadata: {
                    label: 'File Naming Template',
                    description: 'Template for file names',
                    category: 'File Organization',
                    ui: {
                        order: 3
                    }
                }
            });
        }
        if (settings.createMetadataFiles !== undefined) {
            await this.set<boolean>('fileOrganization.createMetadataFiles', settings.createMetadataFiles, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.BOOLEAN,
                metadata: {
                    label: 'Create Metadata Files',
                    description: 'Create metadata files for each manga',
                    category: 'File Organization',
                    ui: {
                        order: 4
                    }
                }
            });
        }
        if (settings.organizeOnImport !== undefined) {
            await this.set<boolean>('fileOrganization.organizeOnImport', settings.organizeOnImport, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.BOOLEAN,
                metadata: {
                    label: 'Organize on Import',
                    description: 'Automatically organize files when importing',
                    category: 'File Organization',
                    ui: {
                        order: 5
                    }
                }
            });
        }
        if (settings.fileMode !== undefined) {
            await this.set<FileMode>('fileOrganization.fileMode', settings.fileMode, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.STRING,
                metadata: {
                    label: 'File Mode',
                    description: 'How files are handled during import (keep_in_place, move, or copy)',
                    category: 'File Organization',
                    ui: {
                        order: 6
                    },
                    options: [
                        { value: 'keep_in_place', label: 'Keep in Place' },
                        { value: 'move', label: 'Move' },
                        { value: 'copy', label: 'Copy' }
                    ]
                }
            });
        }
    }
    /**
     * Update backup settings
     *
     * @param settings - Partial backup settings to update
     * @returns Promise resolving when the update is complete
     */
    async updateBackupSettings(settings: Partial<BackupSettings>): Promise<void> {
        // Clear the cache
        this.configCache = null;
        // Update each provided setting
        if (settings.autoBackup !== undefined) {
            await this.set<boolean>('backup.autoBackup', settings.autoBackup, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.BOOLEAN,
                metadata: {
                    label: 'Auto Backup',
                    description: 'Enable automatic backups',
                    category: 'Backup',
                    ui: {
                        order: 1
                    }
                }
            });
        }
        if (settings.backupFrequency !== undefined) {
            await this.set<'daily' | 'weekly' | 'monthly' | 'never'>('backup.backupFrequency', settings.backupFrequency, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.STRING,
                metadata: {
                    label: 'Backup Frequency',
                    description: 'How often to create backups',
                    category: 'Backup',
                    ui: {
                        order: 2
                    },
                    options: [
                        { value: 'daily', label: 'Daily' },
                        { value: 'weekly', label: 'Weekly' },
                        { value: 'monthly', label: 'Monthly' },
                        { value: 'never', label: 'Never' }
                    ]
                }
            });
        }
        if (settings.backupLocation !== undefined) {
            await this.set<string>('backup.backupLocation', settings.backupLocation, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.STRING,
                metadata: {
                    label: 'Backup Location',
                    description: 'Directory to store backups',
                    category: 'Backup',
                    ui: {
                        order: 3
                    }
                }
            });
        }
        if (settings.maxBackups !== undefined) {
            await this.set<number>('backup.maxBackups', settings.maxBackups, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.NUMBER,
                metadata: {
                    label: 'Max Backups',
                    description: 'Maximum number of backups to keep',
                    category: 'Backup',
                    ui: {
                        order: 4
                    },
                    validation: {
                        min: 1,
                        max: 100
                    }
                }
            });
        }
        if (settings.includeImages !== undefined) {
            await this.set<boolean>('backup.includeImages', settings.includeImages, {
                scope: ConfigScope.USER,
                valueType: ConfigValueType.BOOLEAN,
                metadata: {
                    label: 'Include Images',
                    description: 'Include cover images in backups',
                    category: 'Backup',
                    ui: {
                        order: 5
                    }
                }
            });
        }
    }
    /**
     * Get file organization settings
     *
     * @returns Promise resolving to file organization settings
     */
    async getFileOrganizationSettings(): Promise<FileOrganizationSettings> {
        const config = await this.loadConfig();
        return config.fileOrganization ?? this.defaultConfig.fileOrganization;
    }
    /**
     * Get backup settings
     *
     * @returns Promise resolving to backup settings
     */
    async getBackupSettings(): Promise<BackupSettings> {
        const config = await this.loadConfig();
        return config.backup ?? this.defaultConfig.backup;
    }
    /**
     * Clear the configuration cache
     */
    clearCache(): void {
        this.configCache = null;
    }
}
// Create and export the config service factory
let generalConfigServiceInstance: GeneralConfigService | null = null;
/**
 * Get the general config service singleton instance
 *
 * @param configService - The main config service to use
 * @returns The general config service instance
 */
export function getGeneralConfigService(configService: ConfigService): GeneralConfigService {
    generalConfigServiceInstance ??= new GeneralConfigService(configService);
    return generalConfigServiceInstance;
}
