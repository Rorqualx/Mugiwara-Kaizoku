/**
 * Utility Functions for Volume Chapters
 *
 * Contains helper functions for chapter validation, volume extraction,
 * and placeholder generation.
 *
 * Extracted from: volumeChaptersTable.tsx
 */

import { ChapterStatus } from '@prisma/client';

import { logger } from '@/utils/logger';



import type { PlaceholderVolumeMap, VolumeData, ChapterDataInVolume } from './types';
import type { Chapter } from "@prisma/client";

/** Volume file offset used to separate volume entries from regular chapters */
const VOLUME_CHAPTER_OFFSET = 100_000;

/**
 * Check if a chapter record is actually a volume-level file.
 * Uses the chapterNumber offset convention (100000 + volumeNumber).
 */
export function isVolumeEntry(chapter: Chapter): boolean {
  return chapter.chapterNumber !== null && chapter.chapterNumber >= VOLUME_CHAPTER_OFFSET;
}

/**
 * Get the real volume number from a volume entry's chapterNumber.
 * For volume entries, chapterNumber = 100000 + volumeNumber.
 * Falls back to the volume field if chapterNumber is not in the offset range.
 */
export function getVolumeNumber(chapter: Chapter): number {
  const cn = chapter.chapterNumber ?? 0;
  if (cn >= VOLUME_CHAPTER_OFFSET) return cn - VOLUME_CHAPTER_OFFSET;
  return chapter.volume ?? cn;
}

/**
 * Type guard to verify if a value is a valid Chapter
 *
 * @param chapter - The value to check
 * @returns True if the value is a valid Chapter
 */
export const isValidChapter = (chapter: unknown): chapter is Chapter => {
    return chapter !== null &&
        typeof chapter === 'object' &&
        'id' in chapter &&
        'title' in chapter &&
        'mangaId' in chapter &&
        'index' in chapter &&
        'downloadStatus' in chapter;
};

/**
 * Extracts volume number from a chapter
 * IMPORTANT: Only uses the database volume field - does NOT reassign based on metadata
 *
 * @param chapter - Chapter entity to extract volume from
 * @returns Volume number from database, or -1 for unassigned chapters
 */
export const extractVolumeNumber = (chapter: Chapter): number => {
    // IMPORTANT: Always use the volume from database - this is the source of truth
    // DO NOT reassign volumes based on provider metadata on page reload
    // Volumes are assigned during import and should never change

    // Use the database volume assignment (including Volume 0 for prequels like JJK 0)
    if (typeof chapter.volume === 'number' && chapter.volume >= 0) {
        return chapter.volume;
    }

    // DO NOT use FANDOM metadata or any other provider metadata to reassign volumes
    // This was causing chapters to be redistributed incorrectly on page reload

    // Only try to extract from filename as a last resort for truly unassigned chapters
    if (chapter.fileName) {
        const volumeMatch = chapter.fileName.match(/v(\d+)/i);
        if (volumeMatch?.[1]) {
            const extractedVolume = parseInt(volumeMatch[1], 10);
            if (!isNaN(extractedVolume) && extractedVolume >= 0) {
                return extractedVolume;
            }
        }
    }

    // Return -1 for unassigned chapters
    // These will appear in an "Unassigned Chapters" section
    return -1;
};

/** Creates a single placeholder chapter for a missing volume so the volume header still appears in the UI. */
export function createPlaceholderChapterForVolume(
    volumeNumber: number,
    mangaTitle?: string
): Chapter {
    const title = mangaTitle
        ? `${mangaTitle} - Volume ${volumeNumber}`
        : `Volume ${volumeNumber}`;

    return {
        id: -volumeNumber * 1000,
        title,
        alternativeTitles: [],
        mangaId: 0,
        index: volumeNumber,
        downloadStatus: ChapterStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        fileName: '',
        size: 0,
        pageCount: 0,
        pageCountAttempts: 0,
        chapterNumber: 0,
        number: null,
        pages: null,
        resolutionWidth: null,
        resolutionHeight: null,
        resolutionLabel: null,
        language: null,
        releaseDate: null,
        downloadUrl: null,
        coverImage: null,
        description: null,
        hash: null,
        mimeType: null,
        filePath: null,
        fileFormat: null,
        isRead: false,
        monitored: false,
        volume: volumeNumber,
        volumeId: null,
        packDownloadId: null,
        mangadexId: null,
        suwayomiChapterId: null
    };
}

export const generatePlaceholderChapters = (
    volumeCount: number,
    chapterCount: number,
    mangaTitle?: string
): PlaceholderVolumeMap => {
    const volumeMap = new Map<number, Chapter[]>();

    // If we have no volume or chapter count, or if they are 0, return empty map
    if (!volumeCount || !chapterCount || volumeCount <= 0 || chapterCount <= 0) {
        logger.info(`Cannot generate placeholders: volumeCount=${volumeCount}, chapterCount=${chapterCount}`);
        return volumeMap;
    }

    // Calculate approximate chapters per volume
    // Use a more realistic distribution - most manga have varying chapter counts per volume
    // Early volumes often have fewer chapters (6-8), later volumes have more (9-12)
    const baseChaptersPerVolume = Math.floor(chapterCount / volumeCount);
    const remainingChapters = chapterCount % volumeCount;

    // Generate placeholder chapters for each volume
    let chapterIndexCounter = 1;

    for (let vol = 1; vol <= volumeCount; vol++) {
        const chapters: Chapter[] = [];

        // Calculate how many chapters should be in this volume
        // Distribute remaining chapters across volumes, with preference for later volumes
        let volumeChapterCount = baseChaptersPerVolume;
        if (remainingChapters > 0 && vol > volumeCount - remainingChapters) {
            volumeChapterCount++;
        }

        // Generate placeholder chapters for this volume
        for (let chap = 1; chap <= volumeChapterCount; chap++) {
            const chapterIndex = chapterIndexCounter++;

            // Generate a more descriptive chapter title
            let chapterTitle = `Chapter ${chapterIndex}`;

            // Add volume information to the title
            if (volumeCount > 1) {
                chapterTitle = `Vol.${vol} ${chapterTitle}`;
            }

            // If we have a manga title, we can create more descriptive chapter names
            if (mangaTitle) {
                // For first chapter, it's often an introduction or pilot
                if (chapterIndex === 1) {
                    chapterTitle = `${chapterTitle}: Introduction`;
                }
                // For milestone chapters (every 50 or 100), add special designation
                else if (chapterIndex % 100 === 0) {
                    chapterTitle = `${chapterTitle}: Major Milestone`;
                }
                else if (chapterIndex % 50 === 0) {
                    chapterTitle = `${chapterTitle}: Milestone`;
                }
                // For volume finales (last chapter in volume)
                else if (chap === volumeChapterCount) {
                    chapterTitle = `${chapterTitle}: Volume ${vol} Finale`;
                }
            }

            // Create a placeholder chapter
            const placeholderChapter: Chapter = {
                id: -1 * chapterIndex, // Negative ID to avoid conflicts with real chapters
                title: chapterTitle,
                alternativeTitles: [],
                mangaId: 0,
                index: chapterIndex,
                downloadStatus: ChapterStatus.PENDING,
                createdAt: new Date(),
                updatedAt: new Date(),
                fileName: `v${vol} c${chapterIndex}`,
                size: 0,
                pageCount: 0,
                pageCountAttempts: 0,
                chapterNumber: chapterIndex,
                number: null,
                pages: null,
                resolutionWidth: null,
                resolutionHeight: null,
                resolutionLabel: null,
                language: null,
                releaseDate: null,
                downloadUrl: null,
                coverImage: null,
                description: null,
                hash: null,
                mimeType: null,
                filePath: null,
                fileFormat: null,
                isRead: false,
                monitored: false,
                volume: vol,
                volumeId: null,
                packDownloadId: null,
                mangadexId: null,
                suwayomiChapterId: null
            };

            chapters.push(placeholderChapter);
        }

        // Only add volumes with chapters
        if (chapters.length > 0) {
            volumeMap.set(vol, chapters);
        }
    }

    return volumeMap;
};

/**
 * File verification result type
 */
export interface FileVerificationResult {
    exists: boolean;
    filePath: string | null;
    downloadStatus: ChapterStatus;
}

export type FileVerificationMap = Record<number, FileVerificationResult>;

/**
 * Checks if a chapter from volume data matches the database chapter
 *
 * @param chapterData - Chapter data from volume metadata
 * @param chapter - Database chapter entity
 * @returns True if the chapter data matches the database chapter
 */
function matchesChapter(chapterData: ChapterDataInVolume, chapter: Chapter): boolean {
    const chNum = chapterData.chapterNumber ?? chapterData.number ?? chapterData.index;
    return String(chNum) === String(chapter.index) ||
           String(chNum) === String(chapter.chapterNumber) ||
           Number(chNum) === chapter.index ||
           Number(chNum) === chapter.chapterNumber;
}

/**
 * Extracts metadata fields from enriched chapter data
 *
 * @param enrichedChapter - Chapter data from volume metadata
 * @returns Extracted metadata fields
 */
function extractChapterMetadata(enrichedChapter: ChapterDataInVolume): {
    chapterCover: string | null | undefined;
    metadataDescription: string | null | undefined;
    metadataTitle: string | null | undefined;
    metadataPageCount: number | null | undefined;
} {
    return {
        chapterCover: enrichedChapter.coverImageUrl ?? enrichedChapter.coverUrl ?? enrichedChapter.cover ?? enrichedChapter.coverImage,
        metadataDescription: enrichedChapter.description ?? enrichedChapter.synopsis ?? enrichedChapter.summary,
        metadataTitle: enrichedChapter.title ?? enrichedChapter.name ?? enrichedChapter.chapterTitle,
        metadataPageCount: enrichedChapter.pageCount ?? enrichedChapter.pages
    };
}

/**
 * Enriches chapter data with metadata from volumeData
 *
 * Priority: Database fields first (from refresh enrichment), metadata fields second (from wizard)
 * DO NOT use volume cover as fallback - chapters should only show their own covers
 *
 * @param chapter - Chapter entity to enrich
 * @param volumeData - Optional volume data containing chapter metadata
 * @returns Enriched chapter with merged data
 */
export function enrichChapter(chapter: Chapter, volumeData?: VolumeData | null): Chapter {
    // Start with database chapter data
    const enriched: Partial<Chapter> = {};

    // Try to find additional enrichment from volumeData
    if (volumeData?.chapters) {
        const enrichedChapter = volumeData.chapters.find((ch: ChapterDataInVolume) =>
            matchesChapter(ch, chapter)
        );

        if (enrichedChapter) {
            const { chapterCover, metadataDescription, metadataTitle, metadataPageCount } =
                extractChapterMetadata(enrichedChapter);

            // PRIORITY: Database fields first (from refresh enrichment), metadata fields second (from wizard)
            // DO NOT use volume cover as fallback - chapters should only show their own covers
            // Only set fields if they have actual values (avoid undefined assignments with exactOptionalPropertyTypes)

            // Title is required (non-nullable), so we always need a value
            if (metadataTitle) {
                enriched.title = chapter.title || metadataTitle;
            }

            // Nullable fields - only set if we have a value
            // Use conditional spreading to avoid exactOptionalPropertyTypes violations
            const coverValue = chapter.coverImage ?? chapterCover;
            if (coverValue) {
                enriched.coverImage = coverValue;
            }
            const descValue = chapter.description ?? metadataDescription;
            if (descValue) {
                enriched.description = descValue;
            }
            const pageCountValue = chapter.pageCount ?? metadataPageCount;
            if (pageCountValue) {
                enriched.pageCount = pageCountValue;
            }
        }
    }

    // If no volumeData enrichment found, just use database fields
    if (Object.keys(enriched).length === 0) {
        return chapter;
    }

    // Return enriched chapter
    return { ...chapter, ...enriched } as Chapter;
}

/**
 * Extracts chapter number from filename or index
 * Handles various filename formats
 *
 * @param chapter - Chapter entity to extract number from
 * @returns Formatted chapter number string (zero-padded)
 */
export function getChapterNumber(chapter: Chapter): string {
    // Volume entries use chapterNumber = 100000 + volumeNumber — display the real volume number
    if (isVolumeEntry(chapter)) {
        return getVolumeNumber(chapter).toString().padStart(2, '0');
    }

    // Use chapterNumber field - this is the actual chapter number from the source
    // index is just a database unique constraint (1, 2, 3...)
    // chapterNumber is the real chapter numbering (0, 1, 2...)
    if (chapter.chapterNumber !== null) {
        return chapter.chapterNumber.toString().padStart(3, '0');
    }

    // Fallback to index if chapterNumber is not set (backwards compatibility)
    // Try extracting from filename as final fallback
    if (chapter.fileName) {
        const chapterMatch = chapter.fileName.match(/c(?:hapter)?\s*(\d+(\.\d+)?)/i);
        if (chapterMatch?.[1]) {
            return chapterMatch[1];
        }
    }

    return chapter.index.toString().padStart(3, '0');
}

/**
 * Generates a readable chapter name
 * Attempts to extract meaningful names from provider metadata or filenames
 *
 * @param chapter - Chapter entity to extract name from
 * @returns Readable chapter name string
 */
export function getChapterName(chapter: Chapter): string {
    // DISABLED: Do not extract chapter titles from provider metadata on page reload
    // This was causing excessive logging and potential data inconsistencies
    // Chapter titles should be set during import and stored in the database

    // Use the chapter title from the database
    if (chapter.title && !/^Chapter \d+$/.test(chapter.title)) {
        return chapter.title;
    }

    // Fall back to extracting from filename if no title
    if (chapter.fileName) {
        const name = chapter.fileName.
            replace(/v\d+/i, '').
            replace(/c(?:hapter)?\s*\d+(\.\d+)?/i, '').
            replace(/^\s*[-_\s]+|\s*[-_\s]+$|\.\w+$/g, '');
        if (name) {
            return name;
        }
    }

    // Generic fallback when no real title exists from any source — show
    // "Chapter N" so the Title column isn't visually empty. Real titles
    // from the title-fill phase will overwrite this once available.
    if (chapter.chapterNumber !== null) {
        const num = chapter.chapterNumber;
        // Render integer chapters as "Chapter 13" and decimals as "Chapter 10.5"
        const display = Number.isInteger(num) ? String(num) : String(num);
        return `Chapter ${display}`;
    }

    return '';
}

/**
 * Determines status badge properties based on chapter state and file verification
 *
 * @param chapter - Chapter entity to get status for
 * @param fileVerification - Optional file verification map
 * @returns Status badge label and color
 */
export function getStatusBadge(
    chapter: Chapter,
    fileVerification?: FileVerificationMap
): { label: string; color: string; tooltip?: string } {
    const status = chapter.downloadStatus;
    const fileVerified = fileVerification?.[chapter.id];
    const fileExists = fileVerified?.exists ?? false; // Default to false - assume missing until verified

    // File-centric status: prioritize actual file state over metadata
    // Transitional states (downloading, error) take precedence
    if (status === ChapterStatus.DOWNLOADING) {
        return { label: 'Downloading', color: 'blue' };
    }
    if (status === ChapterStatus.ERROR) {
        return { label: 'Error', color: 'red', tooltip: 'All sources failed. Use the cog menu → Reset Failed Downloads, or click the download icon to pick a specific release.' };
    }

    // File existence is the source of truth
    if (fileExists) {
        return { label: 'Available', color: 'green' };
    }

    // No file = Missing (regardless of previous download status)
    return { label: 'Missing', color: 'yellow' };
}

/**
 * Formats release date for display
 * Shows relative time for recent dates, absolute date for older ones
 *
 * @param date - Release date to format
 * @returns Formatted date string
 */
export function formatReleaseDate(date: Date | null): string {
    if (!date) return 'Unknown';

    const releaseDate = new Date(date);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));

    // Show relative time for dates within 30 days
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays > 0 && diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays >= 7 && diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;

    // Show absolute date for older releases
    return releaseDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
