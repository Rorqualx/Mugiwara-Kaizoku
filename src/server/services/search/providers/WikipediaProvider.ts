/**
 * Wikipedia Search Provider
 *
 * Provides manga metadata enrichment from Wikipedia's extensive database.
 * This provider focuses on supplementary information to fill gaps in metadata
 * from other providers, including comprehensive plot summaries, chapter lists,
 * publication history, and author details.
 *
 * Features:
 * - Intelligent manga page detection
 * - Disambiguation handling
 * - Chapter and volume extraction
 * - Publication metadata parsing
 * - Caching for improved performance
 *
 * @module WikipediaProvider
 */

import { MetadataProvider } from '@prisma/client';

import { wikipediaService } from '@/server/services/wikipedia/wikipedia/service';
import type {
    WikipediaChapter,
    WikipediaMangaData,
    WikipediaVolume
} from '@/server/services/wikipedia/wikipedia/types';
import type { SearchProvider, SearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';


import { searchConfigService } from '../configService';

/**
 * Wikipedia Search Provider Implementation
 *
 * This provider searches Wikipedia for manga-related content and extracts
 * structured metadata. It's designed as a supplementary source to enrich
 * existing metadata rather than as a primary search provider.
 *
 * Search Strategy:
 * 1. Search for exact title match
 * 2. Handle disambiguation pages
 * 3. Extract structured metadata from infoboxes
 * 4. Parse chapter and volume lists
 * 5. Return enriched metadata
 *
 * @class WikipediaProvider
 * @implements {SearchProvider}
 */
class WikipediaProvider implements SearchProvider {
    name = 'wikipedia';
    type = MetadataProvider.WIKIPEDIA;
    /**
     * Get metadata for a specific manga
     */
    async getMetadata(id: string): Promise<SearchResult> {
        const result = await this.getMangaById(id);
        if (!result) {
            throw new Error(`No metadata found for id: ${id}`);
        }
        return result;
    }

    /**
     * Fetch cover image for a Wikipedia result
     *
     * @param result - Wikipedia search result
     * @returns Promise<string> Cover image URL (empty string if not found)
     */
    private async fetchCoverImage(result: WikipediaMangaData): Promise<string> {
        let coverImage = '';
        if (result['wikipediaUrl'] ?? result['title']) {
            try {
                const mangaInfo = await wikipediaService.getMangaInfo((result['wikipediaUrl'] ?? result['title']) as string);
                if (mangaInfo?.coverImage) {
                    coverImage = mangaInfo.coverImage;
                    logger.info(`[Wikipedia] Found cover image for ${result['title'] as string}: ${coverImage}`);
                }
            } catch (error) {
                logger.warn(`[Wikipedia] Failed to fetch cover image for ${result['title'] as string}:`, error);
            }
        }
        return coverImage;
    }

    /**
     * Map volume list data to standardized format
     * Also merges orphan chapters from chapterList (like epilogues) into the last volume
     *
     * @param volumeList - Raw volume list from Wikipedia
     * @param chapterList - Optional chapter list that may contain orphan chapters (epilogues, etc.)
     * @returns unknown[] Mapped volume data with orphan chapters merged
     */
    private mapVolumeData(volumeList: WikipediaVolume[], chapterList?: WikipediaChapter[]): unknown[] {
        // Track all chapter numbers seen in volumes for orphan detection
        const allVolumeChapterNumbers = new Set<string>();

        const mappedVolumes = volumeList.map((vol: unknown) => {
            const volObj = vol as Record<string, unknown>;
            const volChapters = volObj["chapters"] as Array<unknown> | undefined;
            const firstChapter = volChapters?.[0] as Record<string, unknown> | undefined;

            const volumeDescription = volObj["description"] ?? volObj["summary"] ??
                       // Check if the first chapter is a summary (Fire Force pattern)
                       (firstChapter?.["number"] === "Special" &&
                        typeof firstChapter["title"] === 'string' &&
                        firstChapter["title"].length > 100
                        ? firstChapter["title"]
                        : volObj["description"]);

            // Debug log for volume description
            const volNumber = volObj["number"] as number;
            if (volNumber <= 3) {
                logger.info(`📖 [WikipediaProvider] Volume ${volNumber} description mapping:`, {
                    volumeNumber: volNumber,
                    hasDescription: !!volObj["description"],
                    hasSummary: !!volObj["summary"],
                    descriptionLength: typeof volObj["description"] === 'string' ? volObj["description"].length : 0,
                    summaryLength: typeof volObj["summary"] === 'string' ? volObj["summary"].length : 0,
                    mappedDescription: volumeDescription && typeof volumeDescription === 'string' ? volumeDescription.substring(0, 100) : 'none'
                });
            }

            // Map and deduplicate chapters by chapter number
            const seenChapterNumbers = new Set<string>();
            const mappedChapters = volChapters?.map((ch: unknown) => {
                const chObj = ch as Record<string, unknown>;
                // Handle epilogue chapters specially
                // For Fire Force, Epilogue 1 = Chapter 303, Epilogue 2 = Chapter 304
                let chapterNumber: string;
                const chNum = String(chObj["number"] ?? chObj["chapterNumber"] ?? "");

                if (chNum === "Special" || chNum === "00") {
                    chapterNumber = "0";
                } else if (chNum.toLowerCase().includes("epilogue")) {
                    // Extract epilogue number and map to actual chapter numbers
                    // Fire Force has chapters 0-302, then Epilogue 1 (303) and Epilogue 2 (304)
                    const epilogueMatch = chNum.match(/Epilogue\s*(\d+)/i);
                    if (epilogueMatch?.[1]) {
                        const epilogueNum = parseInt(epilogueMatch[1], 10);
                        // Map Epilogue 1 -> 303, Epilogue 2 -> 304, etc.
                        chapterNumber = String(302 + epilogueNum);
                    } else {
                        // If no number, treat as first epilogue after chapter 302
                        chapterNumber = "303";
                    }
                } else {
                    chapterNumber = chNum;
                }

                return {
                    chapterNumber,
                    title: chObj["title"] as string
                };
            }).filter((ch) => {
                // Deduplicate by chapter number - keep first occurrence
                if (seenChapterNumbers.has(ch.chapterNumber)) {
                    return false;
                }
                seenChapterNumbers.add(ch.chapterNumber);
                // Also track in global set for orphan detection
                allVolumeChapterNumbers.add(ch.chapterNumber);
                return true;
            }) ?? [];

            return {
                volumeNumber: volNumber,
                title: volObj["title"] as string,
                chapters: mappedChapters,
                releaseDate: volObj["originalReleaseDate"] ?? volObj["englishReleaseDate"],
                isbn: volObj["isbn"] ?? volObj["isbn13"],
                description: volumeDescription
            };
        });

        // Check for orphan chapters in chapterList that aren't in any volume
        // These are typically epilogues, prologues, or special chapters
        if (chapterList && chapterList.length > 0 && mappedVolumes.length > 0) {
            const orphanChapters: Array<{ chapterNumber: string; title: string }> = [];

            for (const chapter of chapterList) {
                const chNum = String(chapter.number);
                let normalizedChapterNumber: string;

                // Normalize special chapter numbers
                if (chNum.toLowerCase().includes('epilogue')) {
                    const epilogueMatch = chNum.match(/Epilogue\s*(\d+)/i);
                    if (epilogueMatch?.[1]) {
                        // Find the max regular chapter to calculate epilogue number
                        let maxRegular = 0;
                        allVolumeChapterNumbers.forEach(num => {
                            const parsed = parseInt(num, 10);
                            if (!isNaN(parsed) && parsed > maxRegular) maxRegular = parsed;
                        });
                        normalizedChapterNumber = String(maxRegular + parseInt(epilogueMatch[1], 10));
                    } else {
                        normalizedChapterNumber = chNum;
                    }
                } else if (chNum === 'Special' || chNum === '00') {
                    normalizedChapterNumber = '0';
                } else {
                    normalizedChapterNumber = chNum;
                }

                // Check if this chapter isn't already in volume data
                if (!allVolumeChapterNumbers.has(normalizedChapterNumber) && !allVolumeChapterNumbers.has(chNum)) {
                    orphanChapters.push({
                        chapterNumber: normalizedChapterNumber,
                        title: chapter.title ?? `Chapter ${normalizedChapterNumber}`
                    });
                    allVolumeChapterNumbers.add(normalizedChapterNumber);
                }
            }

            // Append orphan chapters to the last volume
            if (orphanChapters.length > 0) {
                const lastVolume = mappedVolumes[mappedVolumes.length - 1] as Record<string, unknown>;
                const existingChapters = lastVolume['chapters'] as Array<{ chapterNumber: string; title: string }>;
                lastVolume['chapters'] = [...existingChapters, ...orphanChapters];

                logger.info(`[Wikipedia] Added ${orphanChapters.length} orphan chapters to last volume:`, {
                    orphanChapters: orphanChapters.map(ch => ch.chapterNumber),
                    lastVolumeNumber: lastVolume['volumeNumber']
                });
            }
        }

        return mappedVolumes;
    }

    /**
     * Parse chapter number from various formats including epilogues
     * Handles: "123", 123, "Epilogue 1", "Epilogue 2", "Special", etc.
     *
     * @param chNum - Chapter number in various formats
     * @param maxRegularChapter - Highest regular chapter number seen (for epilogue mapping)
     * @returns Parsed chapter number or NaN
     */
    private parseChapterNumber(chNum: string | number | undefined | null, maxRegularChapter: number): number {
        if (chNum === undefined || chNum === null) return NaN;

        const chStr = String(chNum);

        // Try direct integer parse first
        const directParse = parseInt(chStr, 10);
        if (!isNaN(directParse)) return directParse;

        // Handle epilogue chapters: "Epilogue 1" -> maxRegularChapter + 1, "Epilogue 2" -> maxRegularChapter + 2
        const epilogueMatch = chStr.match(/Epilogue\s*(\d+)?/i);
        if (epilogueMatch) {
            const epilogueNum = epilogueMatch[1] ? parseInt(epilogueMatch[1], 10) : 1;
            return maxRegularChapter + epilogueNum;
        }

        // Handle prologue as chapter 0
        if (/prologue/i.test(chStr)) return 0;

        return NaN;
    }

    /**
     * Calculate accurate chapter count from volumeList and chapterList data
     * Uses the maximum chapter number found (including epilogues), which is more accurate
     * than counting entries (avoids issues with duplicates)
     *
     * @param volumeList - Array of volumes with chapter data
     * @param chapterList - Optional separate chapter list that may contain epilogues
     * @returns number Best chapter count estimate
     */
    private calculateChapterCount(volumeList: WikipediaVolume[] | undefined, chapterList?: WikipediaChapter[]): number {
        if ((!volumeList || !Array.isArray(volumeList) || volumeList.length === 0) &&
            (!chapterList || !Array.isArray(chapterList) || chapterList.length === 0)) {
            return 0;
        }

        // First pass: find the highest regular (numeric) chapter number from volumeList
        let maxRegularChapter = 0;
        let hasChapterZero = false;

        if (volumeList) {
            volumeList.forEach((vol) => {
                vol.chapters.forEach((ch) => {
                    const parsed = parseInt(String(ch.number), 10);
                    if (!isNaN(parsed)) {
                        if (parsed === 0) hasChapterZero = true;
                        if (parsed > maxRegularChapter) {
                            maxRegularChapter = parsed;
                        }
                    }
                });
            });
        }

        // Second pass: find epilogue chapters that may be higher from volumeList
        let maxChapterIncludingEpilogues = maxRegularChapter;
        const specialChapters: string[] = [];

        if (volumeList) {
            volumeList.forEach((vol) => {
                vol.chapters.forEach((ch) => {
                    const chStr = String(ch.number);
                    // Track non-numeric chapter identifiers
                    if (isNaN(parseInt(chStr, 10)) && chStr.length > 0) {
                        specialChapters.push(chStr);
                    }
                    const chapterNum = this.parseChapterNumber(ch.number, maxRegularChapter);
                    if (!isNaN(chapterNum) && chapterNum > maxChapterIncludingEpilogues) {
                        maxChapterIncludingEpilogues = chapterNum;
                    }
                });
            });
        }

        // Third pass: check chapterList for epilogues/special chapters not in volumeList
        if (chapterList) {
            chapterList.forEach((ch) => {
                const chStr = String(ch.number);
                // Track non-numeric chapter identifiers
                if (isNaN(parseInt(chStr, 10)) && chStr.length > 0) {
                    if (!specialChapters.includes(chStr)) {
                        specialChapters.push(chStr);
                    }
                }
                const chapterNum = this.parseChapterNumber(ch.number, maxRegularChapter);
                if (!isNaN(chapterNum) && chapterNum > maxChapterIncludingEpilogues) {
                    maxChapterIncludingEpilogues = chapterNum;
                    logger.info(`[Wikipedia] Found higher chapter in chapterList: ${chStr} -> ${chapterNum}`);
                }
            });
        }

        // Log special chapters found (epilogues, prologues, etc.)
        if (specialChapters.length > 0) {
            logger.info(`[Wikipedia] Special chapters found: ${specialChapters.join(', ')}`);
        }

        // Final count: max chapter number + 1 (accounts for chapter 0)
        const finalCount = maxChapterIncludingEpilogues > 0 ? maxChapterIncludingEpilogues + 1 : 0;

        logger.info(`[Wikipedia] Chapter count: maxRegular=${maxRegularChapter}, maxWithEpilogues=${maxChapterIncludingEpilogues}, hasZero=${hasChapterZero}, final=${finalCount}`);
        return finalCount;
    }

    /**
     * Build optional metadata fields from Wikipedia result
     *
     * @param result - Wikipedia search result
     * @returns Partial<SearchResult> Optional metadata fields
     */
    // eslint-disable-next-line complexity -- Building optional metadata requires conditional inclusion of many fields
    private buildOptionalMetadata(result: WikipediaMangaData): Partial<SearchResult> {
        // Calculate accurate chapter count using both volumeList and chapterList data
        const volumeList = result['volumeList'] as WikipediaVolume[] | undefined;
        const chapterList = result['chapterList'] as WikipediaChapter[] | undefined;
        const finalChapterCount = this.calculateChapterCount(volumeList, chapterList);

        return {
            ...(result['genres'] && Array.isArray(result['genres']) && result['genres'].length > 0 && {
                genres: result['genres']
            }),
            ...(result['author'] && Array.isArray(result['author']) && result['author'].length > 0 && {
                authors: result['author']
            }),
            ...(result['volumes'] !== undefined && {
                volumes: result['volumes']
            }),
            ...(finalChapterCount > 0 && {
                chapters: finalChapterCount
            }),
            ...(result['artist'] && Array.isArray(result['artist']) && result['artist'].length > 0 && {
                artists: result['artist']
            }),
            ...(result['publisher'] && {
                publisher: result['publisher']
            }),
            ...(result['startDate'] && {
                startDate: result['startDate']
            }),
            ...(result['endDate'] && {
                endDate: result['endDate']
            }),
            ...(result['volumeList'] && Array.isArray(result['volumeList']) && result['volumeList'].length > 0 && {
                volumeData: this.mapVolumeData(
                    result['volumeList'] as WikipediaVolume[],
                    result['chapterList'] as WikipediaChapter[] | undefined
                )
            }),
            ...(result['startDate'] && {
                releaseYear: (() => {
                    const startDate = result['startDate'];
                    const date = startDate instanceof Date ? startDate : new Date(startDate as string);
                    return !isNaN(date.getTime()) ? date.getFullYear() : undefined;
                })()
            }),
            // Additional Wikipedia-specific fields
            ...(result['alternativeTitles'] && Array.isArray(result['alternativeTitles']) && result['alternativeTitles'].length > 0 && {
                alternativeTitles: result['alternativeTitles']
            }),
            ...(result['magazine'] && {
                magazine: result['magazine']
            }),
            ...(result['englishPublisher'] && {
                englishPublisher: result['englishPublisher']
            }),
            ...(result['imprint'] && {
                imprint: result['imprint']
            }),
            ...(result['demographic'] && {
                demographic: result['demographic']
            }),
            ...(result['originalRun'] && {
                originalRun: result['originalRun']
            }),
            // Synopsis is the story content from Plot/Synopsis sections
            ...(result['synopsis'] && {
                synopsis: result['synopsis']
            }),
            // Keep plot for backwards compatibility
            ...(result['plot'] && {
                plot: result['plot']
            })
        };
    }

    /**
     * Build raw data object from Wikipedia result
     *
     * @param result - Wikipedia search result
     * @returns Record<string, unknown> Raw data object
     */
    private buildRawData(result: WikipediaMangaData): Record<string, unknown> {
        const releaseYear = result['startDate'] ? (() => {
            const startDate = result['startDate'];
            const date = startDate instanceof Date ? startDate : new Date(startDate as string);
            return !isNaN(date.getTime()) ? date.getFullYear() : undefined;
        })() : undefined;

        return {
            wikipediaUrl: result['wikipediaUrl'],
            originalRun: result['originalRun'],
            magazine: result['magazine'],
            demographic: result['demographic'],
            volumeList: result['volumeList'],
            chapterList: result['chapterList'],
            englishPublisher: result['englishPublisher'],
            imprint: result['imprint'],
            startDate: result['startDate'],
            endDate: result['endDate'],
            alternativeTitles: result['alternativeTitles'],
            publisher: result['publisher'],
            releaseYear,
            // Synopsis is story content, separate from description
            synopsis: result['synopsis'],
            plot: result['plot']
        };
    }

    /**
     * Transform Wikipedia result to SearchResult format
     *
     * @param result - Wikipedia search result
     * @param id - Manga ID
     * @param coverImage - Cover image URL
     * @returns SearchResult Transformed search result
     */
    private transformToSearchResult(
        result: WikipediaMangaData,
        id: string,
        coverImage: string
    ): SearchResult {
        const optionalMetadata = this.buildOptionalMetadata(result);
        const rawData = this.buildRawData(result);

        return {
            id: id,
            title: result['title'],
            alternativeTitles: result['alternativeTitles'] ?? [],
            coverImage: coverImage,
            // Use description for main intro, synopsis for story content
            description: result['description'] ?? 'No description available',
            provider: MetadataProvider.WIKIPEDIA,
            status: 'UNKNOWN',
            ...optionalMetadata,
            rawData
        } as unknown as SearchResult;
    }

    /**
     * Search Wikipedia for manga
     *
     * @param query - Search query (manga title)
     * @returns Promise<SearchResult[]> Array of search results
     */
    async search(query: string): Promise<SearchResult[]> {
        try {
            logger.info(`[Wikipedia] Searching for: ${query}`);
            // Find best match on Wikipedia
            const result = await wikipediaService.findBestMatch(query);
            if (!result) {
                logger.info('[Wikipedia] No results found');
                return [];
            }

            // Fetch cover image using helper method
            const coverImage = await this.fetchCoverImage(result);

            // Transform to SearchResult format using helper method
            const id = encodeURIComponent((result['title'] as string).replace(/ /g, '_'));
            const searchResult = this.transformToSearchResult(result, id, coverImage);

            // Debug: Log volumeData in search result
            const volumeList = result['volumeList'] as unknown[] | undefined;
            const searchResultObj = searchResult as unknown as Record<string, unknown>;
            logger.info(`[Wikipedia] Found result: ${result['title'] as string}`, {
                hasVolumeList: !!volumeList,
                volumeListLength: volumeList?.length ?? 0,
                hasSearchResultVolumeData: !!searchResultObj['volumeData'],
                searchResultVolumeDataLength: Array.isArray(searchResultObj['volumeData'])
                    ? (searchResultObj['volumeData'] as unknown[]).length : 0,
            });
            return [searchResult];
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[Wikipedia] Search errorMessage:', errorMessage);
            return [];
        }
    }
    /**
     * Get detailed manga information from Wikipedia
     *
     * @param id - Wikipedia page ID or title (URL-encoded)
     * @returns Promise<SearchResult | null> Detailed manga information
     */
    async getMangaById(id: string): Promise<SearchResult | null> {
        try {
            // Decode the ID to get the page title
            const title = decodeURIComponent(id).replace(/_/g, ' ');
            logger.info(`[Wikipedia] Fetching details for: ${title}`);
            const result = await wikipediaService.findBestMatch(title);
            if (!result) {
                logger.warn(`[Wikipedia] No page found for: ${title}`);
                return null;
            }

            // Fetch cover image using helper method
            const coverImage = await this.fetchCoverImage(result);

            // Transform to SearchResult format using helper method
            const detailedResult = this.transformToSearchResult(result, id, coverImage);
            return detailedResult;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[Wikipedia] Error fetching manga details:', errorMessage);
            return null;
        }
    }
    /**
     * Check if provider is enabled
     *
     * @returns Promise<boolean> Provider enabled status
     */
    async isEnabled(): Promise<boolean> {
        try {
            const enabled = await searchConfigService.isProviderEnabled(this.type);
            return enabled;
        }
        catch (error: unknown) {
            logger.error(`Error checking if Wikipedia provider is enabled:`, error instanceof Error ? error.message : String(error));
            return false; // Default to disabled on error
        }
    }
    /**
     * Get provider configuration
     *
     * @returns object Provider configuration
     */
    getConfig(): unknown {
        return {
            name: 'wikipedia',
            enabled: true,
            enrichmentOnly: false,
            cacheEnabled: true,
            cacheTTL: 86400 // 24 hours
        };
    }
}
/**
 * Singleton instance of Wikipedia provider
 */
export const wikipediaProvider = new WikipediaProvider();
/**
 * Default export
 */
export default wikipediaProvider;
