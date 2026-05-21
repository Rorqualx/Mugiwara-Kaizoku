/**
 * File Organization Configuration Service
 *
 * This service provides access to file organization configuration settings.
 * It includes functionality for managing folder structure, file naming templates,
 * and organization options for manga files.
 *
 * The service abstracts access to the configuration system,
 * providing a type-safe interface for file organization settings.
 */
import { logger } from '@/utils/logger';

import type { ConfigService } from '../config/configService';
/**
 * Available folder structure types
 */
export type FolderStructureType = 'flat' | 'byTitle' | 'byTitleYear' | 'byPublisher' | 'custom';

/** How files are handled during import */
export type FileMode = 'keep_in_place' | 'move' | 'copy';

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
 * File Organization Configuration Service
 *
 * This service provides methods for accessing and updating file organization
 * configuration through the centralized configuration system.
 */
export class FileOrganizationConfigService {
    /**
     * Default file organization configuration
     */
    private defaultConfig: FileOrganizationConfig = {
        folderStructure: 'byTitle',
        customFolderTemplate: '',
        fileNamingTemplate: '{title} - Chapter {chapter}',
        createMetadataFiles: true,
        fileMode: 'move',
        organizeOnImport: true,
    };
    /**
     * Creates a new FileOrganizationConfigService
     *
     * @param configService - The central configuration service
     */
    constructor(private configService: ConfigService) { }
    /**
     * Load all file organization configuration
     *
     * @returns Complete file organization configuration
     */
    async loadConfig(): Promise<FileOrganizationConfig> {
        try {
            // Folder structure settings
            const folderStructure = await this.configService.get<FolderStructureType>('file.organization.folderStructure', this.defaultConfig.folderStructure);
            const customFolderTemplate = await this.configService.get<string>('file.organization.customFolderTemplate', this.defaultConfig.customFolderTemplate);
            const fileNamingTemplate = await this.configService.get<string>('file.organization.fileNamingTemplate', this.defaultConfig.fileNamingTemplate);
            // Organization options
            const createMetadataFiles = await this.configService.get<boolean>('file.organization.createMetadataFiles', this.defaultConfig.createMetadataFiles);
            const organizeOnImport = await this.configService.get<boolean>('file.organization.organizeOnImport', this.defaultConfig.organizeOnImport);

            const fileMode = await this.configService.get<FileMode>('file.organization.fileMode', this.defaultConfig.fileMode);

            return {
                folderStructure,
                customFolderTemplate,
                fileNamingTemplate,
                createMetadataFiles,
                fileMode,
                organizeOnImport,
            };
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to load file organization configuration: ${errorMessage}`);
            return this.defaultConfig;
        }
    }
    /**
     * Update folder structure
     *
     * @param folderStructure - The folder structure type
     */
    async updateFolderStructure(folderStructure: FolderStructureType): Promise<void> {
        try {
            await this.configService.set('file.organization.folderStructure', folderStructure);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to update folder structure: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Update custom folder template
     *
     * @param template - The custom folder template
     */
    async updateCustomFolderTemplate(template: string): Promise<void> {
        try {
            await this.configService.set('file.organization.customFolderTemplate', template);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to update custom folder template: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Update file naming template
     *
     * @param template - The file naming template
     */
    async updateFileNamingTemplate(template: string): Promise<void> {
        try {
            await this.configService.set('file.organization.fileNamingTemplate', template);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to update file naming template: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Update create metadata files option
     *
     * @param create - Whether to create metadata files
     */
    async updateCreateMetadataFiles(create: boolean): Promise<void> {
        try {
            await this.configService.set('file.organization.createMetadataFiles', create);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to update create metadata files setting: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Update organize on import option
     *
     * @param organize - Whether to organize files on import
     */
    async updateOrganizeOnImport(organize: boolean): Promise<void> {
        try {
            await this.configService.set('file.organization.organizeOnImport', organize);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to update organize on import setting: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Update file mode (keep_in_place, move, or copy)
     */
    async updateFileMode(mode: FileMode): Promise<void> {
        try {
            await this.configService.set('file.organization.fileMode', mode);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to update file mode setting: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Update all file organization configuration
     *
     * @param config - Partial file organization configuration to update
     */
    async updateConfig(config: Partial<FileOrganizationConfig>): Promise<void> {
        try {
            if (config.folderStructure !== undefined) {
                await this.updateFolderStructure(config.folderStructure);
            }
            if (config.customFolderTemplate !== undefined) {
                await this.updateCustomFolderTemplate(config.customFolderTemplate);
            }
            if (config.fileNamingTemplate !== undefined) {
                await this.updateFileNamingTemplate(config.fileNamingTemplate);
            }
            if (config.createMetadataFiles !== undefined) {
                await this.updateCreateMetadataFiles(config.createMetadataFiles);
            }
            if (config.organizeOnImport !== undefined) {
                await this.updateOrganizeOnImport(config.organizeOnImport);
            }
            if (config.fileMode !== undefined) {
                await this.updateFileMode(config.fileMode);
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to update file organization configuration: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Generate a folder path for a manga based on current settings
     *
     * @param mangaInfo - Information about the manga
     * @returns The generated folder path
     */
    async generateFolderPath(mangaInfo: {
        title: string;
        year?: string | number;
        publisher?: string;
        author?: string;
    }): Promise<string> {
        try {
            const config = await this.loadConfig();
            const { folderStructure, customFolderTemplate } = config;
            switch (folderStructure) {
                case 'flat':
                    return ''; // No subfolders
                case 'byTitle':
                    return this.sanitizePath(mangaInfo["title"]);
                case 'byTitleYear': {
                    const year = mangaInfo.year ? ` (${mangaInfo.year})` : '';
                    return this.sanitizePath(`${mangaInfo["title"]}${year}`);
                }
                case 'byPublisher': {
                    const publisher = mangaInfo.publisher || 'Unknown Publisher';
                    return this.sanitizePath(`${publisher}/${mangaInfo["title"]}`);
                }
                case 'custom':
                    // Apply custom template
                    if (!customFolderTemplate) {
                        // Fall back to byTitle if custom template is empty
                        return this.sanitizePath(mangaInfo["title"]);
                    }
                    return this.applyCustomTemplate(customFolderTemplate, mangaInfo);
                default:
                    return this.sanitizePath(mangaInfo["title"]);
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to generate folder path: ${errorMessage}`);
            // Fall back to simple title if there's an error
            return this.sanitizePath(mangaInfo["title"]);
        }
    }
    /**
     * Generate a file name for a chapter based on current settings
     *
     * @param chapterInfo - Information about the chapter
     * @returns The generated file name
     */
    async generateFileName(chapterInfo: {
        title: string;
        chapter: string | number;
        volume?: string | number;
        year?: string | number;
    }): Promise<string> {
        try {
            const config = await this.loadConfig();
            const { fileNamingTemplate } = config;
            // Format chapter number with leading zeros if it's a number
            let formattedChapter = chapterInfo.chapter.toString();
            if (typeof chapterInfo.chapter === 'number') {
                formattedChapter = chapterInfo.chapter.toString().padStart(3, '0');
            }
            // Apply template
            let fileName = fileNamingTemplate
                .replace(/{title}/g, chapterInfo["title"])
                .replace(/{chapter}/g, formattedChapter);
            // Optional replacements
            if (chapterInfo.volume !== undefined) {
                fileName = fileName.replace(/{volume}/g, chapterInfo.volume.toString());
            }
            else {
                fileName = fileName.replace(/{volume}/g, '');
            }
            if (chapterInfo.year !== undefined) {
                fileName = fileName.replace(/{year}/g, chapterInfo.year.toString());
            }
            else {
                fileName = fileName.replace(/{year}/g, '');
            }
            return this.sanitizeFileName(fileName);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Failed to generate file name: ${errorMessage}`);
            // Fall back to simple naming if there's an error
            return this.sanitizeFileName(`${chapterInfo["title"]} - Chapter ${chapterInfo.chapter}`);
        }
    }
    /**
     * Apply a custom template to manga information
     *
     * @param template - The custom template
     * @param mangaInfo - Information about the manga
     * @returns The applied template
     */
    private applyCustomTemplate(template: string, mangaInfo: {
        title: string;
        year?: string | number;
        publisher?: string;
        author?: string;
    }): string {
        let result = template
            .replace(/{title}/g, mangaInfo["title"]);
        // Optional replacements
        if (mangaInfo.year !== undefined) {
            result = result.replace(/{year}/g, mangaInfo.year.toString());
        }
        else {
            result = result.replace(/{year}/g, '');
        }
        if (mangaInfo.publisher !== undefined) {
            result = result.replace(/{publisher}/g, mangaInfo.publisher);
        }
        else {
            result = result.replace(/{publisher}/g, 'Unknown Publisher');
        }
        if (mangaInfo.author !== undefined) {
            result = result.replace(/{author}/g, mangaInfo.author);
        }
        else {
            result = result.replace(/{author}/g, 'Unknown Author');
        }
        return this.sanitizePath(result);
    }
    /**
     * Sanitize a path to remove invalid characters
     *
     * @param path - The path to sanitize
     * @returns The sanitized path
     */
    private sanitizePath(path: string): string {
        // Replace characters that are invalid in file paths
        return path
            .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters with underscore
            .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
            .trim(); // Remove leading/trailing spaces
    }
    /**
     * Sanitize a file name to remove invalid characters
     *
     * @param fileName - The file name to sanitize
     * @returns The sanitized file name
     */
    private sanitizeFileName(fileName: string): string {
        // Sanitize the file name similar to path sanitization
        return this.sanitizePath(fileName);
    }
}
/**
 * Factory function to create a file organization configuration service
 *
 * @param configService - The central configuration service
 * @returns File organization configuration service instance
 */
export function getFileOrganizationConfigService(configService: ConfigService): FileOrganizationConfigService {
    return new FileOrganizationConfigService(configService);
}
