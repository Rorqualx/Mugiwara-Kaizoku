/**
 * Volume Metadata Hook
 *
 * Handles provider-specific metadata processing for volume titles and covers.
 * Supports multiple providers: rawProviderData, ComicVine, Fandom, Wikipedia, AniList
 *
 * Extracted from: VolumeGroupedChapters.tsx (lines 116-255)
 */

import { useState, useEffect } from 'react';

import { logger } from '@/utils/logger';

import type { VolumeData } from '../types';

interface UseVolumeMetadataProps {
    rawProviderData: unknown;
    volumeSource: string;
    providerMetadata: unknown;
    manga: unknown;
}

/** Chapter range for a volume */
export interface VolumeRange {
    chapterStart: number;
    chapterEnd: number;
}

interface UseVolumeMetadataResult {
    volumeTitles: Record<number, string> | undefined;
    volumeRanges: Record<number, VolumeRange> | undefined;
}

/**
 * Processes provider metadata to extract volume titles
 *
 * Priority order:
 * 1. rawProviderData.volumes (enriched wizard data)
 * 2. providerMetadata by source (comicvine, fandom, wikipedia, anilist)
 * 3. Default fallback
 */
export function useVolumeMetadata({
    rawProviderData,
    volumeSource,
    providerMetadata,
    manga
}: UseVolumeMetadataProps): UseVolumeMetadataResult {
    const [volumeTitles, setVolumeTitles] = useState<Record<number, string> | undefined>(undefined);
    const [volumeRanges, setVolumeRanges] = useState<Record<number, VolumeRange> | undefined>(undefined);

    useEffect(() => {
        try {
            let newVolumeTitles: Record<number, string> = {};

            // PRIORITY 1: Check rawProviderData.volumes first (enriched wizard data)
            if (rawProviderData) {
                const parsedRawData = parseRawProviderData(rawProviderData);
                if (parsedRawData) {
                    setVolumeTitles(parsedRawData);
                    // Still extract ranges from providerMetadata even when using rawProviderData titles
                }
            }

            // PRIORITY 2: Fall back to providerMetadata if no rawProviderData
            if (!providerMetadata) {
                if (!rawProviderData) setVolumeTitles(undefined);
                setVolumeRanges(undefined);
                return;
            }

            const metadata = parseProviderMetadata(providerMetadata);
            if (!metadata) {
                if (!rawProviderData) setVolumeTitles(undefined);
                setVolumeRanges(undefined);
                return;
            }

            // Extract volume ranges from comicvine volumeData (always available after enrichment)
            const ranges = extractVolumeRanges(metadata);
            setVolumeRanges(Object.keys(ranges).length > 0 ? ranges : undefined);

            // Only set titles from source if rawProviderData didn't provide them
            if (!rawProviderData) {
                newVolumeTitles = extractVolumeTitlesBySource(volumeSource, metadata, manga);
                setVolumeTitles(newVolumeTitles);
            }
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Error updating volume titles:', errorMessage);
            setVolumeTitles(undefined);
            setVolumeRanges(undefined);
        }
    }, [rawProviderData, volumeSource, providerMetadata, manga]);

    return { volumeTitles, volumeRanges };
}

/**
 * Parse raw provider data to extract volume titles
 */
function parseRawProviderData(rawProviderData: unknown): Record<number, string> | null {
    // Type guard for rawProviderData
    if (!rawProviderData) {
        return null;
    }
    if (typeof rawProviderData !== 'string' && typeof rawProviderData !== 'object') {
        return null;
    }
    try {
        const rawData: unknown = typeof rawProviderData === 'string' ?
            JSON.parse(rawProviderData) :
            rawProviderData;

        if (!rawData || typeof rawData !== 'object') {
            return null;
        }

        const dataObj = rawData as Record<string, unknown>;
        const volumes = dataObj["volumes"];

        if (!volumes || !Array.isArray(volumes) || volumes.length === 0) {
            return null;
        }

        logger.info('[useVolumeMetadata] Using rawProviderData.volumes for titles');

        const titles: Record<number, string> = {};
        volumes.forEach((vol: unknown) => {
            if (vol && typeof vol === 'object') {
                const volObj = vol as VolumeData;
                const volumeNumber = volObj.volumeNumber ?? volObj.number;
                // PRIORITY: volumeTitle field has enriched titles like "#1: Fire Walk With Me"
                // title field might have simplified titles like "Fire Force 01"
                const volumeTitle = volObj.volumeTitle ?? volObj.title ?? volObj.name ?? volObj.volumeName;

                // Use explicit check to allow Volume 0 (for prequels like JJK 0)
                if (volumeNumber !== undefined && volumeTitle) {
                    titles[volumeNumber] = volumeTitle;
                }
            }
        });

        return titles;
    }
    catch {
        return null;
    }
}

/**
 * Parse provider metadata with double-decode support
 */
function parseProviderMetadata(providerMetadata: unknown): Record<string, unknown> | null {
    // Type guard for providerMetadata
    if (!providerMetadata) {
        return null;
    }
    if (typeof providerMetadata !== 'string' && typeof providerMetadata !== 'object') {
        return null;
    }
    try {
        let metadata: unknown = providerMetadata;
        if (typeof metadata === 'string') {
            metadata = JSON.parse(metadata);
            if (typeof metadata === 'string') {
                metadata = JSON.parse(metadata);
            }
        }

        // Validate metadata is an object
        if (!metadata || typeof metadata !== 'object') {
            return null;
        }

        return metadata as Record<string, unknown>;
    }
    catch {
        return null;
    }
}

/**
 * Extract volume titles based on the selected source
 */
function extractVolumeTitlesBySource(
    volumeSource: string,
    metadata: Record<string, unknown>,
    manga: unknown
): Record<number, string> {
    switch (volumeSource) {
        case 'comicvine':
            return extractComicVineTitles(metadata);
        case 'fandom':
            return extractFandomTitles(metadata);
        case 'wikipedia':
            return extractWikipediaTitles(metadata);
        case 'anilist':
            return extractAniListTitles(metadata, manga);
        default: {
            // Try all sources in priority order when no specific source is selected
            const comicvine = extractComicVineVolumeTitles(metadata);
            if (Object.keys(comicvine).length > 0) return comicvine;
            const fandom = extractFandomTitles(metadata);
            if (Object.keys(fandom).length > 0) return fandom;
            const wikipedia = extractWikipediaTitles(metadata);
            if (Object.keys(wikipedia).length > 0) return wikipedia;
            return extractAniListTitles(metadata, manga);
        }
    }
}

/**
 * Extract ComicVine volume titles
 */
function extractComicVineTitles(metadata: Record<string, unknown>): Record<number, string> {
    const titles: Record<number, string> = {};

    const comicvineData = metadata["comicvine"] as Record<string, unknown> | undefined;
    const comicvineVolumesData = metadata["comicvine_volumes"] as Record<string, unknown> | undefined;

    const comicVineIssues = (comicvineData?.["metadata"] as Record<string, unknown> | undefined)?. ["issues"] ??
        (comicvineVolumesData?.["metadata"] as Record<string, unknown> | undefined)?. ["issues"] ??
        comicvineVolumesData?.["issues"];

    if (!Array.isArray(comicVineIssues)) {
        return titles;
    }

    for (let i = 0; i < comicVineIssues.length; i++) {
        const issue = comicVineIssues[i] as Record<string, unknown>;
        const issueName = issue["name"] ?? issue["title"];
        const issueNumber = issue["issue_number"] ?? issue["issueNumber"] ?? i + 1;
        const volumeNumber = i + 1;

        titles[volumeNumber] = issueName ?
            `#${issueNumber}: ${issueName}` :
            `Issue #${issueNumber}`;
    }

    return titles;
}

/**
 * Extract Fandom volume titles
 */
function extractFandomTitles(metadata: Record<string, unknown>): Record<number, string> {
    const titles: Record<number, string> = {};

    const fandomVolumesData = metadata["fandom_volumes"];
    if (!fandomVolumesData) {
        return titles;
    }

    const fandomVolumes = Array.isArray(fandomVolumesData) ?
        fandomVolumesData :
        ((fandomVolumesData as Record<string, unknown>)["volumes"] ?? []);

    const fandomVolumesArray = Array.isArray(fandomVolumes) ? fandomVolumes : [];

    const hasSelectionFlag = fandomVolumesArray.some((v: unknown) => {
        const vObj = v as Record<string, unknown>;
        return vObj["isSelected"] !== undefined;
    });

    const volumesToDisplay = hasSelectionFlag ?
        fandomVolumesArray.filter((v: unknown) => {
            const vObj = v as Record<string, unknown>;
            return vObj["isSelected"] === true;
        }) :
        fandomVolumesArray;

    volumesToDisplay.forEach((volume: unknown) => {
        const volumeObj = volume as Record<string, unknown>;
        const volumeNumber = volumeObj["volumeNumber"] ?? volumeObj["number"];
        const volumeTitle = volumeObj["title"] ?? volumeObj["name"];

        // Use explicit check to allow Volume 0 (for prequels like JJK 0)
        if (volumeNumber !== undefined && volumeTitle) {
            titles[volumeNumber as number] = volumeTitle as string;
        }
    });

    return titles;
}

/**
 * Extract Wikipedia volume titles
 */
function extractWikipediaTitles(metadata: Record<string, unknown>): Record<number, string> {
    const titles: Record<number, string> = {};

    const wikipediaChapters = metadata["wikipedia_chapters"] as Record<string, unknown> | undefined;
    const volumeList = wikipediaChapters?.["volumeList"];

    if (!Array.isArray(volumeList)) {
        return titles;
    }

    volumeList.forEach((volume: unknown) => {
        const volumeObj = volume as Record<string, unknown>;
        const volumeNumber = volumeObj["volumeNumber"] ?? volumeObj["number"];

        // Use explicit check to allow Volume 0 (for prequels like JJK 0)
        if (volumeNumber !== undefined) {
            titles[volumeNumber as number] = (volumeObj["title"] ?? `Volume ${volumeNumber}`) as string;
        }
    });

    return titles;
}

/**
 * Extract AniList volume titles
 */
function extractAniListTitles(metadata: Record<string, unknown>, manga: unknown): Record<number, string> {
    const titles: Record<number, string> = {};

    // Type guard for manga object
    if (!manga || typeof manga !== 'object') {
        return titles;
    }

    const anilistData = metadata["anilist"] as Record<string, unknown>;
    // Get volume count from anilist data or manga metadata object
    // Access manga.metadata using bracket notation since it's a Prisma JsonValue
    const mangaObj = manga as Record<string, unknown>;
    const mangaMetadata = mangaObj["metadata"] as Record<string, unknown> | null | undefined;
    const volumeCount = ((anilistData["volumes"] as number | null | undefined) ??
        (mangaMetadata && typeof mangaMetadata === 'object' && 'volumes' in mangaMetadata ?
            (mangaMetadata["volumes"] as number) : null)) ?? 0;

    if (volumeCount > 0) {
        for (let i = 1; i <= volumeCount; i++) {
            titles[i] = `Volume ${i}`;
        }
    }

    return titles;
}

/**
 * Extract volume titles from comicvine.volumeData (enrichment pipeline output).
 * This is the primary source after enrichment since it has real volume names.
 */
function extractComicVineVolumeTitles(metadata: Record<string, unknown>): Record<number, string> {
    const titles: Record<number, string> = {};
    const comicvine = metadata['comicvine'] as Record<string, unknown> | undefined;
    const volumeData = comicvine?.['volumeData'];
    if (!Array.isArray(volumeData)) return titles;

    for (const vol of volumeData) {
        if (!vol || typeof vol !== 'object') continue;
        const v = vol as Record<string, unknown>;
        const num = v['volumeNumber'] ?? v['number'];
        const title = v['title'];
        if (typeof num === 'number' && typeof title === 'string' && title.length > 0) {
            titles[num] = title;
        }
    }
    return titles;
}

/**
 * Extract chapter ranges from providerMetadata comicvine volumeData.
 * This data is populated by the enrichment pipeline's phase-finalize.
 */
function extractVolumeRanges(metadata: Record<string, unknown>): Record<number, VolumeRange> {
    const ranges: Record<number, VolumeRange> = {};
    const comicvine = metadata['comicvine'] as Record<string, unknown> | undefined;
    const volumeData = comicvine?.['volumeData'];
    if (!Array.isArray(volumeData)) return ranges;

    for (const vol of volumeData) {
        if (!vol || typeof vol !== 'object') continue;
        const v = vol as Record<string, unknown>;
        const num = v['volumeNumber'] ?? v['number'];
        const start = v['chapterStart'];
        const end = v['chapterEnd'];
        if (typeof num === 'number' && typeof start === 'number' && typeof end === 'number') {
            ranges[num] = { chapterStart: start, chapterEnd: end };
        }
    }
    return ranges;
}
