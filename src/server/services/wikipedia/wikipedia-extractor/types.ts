/**
 * Wikipedia Volume Extractor - Type Definitions
 *
 * Type definitions for Wikipedia volume and chapter data structures.
 * These types are used across all Wikipedia extraction modules.
 *
 * Extracted from: wikipediaVolumeExtractor.ts (lines 13-42)
 */

export interface WikipediaVolume {
    number: string;
    title?: string;
    japaneseTitle?: string;
    englishTitle?: string;
    releaseDate?: string;
    isbn?: string;
    chapters?: WikipediaChapter[];
    summary?: string;
    coverImage?: string;
}

export interface WikipediaChapter {
    number: string;
    title?: string;
    japaneseTitle?: string;
    pages?: number;
}

export interface WikipediaVolumeData {
    volumes: WikipediaVolume[];
    totalVolumes: number;
    totalChapters: number;
    publisher?: string;
    englishPublisher?: string;
    serialization?: string;
    firstReleaseDate?: string;
    lastReleaseDate?: string;
    status?: 'ongoing' | 'completed';
}
