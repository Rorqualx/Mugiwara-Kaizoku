// Web scraper engine for Kapowarr
// Uses cheerio for HTML parsing and follows AsyncResult pattern
import * as cheerio from 'cheerio';

import type { NativeDownloadProviderConfig, SelectorConfig, NativeDownloadMangaData, NativeDownloadChapterData, DownloadLink } from '@/types/adapters/native-download-types';
import type { MangaSearchResult } from '@/types/search.types';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { extractValue } from './web-scraper/extractors';
import {
    resolveUrl,
    buildMangaUrl,
    parseDate,
    applyRateLimit,
    createError,
} from './web-scraper/utils';

import type { MangaPublicationStatus } from '@prisma/client';

export class WebScraper {
    private config: NativeDownloadProviderConfig;
    constructor(config: NativeDownloadProviderConfig) {
        this.config = config;
    }
    /**
     * Process metadata fields and add them to search result
     *
     * Reduces nesting depth in extractSearchResults
     */
    private processMetadata(
        $: cheerio.CheerioAPI,
        element: Node,
        metadata: Record<string, SelectorConfig>,
        result: MangaSearchResult
    ): void {
        /* eslint-disable no-param-reassign */
        for (const [key, selector] of Object.entries(metadata)) {
            const value = extractValue($, element, selector);
            if (!value) continue;

            switch (key) {
                case 'description':
                    result.description = value;
                    break;
                case 'status':
                    result.status = value as MangaPublicationStatus;
                    break;
                case 'genres':
                    result.genres = Array.isArray(value) ? value : [value];
                    break;
                case 'tags':
                    result.tags = Array.isArray(value) ? value : [value];
                    break;
                case 'chapters':
                    result.chapters = parseInt(value, 10);
                    break;
                case 'volumes':
                    result.volumes = parseInt(value, 10);
                    break;
                default:
                    break;
            }
        }
        /* eslint-enable no-param-reassign */
    }

    async fetchPage(url: string): Promise<string> {
        try {
            // Apply rate limiting if configured
            if (this.config.rateLimit) {
                await applyRateLimit(this.config.rateLimit.requestsPerSecond ?? 1);
            }
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    ...this.config.headers
                }
            });
            if (response.ok) {
                return await response.text();
            }
            throw new ValidationError(`Failed to fetch page: HTTP ${response["status"]}`);
        }
        catch (error: unknown) {
            throw createError(`Failed to fetch ${url}`, error);
        }
    }
    extractSearchResults(html: string): Promise<MangaSearchResult[]> {
        try {
            const $ = cheerio.load(html);
            const results: MangaSearchResult[] = [];
            const { searchResults } = this.config.selectors;
            $(searchResults.container).each((index, element) => {
                try {
                    const result: MangaSearchResult = {
                        id: extractValue($, element, searchResults["id"]),
                        title: extractValue($, element, searchResults["title"]),
                        coverImage: resolveUrl(extractValue($, element, searchResults.coverUrl), this.config.baseUrl),
                        source: this.config["name"],
                        sourceId: extractValue($, element, searchResults["id"]),
                        provider: this.config["name"],
                        url: resolveUrl(extractValue($, element, searchResults.url), this.config.baseUrl)
                    };
                    // Extract additional metadata if configured
                    if (searchResults["metadata"]) {
                        this.processMetadata($, element as unknown as Node, searchResults["metadata"], result);
                    }
                    // Only add if we have at least ID and title
                    if (result["id"] && result["title"]) {
                        results.push(result);
                    }
                }
                catch (error: unknown) {
                    logger.error(`Failed to extract search result at index ${index}:`, error);
                }
            });
            return Promise.resolve(results);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw createError('Failed to extract search results', new Error(errorMessage));
        }
    }
    extractMangaDetails(html: string, mangaId: string): Promise<NativeDownloadMangaData> {
        try {
            const $ = cheerio.load(html);
            const { mangaDetails } = this.config.selectors;
            const manga: NativeDownloadMangaData = {
                id: mangaId,
                title: extractValue($, $.root()[0], mangaDetails["title"]),
                source: this.config["name"],
                sourceUrl: buildMangaUrl(mangaId, this.config.baseUrl)
            };
            // Extract optional fields
            if (mangaDetails["alternativeTitles"]) {
                const altTitles = extractValue($, $.root()[0], mangaDetails["alternativeTitles"]);
                if (altTitles) {
                    manga["alternativeTitles"] = altTitles.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
                }
            }
            if (mangaDetails["description"]) {
                manga["description"] = extractValue($, $.root()[0], mangaDetails["description"]);
            }
            if (mangaDetails.coverUrl) {
                const coverUrl = extractValue($, $.root()[0], mangaDetails.coverUrl);
                if (coverUrl) {
                    manga.coverUrl = resolveUrl(coverUrl, this.config.baseUrl);
                }
            }
            if (mangaDetails["status"]) {
                manga["status"] = extractValue($, $.root()[0], mangaDetails["status"]);
            }
            if (mangaDetails["authors"]) {
                const authors = extractValue($, $.root()[0], mangaDetails["authors"]);
                if (authors) {
                    manga["authors"] = authors.split(/[,&]/).map(a => a.trim()).filter(Boolean);
                }
            }
            if (mangaDetails["genres"]) {
                const genres = extractValue($, $.root()[0], mangaDetails["genres"]);
                if (genres) {
                    manga["genres"] = genres.split(/[,;]/).map(g => g.trim()).filter(Boolean);
                }
            }
            if (mangaDetails["tags"]) {
                const tags = extractValue($, $.root()[0], mangaDetails["tags"]);
                if (tags) {
                    manga["tags"] = tags.split(/[,;]/).map(t => t.trim()).filter(Boolean);
                }
            }
            return Promise.resolve(manga);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw createError('Failed to extract manga details', new Error(errorMessage));
        }
    }
    extractChapterList(html: string): Promise<NativeDownloadChapterData[]> {
        try {
            const $ = cheerio.load(html);
            const chapters: NativeDownloadChapterData[] = [];
            const { chapterList } = this.config.selectors;
            $(chapterList.container).each((index, element) => {
                try {
                    const titleValue = extractValue($, element, chapterList.chapterTitle);
                    const chapter: NativeDownloadChapterData = {
                        id: extractValue($, element, chapterList.chapterId),
                        number: parseFloat(extractValue($, element, chapterList.chapterNumber)) || 0,
                        ...(titleValue ? { title: titleValue } : {}),
                        url: resolveUrl(extractValue($, element, chapterList.chapterUrl), this.config.baseUrl)
                    };
                    if (chapterList.uploadDate) {
                        const dateStr = extractValue($, element, chapterList.uploadDate);
                        if (dateStr) {
                            const date = parseDate(dateStr);
                            if (date) {
                                chapter.uploadDate = date;
                            }
                        }
                    }
                    // Only add if we have valid ID and URL
                    if (chapter["id"] && chapter.url) {
                        chapters.push(chapter);
                    }
                }
                catch (error: unknown) {
                    logger.error(`Failed to extract chapter at index ${index}:`, error);
                }
            });
            // Sort chapters by number (descending - newest first)
            return Promise.resolve(chapters.sort((a, b) => b.number - a.number));
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw createError('Failed to extract chapter list', new Error(errorMessage));
        }
    }
    extractDownloadLinks(html: string): Promise<DownloadLink[]> {
        try {
            const $ = cheerio.load(html);
            const links: DownloadLink[] = [];
            const { downloadLinks } = this.config.selectors;
            $(downloadLinks.imageContainer).each((index, element) => {
                try {
                    const imageUrl = extractValue($, element, downloadLinks.imageUrl);
                    if (imageUrl) {
                        let pageNumber = index + 1;
                        if (downloadLinks.pageNumber) {
                            const pageNum = extractValue($, element, downloadLinks.pageNumber);
                            if (pageNum) {
                                pageNumber = parseInt(pageNum) || index + 1;
                            }
                        }
                        const link: DownloadLink = {
                            pageNumber: pageNumber,
                            imageUrl: resolveUrl(imageUrl, this.config.baseUrl)
                        };
                        links.push(link);
                    }
                }
                catch (error: unknown) {
                    logger.error(`Failed to extract download link at index ${index}:`, error);
                }
            });
            // Sort by page number
            return Promise.resolve(links.sort((a, b) => a.pageNumber - b.pageNumber));
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw createError('Failed to extract download links', new Error(errorMessage));
        }
    }
    testSelectors(html: string, selectors: Record<string, unknown>): Promise<Record<string, boolean>> {
        const $ = cheerio.load(html);
        const results: Record<string, boolean> = {};
        // Test search result selectors
        const searchResults = selectors['searchResults'];
        if (searchResults && typeof searchResults === 'object' && 'container' in searchResults) {
            results['searchResults.container'] = $(searchResults['container'] as string).length > 0;
        }
        // Test manga detail selectors
        if (selectors['mangaDetails']) {
            for (const [key, selector] of Object.entries(selectors['mangaDetails'] as Record<string, unknown>)) {
                if (selector && typeof selector === 'object') {
                    try {
                        const value = extractValue($, $.root()[0], selector as SelectorConfig);
                        results[`mangaDetails.${key}`] = !!value;
                    }
                    catch {
                        results[`mangaDetails.${key}`] = false;
                    }
                }
            }
        }
        // Test chapter list selectors
        const chapterList = selectors['chapterList'];
        if (chapterList && typeof chapterList === 'object' && 'container' in chapterList) {
            results['chapterList.container'] = $(chapterList['container'] as string).length > 0;
        }
        // Test download link selectors
        const downloadLinks = selectors['downloadLinks'];
        if (downloadLinks && typeof downloadLinks === 'object' && 'imageContainer' in downloadLinks) {
            results['downloadLinks.imageContainer'] = $(downloadLinks['imageContainer'] as string).length > 0;
        }
        return Promise.resolve(results);
    }

    dispose(): void {
        // Cleanup any resources if needed
        // Currently no resources to dispose
    }
}
