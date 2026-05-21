/**
 * Server-side helper utilities for file system operations and cron management
 *
 * This module provides utilities for managing manga chapters, cron expressions,
 * and file system operations that can only be performed on the server side.
 *
 * @module serverHelpers
 */

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

import * as fs from "fs";
import * as path from "path";

import parser from "cron-parser";
import cronstrue from "cronstrue";

import { formatChapterTitle } from '../client/frontendHelpers';
// getChaptersFromRemote removed - mangal is deprecated
import { logger } from '../logging';

import type { ChapterFromLocal} from '../client/frontendHelpers';
/**
 * Converts a cron expression to a human-readable description
 *
 * @param {string} cron - The cron expression or "never"
 * @returns {string} Human readable description of the schedule
 * @example
 * getDetailedCronLabel("0 0 * * *") // returns "At 12:00 AM every day"
 * getDetailedCronLabel("never") // returns "Never"
 */
export const getDetailedCronLabel = (cron: string): string => {
    if (cron === "never") {
        return "Never";
    }
    try {
        return cronstrue.toString(cron, { use24HourTimeFormat: true });
    }
    catch (err: unknown) {
        logger.error("Failed to parse cron:", err instanceof Error ? err.message : String(err));
        return "Invalid cron expression";
    }
};
/**
 * Validates a cron expression
 *
 * Tests if the expression is valid by attempting to parse it with both
 * cron-parser and cronstrue libraries for thorough validation.
 *
 * @param {string} cron - The cron expression to validate
 * @returns {boolean} True if the expression is valid or "never", false otherwise
 * @example
 * validateCronExpression("0 0 * * *") // returns true
 * validateCronExpression("invalid") // returns false
 */
export const validateCronExpression = (cron: string): boolean => {
    if (cron === "never") {
        return true;
    }
    try {
        // Fix: Use the parse method instead of parseExpression
        parser.parse(cron);
        cronstrue.toString(cron);
        return true;
    }
    catch (_err: unknown) {
        return false;
    }
};
/**
 * Retrieves manga chapters from the local filesystem
 *
 * Scans the specified directory for .cbz and .zip files, treating each as a chapter.
 * Files are ordered by name and assigned sequential indices.
 *
 * @param {string} mangaDir - Path to the manga directory
 * @returns {Promise<ChapterFromLocal[]>} Array of chapter objects with file info
 * @example
 * const chapters = await getChaptersFromLocal("/manga/one-piece");
 * // Returns: [{ fileName: "chapter-1.cbz", index: 0, size: 1024, title: "Chapter 1" }, ...]
 */
export const getChaptersFromLocal = async (mangaDir: string): Promise<ChapterFromLocal[]> => {
    try {
        // Check if directory exists first
        const dirExists = await fs.promises.access(mangaDir, fs.constants.F_OK)
            .then(() => true)
            .catch(() => false);
        if (!dirExists) {
            // Directory doesn't exist yet (no chapters downloaded), this is normal
            logger.info(`Manga directory does not exist yet: ${mangaDir}`);
            return [];
        }
        const files = await fs.promises.readdir(mangaDir);
        return files
            .filter((file) => file.endsWith(".cbz") || file.endsWith(".zip"))
            .map((file, index) => {
            const filePath = path.join(mangaDir, file);
            const stats = fs.statSync(filePath);
            return {
                fileName: file,
                index,
                size: stats.size,
                title: formatChapterTitle(index),
            };
        });
    }
    catch (error: unknown) {
        // Only log unexpected errors (not ENOENT which is handled above)
        if (error instanceof Error ? error.message : String(error) !== 'ENOENT') {
            console.error(`Error reading chapters from ${mangaDir}:`, error);
        }
        return [];
    }
};
/**
 * Identifies chapters that exist remotely but not locally
 *
 * Compares local filesystem chapters with those available from a remote source
 * to determine which chapters are missing from the local collection.
 *
 * @param {string} mangaDir - Path to the local manga directory
 * @param {string} source - Identifier for the remote source
 * @param {string} title - Title of the manga to check
 * @returns {Promise<ChapterFromLocal[]>} Array of missing chapters
 * @example
 * const missing = await findMissingChapterFiles(
 *   "/manga/one-piece",
 *   "anilist",
 *   "One Piece"
 * );
 */
export const findMissingChapterFiles = async (mangaDir: string, source: string, title: string): Promise<ChapterFromLocal[]> => {
    try {
        const localChapters = await getChaptersFromLocal(mangaDir);
        // Mangal is deprecated - return empty array for remote chapters
        const remoteChapters: unknown[] = [];
        return remoteChapters
            .filter((remoteChapter): remoteChapter is Record<string, unknown> =>
                isRecord(remoteChapter) &&
                !localChapters.some((localChapter) => localChapter.fileName === remoteChapter["url"] // Use a unique identifier
            ))
            .map((chapter): ChapterFromLocal => ({
                fileName: (chapter["url"] as string).split('/').pop() ?? "unknown", // Extract filename or fallback
                index: typeof chapter["index"] === "number" ? chapter["index"] : 0,
                size: 0, // Size is unknown for remote chapters
                ...(typeof chapter["name"] === "string" && { title: chapter["name"] }),
                ...(!chapter["name"] && typeof chapter["index"] === "number" && { title: `Chapter ${chapter["index"] + 1}` }),
            }));
    }
    catch (error: unknown) {// const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error);
logger.error(`Error finding missing chapters for ${title}:`, error);
        return [];
    }
};
/**
 * Checks if a file exists at the specified path
 *
 * Server-side only utility that safely checks file existence without throwing.
 * Preferred over direct fs.existsSync for asynchronous operations.
 *
 * @param {string} filePath - Path to the file to check
 * @returns {Promise<boolean>} True if the file exists, false otherwise
 * @example
 * const exists = await checkFileExists("/path/to/file.cbz");
 */
export const checkFileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        return true;
    }
    catch {
        return false;
    }
};
