/**
 * Content Classifier Service
 *
 * Smart content classification for downloaded manga files.
 * Analyzes file structure, naming patterns, and sizes to determine
 * optimal import strategy.
 *
 * @module content-classifier/classifier
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import AdmZip from 'adm-zip';

import { logger } from '@/utils/logger';

import {
  extractVolumeNumber,
  extractChapterNumber,
  extractTitle,
  isLikelyVolume,
  detectFolderStructure,
  groupByVolume,
} from './pattern-detector';
import {
  type ClassificationResult,
  type ClassificationOptions,
  type FileClassification,
  type VolumeInfo,
  type ChapterInfo,
  type ContentType,
  type ArchiveStructure,
  type ImportRecommendation,
  DEFAULT_CLASSIFICATION_OPTIONS,
} from './types';

/** Supported archive extensions */
const ARCHIVE_EXTENSIONS = ['.cbz', '.zip', '.cbr', '.rar', '.7z', '.cb7', '.tar', '.cbt'];

/** Supported image extensions */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * Check if file is an archive
 */
function isArchiveFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ARCHIVE_EXTENSIONS.includes(ext);
}

/**
 * Check if file is an image
 */
function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Classify a single file
 */
function classifyFile(filePath: string, filename: string, size: number): FileClassification {
  const isArchive = isArchiveFile(filename);
  const isImage = isImageFile(filename);

  const volumeMatch = extractVolumeNumber(filename);
  const chapterMatch = extractChapterNumber(filename);
  const titleMatch = extractTitle(filename);

  // Calculate confidence based on matches
  let confidence = 0.5;
  if (volumeMatch) confidence = Math.max(confidence, volumeMatch.confidence);
  if (chapterMatch) confidence = Math.max(confidence, chapterMatch.confidence);

  return {
    filename,
    filePath,
    size,
    isArchive,
    isImage,
    isDirectory: false,
    volumeNumber: volumeMatch?.value as number | undefined,
    chapterNumber: chapterMatch?.value as number | undefined,
    detectedTitle: titleMatch?.value as string | undefined,
    confidence,
  };
}

/**
 * Scan directory for files
 */
async function scanDirectory(dirPath: string, maxFiles: number): Promise<FileClassification[]> {
  const files: FileClassification[] = [];

  async function scanRecursive(currentPath: string, depth: number): Promise<void> {
    if (files.length >= maxFiles || depth > 5) return;

    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) break;

      const fullPath = path.join(currentPath, entry.name);

      // Skip hidden files and common junk
      if (entry.name.startsWith('.') || entry.name === '__MACOSX' || entry.name === 'Thumbs.db') {
        continue;
      }

      if (entry.isDirectory()) {
        // Classify directory
        const volumeMatch = extractVolumeNumber(entry.name);
        const chapterMatch = extractChapterNumber(entry.name);

        files.push({
          filename: entry.name,
          filePath: fullPath,
          size: 0,
          isArchive: false,
          isImage: false,
          isDirectory: true,
          volumeNumber: volumeMatch?.value as number | undefined,
          chapterNumber: chapterMatch?.value as number | undefined,
          confidence: volumeMatch?.confidence ?? chapterMatch?.confidence ?? 0.5,
        });

        // eslint-disable-next-line no-await-in-loop -- Recursive directory traversal requires sequential processing
        await scanRecursive(fullPath, depth + 1);
      } else {
        // eslint-disable-next-line no-await-in-loop -- File stat must be awaited for each file in directory traversal
        const stats = await fs.stat(fullPath);
        files.push(classifyFile(fullPath, entry.name, stats.size));
      }
    }
  }

  await scanRecursive(dirPath, 0);
  return files;
}

/**
 * Scan archive contents without extracting
 */
function scanArchive(archivePath: string): FileClassification[] {
  const files: FileClassification[] = [];
  const ext = path.extname(archivePath).toLowerCase();

  try {
    if (ext === '.cbz' || ext === '.zip') {
      const zip = new AdmZip(archivePath);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        const entryName = entry.entryName;
        const filename = path.basename(entryName);

        // Skip hidden files and metadata
        if (filename.startsWith('.') || entryName.includes('__MACOSX')) {
          continue;
        }

        files.push(classifyFile(entryName, filename, entry.header.size));
      }
    } else {
      // For other archive types, we can't easily scan without extracting
      // Return empty array and rely on filename analysis
      logger.debug(`Cannot scan ${ext} archive without extraction: ${archivePath}`);
    }
  } catch (error) {
    logger.error('Error scanning archive', { archivePath, error });
  }

  return files;
}

/**
 * Determine content type from classified files
 */
function determineContentType(
  files: FileClassification[],
  archiveStructure?: ArchiveStructure
): ContentType {
  const archives = files.filter(f => f.isArchive);
  const images = files.filter(f => f.isImage);
  const directories = files.filter(f => f.isDirectory);

  // Check for volume folders
  const volumeDirs = directories.filter(d => d.volumeNumber !== undefined);
  if (volumeDirs.length > 1) {
    return 'COMPLETE_SERIES';
  }

  // Check for multiple volume archives
  const volumeArchives = new Set(archives.map(a => a.volumeNumber).filter(v => v !== undefined));
  if (volumeArchives.size > 1) {
    return 'COMPLETE_SERIES';
  }

  // Check for single large archive (volume pack)
  if (archives.length === 1) {
    const archive = archives[0];
    if (archive?.volumeNumber !== undefined || (archive && archive.size > 50 * 1024 * 1024)) {
      return 'VOLUME_PACK';
    }
    if (archive?.chapterNumber !== undefined) {
      return 'SINGLE_CHAPTER';
    }
  }

  // Multiple archives with chapter numbers
  if (archives.length > 1) {
    const chapterArchives = archives.filter(a => a.chapterNumber !== undefined);
    if (chapterArchives.length > 1) {
      return 'CHAPTER_PACK';
    }
  }

  // Check archive internal structure
  if (archiveStructure === 'VOLUME_FOLDERS') {
    return 'COMPLETE_SERIES';
  }
  if (archiveStructure === 'CHAPTER_FOLDERS') {
    return 'VOLUME_PACK';
  }

  // Loose images
  if (images.length > 0 && archives.length === 0) {
    return 'FLAT_IMAGES';
  }

  // Mixed content
  if (archives.length > 0 && images.length > 0) {
    return 'MIXED_CONTENT';
  }

  return 'UNKNOWN';
}

/**
 * Build volume info from classified files
 */
function buildVolumeInfo(files: FileClassification[]): VolumeInfo[] {
  const volumes: VolumeInfo[] = [];
  const filesByPath = files.map(f => ({ path: f.filePath, filename: f.filename }));
  const volumeGroups = groupByVolume(filesByPath);

  for (const [volumeNumber, groupFiles] of volumeGroups) {
    if (volumeNumber === 0) continue; // Skip unassigned

    const volumeFiles = files.filter(f =>
      groupFiles.some(gf => gf.path === f.filePath)
    );

    const chapterFiles = volumeFiles.filter(f => f.chapterNumber !== undefined);
    const estimatedChapters = chapterFiles.length > 0
      ? new Set(chapterFiles.map(f => f.chapterNumber)).size
      : Math.ceil(volumeFiles.filter(f => f.isImage).length / 20); // Estimate 20 pages per chapter

    volumes.push({
      volumeNumber,
      files: volumeFiles,
      estimatedChapters,
      totalSize: volumeFiles.reduce((sum, f) => sum + f.size, 0),
    });
  }

  return volumes.sort((a, b) => a.volumeNumber - b.volumeNumber);
}

/**
 * Build chapter info from classified files
 */
function buildChapterInfo(files: FileClassification[]): ChapterInfo[] {
  const chapters: ChapterInfo[] = [];
  const seenChapters = new Set<number>();

  for (const file of files) {
    if (file.chapterNumber !== undefined && !seenChapters.has(file.chapterNumber)) {
      seenChapters.add(file.chapterNumber);
      chapters.push({
        chapterNumber: file.chapterNumber,
        volumeNumber: file.volumeNumber,
        filePath: file.filePath,
      });
    }
  }

  return chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
}

/**
 * Generate import recommendation based on classification
 */
function generateRecommendation(
  contentType: ContentType,
  volumes: VolumeInfo[],
  chapters: ChapterInfo[],
  confidence: number
): ImportRecommendation {
  switch (contentType) {
    case 'COMPLETE_SERIES':
      return {
        mode: 'PACK',
        createVolumeFolders: true,
        splitArchive: true,
        description: `Complete series with ${volumes.length} volumes detected. Will create volume folders and split into chapters.`,
        confidence: Math.min(confidence, 0.90),
      };

    case 'VOLUME_PACK':
      return {
        mode: 'VOLUME_SPLIT',
        createVolumeFolders: true,
        splitArchive: true,
        description: `Single volume detected. Will split into individual chapters.`,
        confidence: Math.min(confidence, 0.85),
      };

    case 'CHAPTER_PACK':
      return {
        mode: 'BULK',
        createVolumeFolders: false,
        splitArchive: false,
        description: `${chapters.length} individual chapters detected. Will import as-is.`,
        confidence: Math.min(confidence, 0.90),
      };

    case 'SINGLE_CHAPTER':
      return {
        mode: 'BULK',
        createVolumeFolders: false,
        splitArchive: false,
        description: `Single chapter file. Will import directly.`,
        confidence: Math.min(confidence, 0.95),
      };

    case 'FLAT_IMAGES':
      return {
        mode: 'PACK',
        createVolumeFolders: false,
        splitArchive: false,
        description: `Loose images detected. Will bundle into a single chapter.`,
        confidence: Math.min(confidence, 0.70),
      };

    case 'MIXED_CONTENT':
      return {
        mode: 'MANUAL',
        createVolumeFolders: false,
        splitArchive: false,
        description: `Mixed content types detected. Manual review recommended.`,
        confidence: 0.50,
      };

    default:
      return {
        mode: 'MANUAL',
        createVolumeFolders: false,
        splitArchive: false,
        description: `Unable to determine content structure. Manual review recommended.`,
        confidence: 0.30,
      };
  }
}

/**
 * Classify content from a directory path
 */
export async function classifyDirectory(
  dirPath: string,
  options: ClassificationOptions = DEFAULT_CLASSIFICATION_OPTIONS
): Promise<ClassificationResult> {
  const warnings: string[] = [];
  const mergedOptions = { ...DEFAULT_CLASSIFICATION_OPTIONS, ...options };

  try {
    // Check if path exists
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    // Scan directory
    const files = await scanDirectory(dirPath, mergedOptions.maxFilesToScan ?? 1000);

    if (files.length === 0) {
      return {
        contentType: 'UNKNOWN',
        volumes: [],
        chapters: [],
        files: [],
        totalFiles: 0,
        totalSize: 0,
        confidence: 0,
        method: 'FOLDER_STRUCTURE',
        warnings: ['No files found in directory'],
        recommendation: generateRecommendation('UNKNOWN', [], [], 0),
      };
    }

    // Deep scan archives if enabled
    let archiveContents: FileClassification[] = [];
    let archiveStructure: ArchiveStructure | undefined;

    if (mergedOptions.deepScan) {
      const archives = files.filter(f => f.isArchive);
      for (const archive of archives.slice(0, 5)) { // Limit to first 5 archives
        const contents = scanArchive(archive.filePath);
        archiveContents = archiveContents.concat(contents);
      }

      if (archiveContents.length > 0) {
        const paths = archiveContents.map(c => c.filePath);
        archiveStructure = detectFolderStructure(paths);
      }
    }

    // Combine file lists
    const allFiles = files.concat(archiveContents);

    // Detect folder structure
    const paths = files.map(f => f.filePath);
    const folderStructure = detectFolderStructure(paths);
    if (!archiveStructure) {
      archiveStructure = folderStructure;
    }

    // Determine content type
    const contentType = determineContentType(files, archiveStructure);

    // Build volume and chapter info
    const volumes = buildVolumeInfo(allFiles);
    const chapters = buildChapterInfo(allFiles);

    // Calculate overall confidence
    const confidences = allFiles.map(f => f.confidence).filter(c => c > 0);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.5;

    // Detect series title
    const titles = allFiles
      .map(f => f.detectedTitle)
      .filter((t): t is string => t !== undefined && t.length > 2);
    const seriesTitle = titles.length > 0 ? getMostCommonTitle(titles) : undefined;

    // Generate recommendation
    const recommendation = generateRecommendation(contentType, volumes, chapters, avgConfidence);

    return {
      contentType,
      archiveStructure,
      seriesTitle,
      volumes,
      chapters,
      files,
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      confidence: avgConfidence,
      method: 'COMBINED',
      warnings,
      recommendation,
    };
  } catch (error) {
    logger.error('Error classifying directory', { dirPath, error });
    throw error;
  }
}

/**
 * Classify content from an archive file
 */
export async function classifyArchive(
  archivePath: string,
  options: ClassificationOptions = DEFAULT_CLASSIFICATION_OPTIONS
): Promise<ClassificationResult> {
  const warnings: string[] = [];
  const mergedOptions = { ...DEFAULT_CLASSIFICATION_OPTIONS, ...options };

  try {
    // Check if file exists
    const stats = await fs.stat(archivePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${archivePath}`);
    }

    const filename = path.basename(archivePath);
    const archiveFile = classifyFile(archivePath, filename, stats.size);

    // Determine if this is likely a volume based on filename and size
    const volumeCheck = isLikelyVolume(filename, stats.size);

    // Scan archive contents
    let archiveContents: FileClassification[] = [];
    let archiveStructure: ArchiveStructure | undefined;

    if (mergedOptions.deepScan) {
      archiveContents = scanArchive(archivePath);

      if (archiveContents.length > 0) {
        const paths = archiveContents.map(c => c.filePath);
        archiveStructure = detectFolderStructure(paths);
      }
    }

    // Determine content type based on archive analysis
    let contentType: ContentType;

    if (archiveStructure === 'VOLUME_FOLDERS') {
      contentType = 'COMPLETE_SERIES';
    } else if (archiveStructure === 'CHAPTER_FOLDERS') {
      contentType = 'VOLUME_PACK';
    } else if (volumeCheck.isVolume) {
      contentType = 'VOLUME_PACK';
    } else if (archiveFile.chapterNumber !== undefined) {
      contentType = 'SINGLE_CHAPTER';
    } else if (archiveContents.length > 0 && archiveContents.every(f => f.isImage)) {
      // All images, no structure - could be single chapter or volume
      contentType = stats.size > 50 * 1024 * 1024 ? 'VOLUME_PACK' : 'SINGLE_CHAPTER';
    } else {
      contentType = 'UNKNOWN';
    }

    // Build volume and chapter info from contents
    const volumes = buildVolumeInfo(archiveContents);
    const chapters = buildChapterInfo(archiveContents);

    // Calculate confidence
    const confidences = [archiveFile.confidence, volumeCheck.confidence];
    if (archiveContents.length > 0) {
      confidences.push(...archiveContents.map(f => f.confidence));
    }
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // Get title from archive filename
    const seriesTitle = archiveFile.detectedTitle;

    // Generate recommendation
    const recommendation = generateRecommendation(contentType, volumes, chapters, avgConfidence);

    return {
      contentType,
      archiveStructure,
      seriesTitle,
      volumes,
      chapters,
      files: [archiveFile],
      totalFiles: 1,
      totalSize: stats.size,
      confidence: avgConfidence,
      method: archiveContents.length > 0 ? 'COMBINED' : 'FILENAME_PATTERNS',
      warnings,
      recommendation,
    };
  } catch (error) {
    logger.error('Error classifying archive', { archivePath, error });
    throw error;
  }
}

/**
 * Main entry point: classify any path (file or directory)
 */
export async function classifyContent(
  contentPath: string,
  options: ClassificationOptions = DEFAULT_CLASSIFICATION_OPTIONS
): Promise<ClassificationResult> {
  const stats = await fs.stat(contentPath);

  if (stats.isDirectory()) {
    return classifyDirectory(contentPath, options);
  } else if (stats.isFile() && isArchiveFile(contentPath)) {
    return classifyArchive(contentPath, options);
  } else {
    // Single file that's not an archive
    const filename = path.basename(contentPath);
    const file = classifyFile(contentPath, filename, stats.size);

    return {
      contentType: file.isImage ? 'FLAT_IMAGES' : 'SINGLE_CHAPTER',
      volumes: [],
      chapters: file.chapterNumber !== undefined
        ? [{ chapterNumber: file.chapterNumber, filePath: file.filePath }]
        : [],
      files: [file],
      totalFiles: 1,
      totalSize: stats.size,
      confidence: file.confidence,
      method: 'FILENAME_PATTERNS',
      warnings: [],
      recommendation: generateRecommendation('SINGLE_CHAPTER', [], [], file.confidence),
    };
  }
}

/**
 * Get most common title from array (for series detection)
 */
function getMostCommonTitle(titles: string[]): string {
  if (titles.length === 0) {
    return '';
  }

  const counts = new Map<string, number>();

  for (const title of titles) {
    const normalized = title.toLowerCase().trim();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  let maxCount = 0;
  let mostCommon = titles[0] ?? '';

  for (const [title, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      // Find original case version
      mostCommon = titles.find(t => t.toLowerCase().trim() === title) ?? title;
    }
  }

  return mostCommon;
}
