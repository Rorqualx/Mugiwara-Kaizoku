/**
 * File Organization Settings Utility Functions
 *
 * Helper functions for generating folder paths and file names based on templates.
 *
 * @module components/settings/FileOrganizationSettings/utils
 */

export type FolderStructureType = 'flat' | 'byTitle' | 'byTitleYear' | 'byPublisher' | 'custom';

/** How files are handled during import */
export type FileMode = 'keep_in_place' | 'move' | 'copy';

export interface SampleMangaData {
    title: string;
    chapter: string;
    volume: string;
    year: string;
    publisher: string;
    author: string;
}

export interface FileOrganizationSettingsData {
    folderStructure?: FolderStructureType;
    customFolderTemplate?: string;
    volumeNamingTemplate?: string;
    chapterNamingTemplate?: string;
    /** @deprecated Use volumeNamingTemplate and chapterNamingTemplate instead */
    fileNamingTemplate?: string;
    libraryBasePath?: string;
    createMetadataFiles?: boolean;
    /** How files are handled: keep_in_place (reference), move (relocate), copy (duplicate) */
    fileMode?: FileMode;
    organizeOnImport?: boolean;
    createVolumeFolders?: boolean;
    splitVolumeFiles?: boolean;
}

/**
 * Replace template placeholders with actual values
 */
export function replacePlaceholders(template: string, data: SampleMangaData | Record<string, string>): string {
    let result = template;
    Object.entries(data).forEach(([key, value]) => {
        result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
    });
    return result;
}

/**
 * Generate folder path based on folder structure settings
 */
export function generateFolderPath(
    folderStructure: FolderStructureType,
    customFolderTemplate: string,
    libraryBasePath: string,
    createVolumeFolders: boolean,
    sampleManga: SampleMangaData
): string {
    const basePath = libraryBasePath.endsWith('/') ? libraryBasePath.slice(0, -1) : libraryBasePath;
    let path = '';

    switch (folderStructure) {
        case 'flat':
            path = `${basePath}/`;
            break;
        case 'byTitle':
            path = `${basePath}/${sampleManga.title}/`;
            break;
        case 'byTitleYear':
            path = `${basePath}/${sampleManga.title} (${sampleManga.year})/`;
            break;
        case 'byPublisher':
            path = `${basePath}/${sampleManga.publisher}/${sampleManga.title}/`;
            break;
        case 'custom':
            if (!customFolderTemplate) {
                path = `${basePath}/`;
            } else {
                const preview = replacePlaceholders(customFolderTemplate, sampleManga);
                path = `${basePath}/${preview}/`;
            }
            break;
        default:
            path = `${basePath}/`;
    }

    // Add volume folder if enabled
    if (createVolumeFolders && sampleManga.volume) {
        const volumeFolder = `${sampleManga.title} Vol ${sampleManga.volume}`;
        path = path.slice(0, -1) + `/${volumeFolder}/`;
    }

    return path;
}

/**
 * Generate volume file name based on template
 */
export function generateVolumeFileName(volumeNamingTemplate: string, sampleManga: SampleMangaData): string {
    if (!volumeNamingTemplate) return 'volume_file.cbz';

    const preview = replacePlaceholders(volumeNamingTemplate, sampleManga);
    return `${preview}.cbz`;
}

/**
 * Generate chapter file name based on template
 */
export function generateChapterFileName(chapterNamingTemplate: string, sampleManga: SampleMangaData): string {
    if (!chapterNamingTemplate) return 'chapter_file.cbz';

    const preview = replacePlaceholders(chapterNamingTemplate, sampleManga);
    return `${preview}.cbz`;
}

/**
 * Default sample manga data for previews
 */
export const DEFAULT_SAMPLE_MANGA: SampleMangaData = {
    title: 'Fire Force',
    chapter: '00',
    volume: '01',
    year: '2024',
    publisher: 'Kodansha',
    author: 'Atsushi Ohkubo'
};
