/**
 * Enhanced Wikipedia extraction service
 * Improves extraction rates and UI compatibility
 */
import axios from 'axios';
import * as _cheerio from 'cheerio';

import { logger } from '@/utils/logger';
import { isObject, hasProperty, isArray } from '@/utils/type-guards';

/** Wikipedia API requires proper User-Agent per API etiquette */
const WIKIPEDIA_HEADERS = {
  'User-Agent': 'MugiwaraKaizoku/1.0 (https://github.com/mugiwara-kaizoku; manga-metadata-fetcher) axios/1.x',
  'Accept': 'application/json',
};

interface WikipediaSearchResult {
    title: string;
}

interface WikipediaSearchResponse {
    query: {
        search: WikipediaSearchResult[];
    };
}

/**
 * Type guard for Wikipedia search response
 */
function isWikipediaSearchResponse(value: unknown): value is WikipediaSearchResponse {
    return (
        isObject(value) &&
        hasProperty(value, 'query') &&
        isObject(value['query']) &&
        hasProperty(value['query'], 'search') &&
        isArray(value['query']['search'])
    );
}

interface WikipediaPageRevision {
    slots?: {
        main?: {
            '*'?: string;
        };
    };
}

interface WikipediaPageOriginal {
    source?: string;
}

interface WikipediaPageImage {
    title: string;
}

interface WikipediaPageData {
    title: string;
    extract?: string;
    original?: WikipediaPageOriginal;
    images?: WikipediaPageImage[];
    revisions?: WikipediaPageRevision[];
}

interface WikipediaPagesResponse {
    query: {
        pages: Record<string, WikipediaPageData>;
    };
}

/**
 * Type guard for Wikipedia pages response
 */
function isWikipediaPagesResponse(value: unknown): value is WikipediaPagesResponse {
    return (
        isObject(value) &&
        hasProperty(value, 'query') &&
        isObject(value['query']) &&
        hasProperty(value['query'], 'pages') &&
        isObject(value['query']['pages'])
    );
}

interface WikipediaMetadata {
    // Basic info
    title: string;
    pageId: number;
    url: string;
    // Description
    description: string;
    plot?: string;
    extract?: string;
    // Cover and images
    coverImage?: string;
    images?: string[];
    // Authors and creators
    author?: string[];
    artist?: string[];
    // Publication info
    publisher?: string;
    englishPublisher?: string;
    magazine?: string;
    englishMagazine?: string;
    imprint?: string;
    // Demographics
    demographic?: string;
    genres?: string[];
    // Status and dates
    originalRun?: string;
    firstPublished?: string;
    lastPublished?: string;
    status?: 'ONGOING' | 'COMPLETED';
    volumes?: number;
    chapters?: number;
    // Additional data
    alternativeTitles?: string[];
    japaneseTitle?: string;
    romajiTitle?: string;
    chapterListUrl?: string;
    chapterList?: Array<{
        number: string;
        title?: string;
        date?: string;
    }>;
}
export class EnhancedWikipediaExtractor {
    private apiBase = 'https://en.wikipedia.org/w/api.php';
    /**
     * Search Wikipedia with multiple strategies
     */
    async searchWikipedia(query: string): Promise<WikipediaMetadata | null> {
        // Try multiple search strategies
        const strategies = [
            `${query} manga`,
            `${query} (manga)`,
            query,
            `List of ${query} chapters`,
            `${query} characters`
        ];

        // Sequential search - stop at first successful result
        for (const searchQuery of strategies) {
            // eslint-disable-next-line no-await-in-loop -- Sequential search required to stop at first match
            const result = await this.trySearch(searchQuery);
            if (result) {
                return result;
            }
        }
        return null;
    }
    /**
     * Try a single search query
     */
    private async trySearch(query: string): Promise<WikipediaMetadata | null> {
        try {
            // Search for pages
            const searchUrl = `${this.apiBase}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
            const searchResponse = await axios.get(searchUrl, { timeout: 10000, headers: WIKIPEDIA_HEADERS });

            if (!isWikipediaSearchResponse(searchResponse.data)) {
                return null;
            }

            const results = searchResponse.data.query.search;
            if (results.length === 0) {
                return null;
            }

            // Check each result for manga-related content
            for (const result of results) {
                // eslint-disable-next-line no-await-in-loop -- Sequential check required to stop at first manga page
                const pageData = await this.getPageData(result.title);
                if (pageData && this.isMangaPage(pageData)) {
                    return pageData;
                }
            }
        }
        catch (error: unknown) {
logger.error(`Search errorMessage for "${query}":`, error instanceof Error ? error.message : String(error));
        }
        return null;
    }
    /**
     * Get detailed page data
     */
    private async getPageData(title: string): Promise<WikipediaMetadata | null> {
        try {
            // Get page content with all properties
            const queryUrl = `${this.apiBase}?action=query&titles=${encodeURIComponent(title)}&prop=extracts|pageimages|revisions|images|categories&exintro=true&explaintext=true&piprop=original&rvprop=content&rvslots=main&format=json&origin=*`;
            const response = await axios.get(queryUrl, { timeout: 15000, headers: WIKIPEDIA_HEADERS });

            if (!isWikipediaPagesResponse(response.data)) {
                return null;
            }

            const pages = response.data.query.pages;
            const pageId = Object.keys(pages)[0];
            if (!pageId || pageId === '-1') {
                return null;
            }

            const page = pages[pageId];
            if (!page) {
                return null;
            }

            const content = page.revisions?.[0]?.slots?.main?.['*'] ?? '';

            // Parse all metadata
            const metadata = this.parsePageContent(content, page);

            // Add basic info
            metadata.title = page.title;
            metadata.pageId = parseInt(pageId);
            metadata.url = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`;
            if (page.extract !== undefined) {
                metadata.extract = page.extract;
            }

            // Add main image if available
            if (page.original?.source) {
                metadata.coverImage = this.cleanImageUrl(page.original.source);
            }

            // Get additional images
            if (page.images) {
                metadata.images = await this.getPageImages(page.title, page.images);
            }

            return metadata;
        }
        catch (error: unknown) {
logger.error(`Failed to get page data for "${title}":`, error instanceof Error ? error.message : String(error));
            return null;
        }
    }
    /**
     * Parse Wikipedia page content for metadata
     */
    private parsePageContent(content: string, page: WikipediaPageData): WikipediaMetadata {
        const metadata: WikipediaMetadata = {
            title: page.title,
            pageId: 0, // Will be set by caller
            url: '',
            description: ''
        };
        // Extract infobox data
        const infoboxData = this.parseInfobox(content);
        Object.assign(metadata, infoboxData);
        // Extract plot section
        const plotMatch = content.match(/==\s*(?:Plot|Story|Synopsis)\s*==\s*([^=]+)/i);
        if (plotMatch?.[1]) {
            metadata.plot = plotMatch[1].trim();
            if (!metadata["description"]) {
                metadata["description"] = metadata.plot.substring(0, 500);
            }
        }
        // Extract chapter list if present
        const chapterList = this.parseChapterList(content);
        if (chapterList.length > 0) {
            metadata.chapterList = chapterList;
            if (!metadata["chapters"]) {
                metadata["chapters"] = chapterList.length;
            }
        }
        // Determine status
        if (metadata.originalRun) {
            metadata["status"] = metadata.originalRun.toLowerCase().includes('present') ? 'ONGOING' : 'COMPLETED';
        }
        return metadata;
    }
    /**
     * Parse infobox with enhanced patterns
     */
    private parseInfobox(content: string): Partial<WikipediaMetadata> {
        const metadata: Partial<WikipediaMetadata> = {};
        // Find infobox section
        const infoboxMatch = content.match(/\{\{Infobox[^}]*(?:manga|comic|graphic novel)[^}]*\}\}/is);
        if (!infoboxMatch) {
            // Try generic infobox
            const genericMatch = content.match(/\{\{Infobox[^}]+\}\}/is);
            if (!genericMatch)
                return metadata;
        }
        const infoboxContent = infoboxMatch?.[0] ?? content;
        // Enhanced field patterns
        const patterns = [
            // Authors and creators
            { pattern: /\|\s*(?:author|writer|story)\s*=\s*([^\n|]+)/i, field: 'author', isArray: true },
            { pattern: /\|\s*(?:illustrator|artist|art)\s*=\s*([^\n|]+)/i, field: 'artist', isArray: true },
            // Publishers
            { pattern: /\|\s*publisher\s*=\s*([^\n|]+)/i, field: 'publisher' },
            { pattern: /\|\s*publisher_en\s*=\s*([^\n|]+)/i, field: 'englishPublisher' },
            { pattern: /\|\s*english_publisher\s*=\s*([^\n|]+)/i, field: 'englishPublisher' },
            // Magazines
            { pattern: /\|\s*magazine\s*=\s*([^\n|]+)/i, field: 'magazine' },
            { pattern: /\|\s*magazine_en\s*=\s*([^\n|]+)/i, field: 'englishMagazine' },
            { pattern: /\|\s*serialized\s*=\s*([^\n|]+)/i, field: 'magazine' },
            // Demographics and genres
            { pattern: /\|\s*demographic\s*=\s*([^\n|]+)/i, field: 'demographic' },
            { pattern: /\|\s*genre\s*=\s*([^\n|]+)/i, field: 'genres', isArray: true },
            // Numbers
            { pattern: /\|\s*volumes\s*=\s*(\d+)/i, field: 'volumes', isNumber: true },
            { pattern: /\|\s*chapters\s*=\s*(\d+)/i, field: 'chapters', isNumber: true },
            { pattern: /\|\s*volumes_list\s*=\s*([^\n|]+)/i, field: 'volumeListUrl' },
            { pattern: /\|\s*chapter_list\s*=\s*([^\n|]+)/i, field: 'chapterListUrl' },
            // Dates
            { pattern: /\|\s*(?:first|first_run|published)\s*=\s*([^\n|]+)/i, field: 'firstPublished' },
            { pattern: /\|\s*(?:last|last_run|final)\s*=\s*([^\n|]+)/i, field: 'lastPublished' },
            { pattern: /\|\s*(?:run|original_run)\s*=\s*([^\n|]+)/i, field: 'originalRun' },
            // Other
            { pattern: /\|\s*imprint\s*=\s*([^\n|]+)/i, field: 'imprint' },
            { pattern: /\|\s*ja_kanji\s*=\s*([^\n|]+)/i, field: 'japaneseTitle' },
            { pattern: /\|\s*ja_romaji\s*=\s*([^\n|]+)/i, field: 'romajiTitle' },
        ];
        patterns.forEach(({ pattern, field, isArray, isNumber }) => {
            const match = infoboxContent.match(pattern);
            if (match?.[1]) {
                const value = this.cleanWikiMarkup(match[1]);

                // Type-safe field assignment using Record access
                const metadataRecord = metadata as Record<string, unknown>;

                if (isNumber) {
                    metadataRecord[field] = parseInt(value, 10);
                }
                else if (isArray) {
                    // Split by common separators and clean
                    const items = value.split(/[,;]|\{\{/)
                        .map(item => this.cleanWikiMarkup(item))
                        .filter(item => item && !item.includes('}}'));
                    if (items.length > 0) {
                        metadataRecord[field] = items;
                    }
                }
                else {
                    metadataRecord[field] = value;
                }
            }
        });
        // Build alternative titles
        const altTitles = [];
        if (metadata.japaneseTitle)
            altTitles.push(metadata.japaneseTitle);
        if (metadata.romajiTitle)
            altTitles.push(metadata.romajiTitle);
        if (altTitles.length > 0) {
            metadata["alternativeTitles"] = altTitles;
        }
        // Combine date fields for originalRun
        if (!metadata.originalRun && (metadata.firstPublished || metadata.lastPublished)) {
            const first = metadata.firstPublished ?? '';
            const last = metadata.lastPublished ?? 'present';
            metadata.originalRun = `${first} – ${last}`;
        }
        return metadata;
    }
    /**
     * Parse chapter list from content
     */
    private parseChapterList(content: string): Array<{
        number: string;
        title?: string;
        date?: string;
    }> {
        const chapters: Array<{
            number: string;
            title?: string;
            date?: string;
        }> = [];
        // Look for chapter list section
        const chapterSection = content.match(/==\s*(?:Chapter list|Chapters|Volume list|Volumes)\s*==[\s\S]+?(?===|$)/i);
        if (!chapterSection)
            return chapters;
        const sectionContent = chapterSection[0];
        // Parse table format (common in Wikipedia)
        const tableRows = sectionContent.match(/\|\s*\d+\s*\|\|[^|]+\|\|[^|]+/g);
        if (tableRows) {
            tableRows.forEach(row => {
                const match = row.match(/\|\s*(\d+)\s*\|\|\s*"?([^"|]+)"?\s*\|\|\s*([^|]+)/);
                if (match?.[1] && match[2] && match[3]) {
                    chapters.push({
                        number: match[1],
                        title: this.cleanWikiMarkup(match[2]),
                        date: this.cleanWikiMarkup(match[3])
                    });
                }
            });
        }
        // Parse list format
        const listItems = sectionContent.match(/^\*\s*(?:Chapter|Vol\.?)\s*(\d+)[:\s]+"?([^"\n]+)"?/gm);
        if (listItems) {
            listItems.forEach(item => {
                const match = item.match(/(\d+)[:\s]+"?([^"\n]+)"?/);
                if (match?.[1] && match[2]) {
                    chapters.push({
                        number: match[1],
                        title: this.cleanWikiMarkup(match[2])
                    });
                }
            });
        }
        return chapters;
    }
    /**
     * Get additional images from the page
     */
    private async getPageImages(title: string, imageList: WikipediaPageImage[]): Promise<string[]> {
        const images: string[] = [];
        try {
            // Get image URLs
            const imageTitles = imageList
                .map(img => img.title)
                .filter(title => /\.(jpg|jpeg|png|gif|webp)$/i.test(title))
                .slice(0, 10); // Limit to 10 images

            if (imageTitles.length === 0) {
                return images;
            }

            const imageUrl = `${this.apiBase}?action=query&titles=${imageTitles.join('|')}&prop=imageinfo&iiprop=url&format=json&origin=*`;
            const response = await axios.get(imageUrl, { timeout: 10000, headers: WIKIPEDIA_HEADERS });

            if (!isWikipediaPagesResponse(response.data)) {
                return images;
            }

            const pages = response.data.query.pages;
            Object.values(pages).forEach((page: WikipediaPageData) => {
                // Type guard for imageinfo property
                const imagePage = page as unknown;
                if (isObject(imagePage) && hasProperty(imagePage, 'imageinfo')) {
                    const imageinfoValue = imagePage['imageinfo'];
                    if (isArray(imageinfoValue) && imageinfoValue.length > 0) {
                        const firstImage = imageinfoValue[0];
                        if (isObject(firstImage) && hasProperty(firstImage, 'url')) {
                            const url = firstImage['url'];
                            if (typeof url === 'string') {
                                images.push(this.cleanImageUrl(url));
                            }
                        }
                    }
                }
            });
        }
        catch (error: unknown) {
            logger.error('Failed to get images:', error instanceof Error ? error.message : String(error));
        }
        return images;
    }
    /**
     * Check if a page is manga-related
     */
    private isMangaPage(metadata: WikipediaMetadata): boolean {
        // Check for manga indicators
        const indicators = [
            metadata["title"].toLowerCase().includes('manga'),
            metadata["title"].toLowerCase().includes('chapter'),
            metadata.magazine !== undefined,
            metadata.demographic !== undefined,
            metadata.volumes !== undefined,
            metadata["chapters"] !== undefined,
            metadata.chapterList && metadata.chapterList.length > 0,
            metadata["description"].toLowerCase().includes('manga'),
            metadata.plot?.toLowerCase().includes('manga')
        ];
        // Need at least 2 indicators
        return indicators.filter(Boolean).length >= 2;
    }
    /**
     * Clean wiki markup from text
     */
    private cleanWikiMarkup(text: string): string {
        if (!text)
            return '';
        return text
            .replace(/\[\[([^|\]]+)\|?[^\]]*\]\]/g, '$1') // [[Link|Text]] -> Link
            .replace(/'{2,}/g, '') // Remove bold/italic
            .replace(/<[^>]+>/g, '') // Remove HTML
            .replace(/\{\{[^}]+\}\}/g, '') // Remove templates
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Clean image URL
     */
    private cleanImageUrl(url: string): string {
        if (!url)
            return '';
        // Ensure HTTPS and remove thumbnail parameters
        let processedUrl = url;
        processedUrl = processedUrl.replace(/^http:/, 'https:');
        // Remove thumbnail parameters
        processedUrl = processedUrl.replace(/\/thumb\//, '/');
        processedUrl = processedUrl.replace(/\/\d+px-[^/]+$/, '');
        return processedUrl;
    }
    /**
     * Extract description from metadata
     */
    private extractDescription(metadata: WikipediaMetadata): string {
        return (
            metadata.description ||
            metadata.plot?.substring(0, 500) ||
            metadata.extract?.substring(0, 500) ||
            ''
        );
    }

    /**
     * Extract chapter count from metadata
     */
    private extractChapterCount(metadata: WikipediaMetadata): number | undefined {
        return metadata.chapters ?? metadata.chapterList?.length;
    }

    /**
     * Build additional metadata object
     */
    private buildAdditionalMetadata(metadata: WikipediaMetadata): Record<string, unknown> {
        return {
            artist: Array.isArray(metadata.artist) ? metadata.artist.join(', ') : '',
            demographic: metadata.demographic ?? '',
            magazine: metadata.englishMagazine ?? metadata.magazine ?? '',
            imprint: metadata.imprint ?? '',
            originalRun: metadata.originalRun ?? '',
            wikipediaUrl: metadata.url,
            chapterCount: metadata.chapterList?.length ?? 0,
            images: metadata.images ?? []
        };
    }

    /**
     * Format for UI (ConfirmationStep compatibility)
     */
    formatForUI(metadata: WikipediaMetadata): unknown {
        return {
            // Required fields
            id: metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            title: metadata.title,
            source: 'wikipedia',
            provider: 'wikipedia',
            // Cover image
            cover: metadata.coverImage ?? '',
            coverImage: metadata.coverImage ?? '',
            coverUrl: metadata.coverImage ?? '',
            // Description
            description: this.extractDescription(metadata),
            // Status
            status: metadata.status ?? 'ONGOING',
            // Genres
            genres: metadata.genres ?? [],
            // Alternative titles
            alternativeTitles: metadata.alternativeTitles ?? [],
            // Authors
            authors: metadata.author ?? [],
            // Publisher
            publisher: metadata.englishPublisher ?? metadata.publisher ?? '',
            // Volumes and chapters
            volumes: metadata.volumes,
            chapters: this.extractChapterCount(metadata),
            // Additional metadata
            metadata: this.buildAdditionalMetadata(metadata)
        };
    }
}
// Export singleton instance
export const enhancedWikipediaExtractor = new EnhancedWikipediaExtractor();
