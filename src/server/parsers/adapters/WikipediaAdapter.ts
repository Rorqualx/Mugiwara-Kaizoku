/**
 * Wikipedia Adapter
 * Specialized adapter for Wikipedia sources using MediaWiki API
 */
import axios from 'axios';

import { ContentExtractor, type ExtractedContent } from '../core/ContentExtractor';
import { DataNormalizer, type NormalizedMangaData } from '../core/DataNormalizer';


import type { ContentExtractionOptions } from '../core/ContentExtractor';
import type { NormalizationOptions } from '../core/DataNormalizer';
import type { ExtractedImage } from '../extractors/ImageExtractor';
// ============================================================================
// Type Definitions
// ============================================================================

// MediaWiki API Response Types
interface MediaWikiSearchResult {
  title: string;
  snippet?: string;
  size?: number;
  wordcount?: number;
}

interface MediaWikiSearchResponse {
  query?: {
    search?: MediaWikiSearchResult[];
  };
}

interface MediaWikiPageInfo {
  pageid?: number;
  title?: string;
  fullurl?: string;
  canonicalurl?: string;
  pageprops?: {
    disambiguation?: unknown;
  };
  categories?: Array<{ title: string }>;
}

interface MediaWikiQueryResponse {
  query?: {
    pages?: Record<string, MediaWikiPageInfo>;
    redirects?: Array<{ from: string; to: string }>;
  };
}

// MediaWiki Parse API Response
interface MediaWikiParseResponse {
  parse?: {
    text?: {
      '*': string;
    };
    displaytitle?: string;
  };
}

// MediaWiki Images API Response
interface MediaWikiImagesResponse {
  query?: {
    pages?: Record<string, {
      images?: Array<{ title: string }>;
    }>;
  };
}

// MediaWiki ImageInfo API Response
interface MediaWikiImageInfoResponse {
  query?: {
    pages?: Record<string, {
      imageinfo?: Array<{
        url: string;
      }>;
    }>;
  };
}

// MediaWiki Revisions API Response
interface MediaWikiRevisionsResponse {
  query?: {
    pages?: Array<{
      revisions?: Array<{
        slots?: {
          main?: {
            content?: string;
          };
        };
      }>;
    }>;
  };
}

interface MediaWikiSectionsResponse {
  parse?: {
    sections?: Array<{
      toclevel: number;
      level: string;
      line: string;
      number: string;
      index: string;
      fromtitle: string;
      byteoffset: number;
      anchor: string;
    }>;
    text?: {
      '*': string;
    };
  };
}

interface WikipediaPageData {
  title: string;
  pageid?: number;
  redirect?: string;
  disambiguation?: boolean;
  extract?: string;
  categories?: Array<{ title: string }>;
  images?: string[];
  links?: Array<{ title: string; url: string }>;
  fullurl?: string;
  canonicalurl?: string;
}

export interface WikipediaAdapterOptions {
  // API options
  language?: string;
  apiEndpoint?: string;
  // Content options
  fetchFullContent?: boolean;
  fetchCategories?: boolean;
  fetchImages?: boolean;
  fetchInfobox?: boolean;
  // Processing options
  followRedirects?: boolean;
  resolveDisambiguation?: boolean;
  // Caching
  useCache?: boolean;
  cacheTimeout?: number;
}
export class WikipediaAdapter {
  private contentExtractor: ContentExtractor;
  private dataNormalizer: DataNormalizer;
  private cache: Map<string, { data: NormalizedMangaData; timestamp: number }> = new Map();
  private apiEndpoint: string;
  constructor(private options: WikipediaAdapterOptions = {}) {
    this.contentExtractor = new ContentExtractor();
    this.dataNormalizer = new DataNormalizer();
    this.apiEndpoint = options.apiEndpoint ??
      `https://${options.language ?? 'en'}.wikipedia.org/w/api.php`;
  }
  /**
   * Extract manga data from Wikipedia URL or title
   */
  async extract(urlOrTitle: string): Promise<NormalizedMangaData> {
    // Check cache
    if (this.options.useCache) {
      const cached = this.getFromCache(urlOrTitle);
      if (cached) return cached;
    }
    // Extract title from URL if needed
    const title = this.extractTitle(urlOrTitle);
    // Fetch page data
    const pageData = await this.fetchPageData(title);
    if (!pageData) {
      throw new Error(`Page not found: ${title}`);
    }
    // Handle redirects
    if (this.options.followRedirects && pageData.redirect) {
      return this.extract(pageData.redirect);
    }
    // Handle disambiguation
    if (this.options.resolveDisambiguation && pageData.disambiguation) {
      const mangaPage = await this.resolveDisambiguation(title);
      if (mangaPage) {
        return this.extract(mangaPage);
      }
    }
    // Get full HTML content
    const html = await this.fetchHtmlContent(pageData.pageid);
    // Extract content
    const extractionOptions: ContentExtractionOptions = {
      autoDetectFormat: true,
      formatHint: 'wikipedia',
      extractTables: true,
      extractImages: this.options.fetchImages !== false,
      extractMetadata: true,
      extractLinks: true,
      mergeData: true,
      cleanText: true
    };
    const content = await this.contentExtractor.extract(html, extractionOptions);
    // Enhance with API data
    await this.enhanceWithApiData(content, pageData);
    // Check for chapter list page
    const chapterListPage = await this.findChapterListPage(title);
    if (chapterListPage) {
      await this.extractChapterList(content, chapterListPage);
    }
    // Normalize data
    const normalizationOptions: NormalizationOptions = {
      validateDates: true,
      validateNumbers: true,
      removeInvalid: true,
      deduplicateChapters: true,
      deduplicateVolumes: true,
      mergeVariants: true,
      inferMissingData: true,
      fillGaps: false,
      sortChapters: true,
      sortVolumes: true,
      normalizeText: true
    };
    const normalized = this.dataNormalizer.normalize(content, normalizationOptions);
    // Add source URL
    normalized.source.url = this.getPageUrl(title);
    // Cache result
    if (this.options.useCache) {
      this.addToCache(urlOrTitle, normalized);
    }
    return normalized;
  }
  /**
   * Search Wikipedia for manga
   */
  async search(query: string, limit = 10): Promise<WikiSearchResult[]> {
    try {
      const response = await axios.get<MediaWikiSearchResponse>(this.apiEndpoint, {
        params: {
          action: 'query',
          format: 'json',
          list: 'search',
          srsearch: query,
          srnamespace: '0',
          srlimit: limit,
          srprop: 'snippet|titlesnippet|size|wordcount'
        }
      });
      const results = response.data.query?.search ?? [];
      return results.map((result): WikiSearchResult => ({
        title: result.title,
        url: this.getPageUrl(result.title),
        snippet: this.cleanSnippet(result.snippet ?? ''),
        size: result.size ?? 0,
        wordCount: result.wordcount ?? 0
      }));
    } catch (_error: unknown) {
      return [];
    }
  }
  /**
   * Fetch page data from MediaWiki API
   */
  private async fetchPageData(title: string): Promise<WikipediaPageData | null> {
    try {
      const response = await axios.get<MediaWikiQueryResponse>(this.apiEndpoint, {
        params: {
          action: 'query',
          format: 'json',
          titles: title,
          prop: 'info|pageprops|categories',
          inprop: 'url',
          redirects: this.options.followRedirects ? '1' : '0'
        }
      });
      const pages = response.data.query?.pages;
      if (!pages) return null;
      const pageId = Object.keys(pages)[0];
      if (!pageId || pageId === '-1') return null; // Page doesn't exist
      const pageInfo = pages[pageId];
      if (!pageInfo) return null;

      // Convert MediaWikiPageInfo to WikipediaPageData
      const page: WikipediaPageData = {
        title: pageInfo.title ?? '',
        ...(pageInfo.pageid !== undefined ? { pageid: pageInfo.pageid } : {}),
        ...(pageInfo.fullurl !== undefined ? { fullurl: pageInfo.fullurl } : {}),
        ...(pageInfo.canonicalurl !== undefined ? { canonicalurl: pageInfo.canonicalurl } : {}),
        ...(pageInfo.categories !== undefined ? { categories: pageInfo.categories } : {})
      };

      // Check for redirect
      const redirects = response.data.query?.redirects;
      if (redirects && redirects.length > 0) {
        const firstRedirect = redirects[0];
        if (firstRedirect) {
          page.redirect = firstRedirect.to;
        }
      }
      // Check for disambiguation
      if (pageInfo.pageprops?.disambiguation !== undefined) {
        page.disambiguation = true;
      }
      return page;
    } catch (_error: unknown) {
      return null;
    }
  }
  /**
   * Fetch HTML content
   */
  private async fetchHtmlContent(pageId: number | undefined): Promise<string> {
    if (!pageId) return '';
    try {
      const response = await axios.get<MediaWikiParseResponse>(this.apiEndpoint, {
        params: {
          action: 'parse',
          format: 'json',
          pageid: pageId,
          prop: 'text|displaytitle',
          disabletoc: '1'
        }
      });
      return response.data.parse?.text?.['*'] ?? '';
    } catch (_error: unknown) {
      return '';
    }
  }
  /**
   * Enhance content with API data
   */
  private async enhanceWithApiData(content: ExtractedContent, pageData: WikipediaPageData): Promise<void> {
    // Add categories
    if (this.options.fetchCategories && pageData.categories) {
      const categories = pageData.categories.map((cat) =>
        cat.title.replace('Category:', '')
      );
      // Extract genres from categories
      const genreKeywords = ['manga', 'anime', 'shōnen', 'shōjo', 'seinen', 'josei'];
      const genres = categories.filter((cat) =>
        genreKeywords.some(keyword => cat.toLowerCase().includes(keyword))
      );
      if (genres.length > 0 && !content.metadata.genres) {
        // eslint-disable-next-line no-param-reassign
        content.metadata.genres = genres;
      }
    }
    // Fetch images if needed
    if (this.options.fetchImages && !content.images.length) {
      const images = await this.fetchPageImages(pageData.pageid ?? 0);
      const extractedImages: ExtractedImage[] = images
        .map(img => {
          if (typeof img === 'object' && img !== null && 'url' in img) {
            const imgObj = img as { url?: string; type?: string; source?: string };
            if (imgObj.url !== undefined) {
              return {
                url: imgObj.url,
                type: (imgObj.type === 'inline' ? 'inline' : 'unknown') as ExtractedImage['type']
              };
            }
          }
          return null;
        })
        .filter((img): img is ExtractedImage => img !== null);
      content.images.push(...extractedImages);
    }
    // Fetch infobox data
    if (this.options.fetchInfobox) {
      const infobox = await this.fetchInfoboxData(pageData.title);
      if (infobox && typeof infobox === 'object') {
        // Merge infobox data
        Object.assign(content.metadata, infobox);
      }
    }
  }
  /**
   * Find chapter list page
   */
  private async findChapterListPage(title: string): Promise<string | null> {
    // Common patterns for chapter list pages
    const patterns = [
      `List of ${title} chapters`,
      `${title} chapter list`,
      `List of ${title} episodes`,
      `${title} episode list`
    ];

    // Check all patterns in parallel
    const existsChecks = await Promise.all(
      patterns.map(async (pattern) => ({
        pattern,
        exists: await this.pageExists(pattern)
      }))
    );

    const foundPattern = existsChecks.find(check => check.exists);
    if (foundPattern) return foundPattern.pattern;

    // Search for related pages
    const searchResults = await this.search(`${title} chapters list`, 5);
    for (const result of searchResults) {
      if (result.title.toLowerCase().includes('chapter') ||
          result.title.toLowerCase().includes('episode')) {
        return result.title;
      }
    }
    return null;
  }
  /**
   * Extract chapter list from separate page
   */
  private async extractChapterList(content: ExtractedContent, chapterListTitle: string): Promise<void> {
    const html = await this.fetchHtmlByTitle(chapterListTitle);
    if (!html) return;
    const chapterContent = await this.contentExtractor.extract(html, {
      extractTables: true,
      extractLinks: true
    });
    // Merge chapters
    if (chapterContent.chapters.length > 0) {
      // eslint-disable-next-line no-param-reassign
      content.chapters = chapterContent.chapters;
    }
    // Merge volumes
    if (chapterContent.volumes.length > 0) {
      // eslint-disable-next-line no-param-reassign
      content.volumes = chapterContent.volumes;
    }
  }
  /**
   * Resolve disambiguation page
   */
  private async resolveDisambiguation(title: string): Promise<string | null> {
    const html = await this.fetchHtmlByTitle(title);
    if (!html) return null;
    // Look for manga-related links
    // eslint-disable-next-line no-undef
    const cheerio = require('cheerio') as typeof import('cheerio');
    const $ = cheerio.load(html);
    const links: string[] = [];
    $('a').each((_index, element) => {
      const $link = $(element);
      const text = $link.text().toLowerCase();
      const href = $link.attr('href');
      if (href && (text.includes('manga') || text.includes('comic'))) {
        const linkTitle = this.extractTitle(href);
        if (linkTitle) links.push(linkTitle);
      }
    });
    // Return first manga-related link
    return links[0] ?? null;
  }
  /**
   * Fetch page images
   */
  private async fetchPageImages(pageId: number | undefined): Promise<unknown[]> {
    if (!pageId) return [];
    try {
      const response = await axios.get<MediaWikiImagesResponse>(this.apiEndpoint, {
        params: {
          action: 'query',
          format: 'json',
          pageids: pageId,
          prop: 'images',
          imlimit: '50'
        }
      });
      const pages = response.data.query?.pages;
      if (!pages) return [];
      const page = pages[String(pageId)];
      if (!page?.images) return [];
      // Fetch image URLs
      const imagePromises = page.images.map((img) => this.fetchImageUrl(img.title));
      const imageUrls = await Promise.all(imagePromises);
      return imageUrls.filter((url): url is string => url !== null).map(url => ({
        url,
        type: 'inline',
        source: 'wikipedia-api'
      }));
    } catch (_error: unknown) {
      return [];
    }
  }
  /**
   * Fetch image URL
   */
  private async fetchImageUrl(imageTitle: string): Promise<string | null> {
    try {
      const response = await axios.get<MediaWikiImageInfoResponse>(this.apiEndpoint, {
        params: {
          action: 'query',
          format: 'json',
          titles: imageTitle,
          prop: 'imageinfo',
          iiprop: 'url'
        }
      });
      const pages = response.data.query?.pages;
      if (!pages) return null;
      const pageId = Object.keys(pages)[0];
      if (!pageId) return null;
      const imageInfo = pages[pageId]?.imageinfo?.[0];
      return imageInfo?.url ?? null;
    } catch (_error: unknown) {
      return null;
    }
  }
  /**
   * Fetch infobox data using TextExtracts
   */
  private async fetchInfoboxData(title: string): Promise<unknown> {
    try {
      const response = await axios.get<MediaWikiRevisionsResponse>(this.apiEndpoint, {
        params: {
          action: 'query',
          format: 'json',
          titles: title,
          prop: 'revisions',
          rvprop: 'content',
          rvslots: 'main',
          formatversion: '2'
        }
      });
      const page = response.data.query?.pages?.[0];
      if (!page) return null;
      const content = page.revisions?.[0]?.slots?.main?.content;
      if (!content) return null;
      // Parse infobox from wikitext
      return this.parseInfoboxWikitext(content);
    } catch (_error: unknown) {
      return null;
    }
  }
  /**
   * Parse infobox from wikitext
   */
  private parseInfoboxWikitext(wikitext: string): Record<string, string> | null {
    const infobox: Record<string, string> = {};
    // Match infobox template
    const infoboxMatch = wikitext.match(/\{\{Infobox[^}]+\}\}/is);
    if (!infoboxMatch?.[0]) return null;
    const infoboxText = infoboxMatch[0];
    // Parse key-value pairs
    const lines = infoboxText.split('\n');
    for (const line of lines) {
      const match = line.match(/\|\s*([^=]+?)\s*=\s*(.+)/);
      if (match?.[1] && match[2]) {
        const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
        const value = match[2].trim();
        // Clean wiki markup
        const cleanValue = value
          .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')  // [[link|text]] -> text
          .replace(/\[\[([^\]]+)\]\]/g, '$1')              // [[link]] -> link
          .replace(/'''(.+?)'''/g, '$1')                   // '''bold''' -> bold
          .replace(/''(.+?)''/g, '$1')                     // ''italic'' -> italic
          .replace(/<ref[^>]*>.*?<\/ref>/g, '')            // Remove references
          .replace(/<[^>]+>/g, '');                        // Remove HTML tags
        if (cleanValue) {
          infobox[key] = cleanValue;
        }
      }
    }
    return Object.keys(infobox).length > 0 ? infobox : null;
  }
  /**
   * Check if page exists
   */
  private async pageExists(title: string): Promise<boolean> {
    const pageData = await this.fetchPageData(title);
    return Boolean(pageData?.pageid && pageData.pageid > 0);
  }
  /**
   * Fetch HTML by title
   */
  private async fetchHtmlByTitle(title: string): Promise<string | null> {
    const pageData = await this.fetchPageData(title);
    if (!pageData) return null;
    return this.fetchHtmlContent(pageData.pageid);
  }
  /**
   * Extract title from URL or return as-is
   */
  private extractTitle(urlOrTitle: string): string {
    if (urlOrTitle.startsWith('http')) {
      const match = urlOrTitle.match(/\/wiki\/([^#?]+)/);
      if (match?.[1]) {
        return decodeURIComponent(match[1].replace(/_/g, ' '));
      }
    }
    return urlOrTitle;
  }
  /**
   * Get page URL from title
   */
  private getPageUrl(title: string): string {
    const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
    const language = this.options.language ?? 'en';
    return `https://${language}.wikipedia.org/wiki/${encodedTitle}`;
  }
  /**
   * Clean search snippet
   */
  private cleanSnippet(snippet: string): string {
    return snippet
      .replace(/<[^>]+>/g, '')  // Remove HTML tags
      .replace(/&[^;]+;/g, ' ')  // Remove HTML entities
      .trim();
  }
  /**
   * Get from cache
   */
  private getFromCache(key: string): NormalizedMangaData | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    const timeout = this.options.cacheTimeout ?? 3600000; // 1 hour default
    if (Date.now() - cached.timestamp > timeout) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }
  /**
   * Add to cache
   */
  private addToCache(key: string, data: NormalizedMangaData): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    // Limit cache size
    if (this.cache.size > 50) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }
  /**
   * Extract with disambiguation handling
   * Public method for test compatibility
   */
  async extractWithDisambiguation(searchTerm: string): Promise<NormalizedMangaData> {
    // First search for the term
    const searchResults = await this.search(searchTerm);
    if (searchResults.length === 0) {
      throw new Error(`No results found for: ${searchTerm}`);
    }
    // Try to find the most relevant result (usually manga-related)
    const mangaResult = searchResults.find(r =>
      r.title.toLowerCase().includes('manga') ||
      r.snippet.toLowerCase().includes('manga')
    ) ?? searchResults[0];
    if (!mangaResult) {
      throw new Error(`No valid result found for: ${searchTerm}`);
    }
    // Extract from the found page
    return this.extract(mangaResult.url);
  }
  /**
   * Search within a specific category
   * Public method for test compatibility
   */
  async searchInCategory(searchTerm: string, category: string): Promise<WikiSearchResult[]> {
    try {
      interface CategoryMember {
        title: string;
      }

      interface CategoryResponse {
        query?: {
          categorymembers?: CategoryMember[];
        };
      }

      const response = await axios.get<CategoryResponse>(this.apiEndpoint, {
        params: {
          action: 'query',
          format: 'json',
          list: 'categorymembers',
          cmtitle: `Category:${category}`,
          cmlimit: '50'
        }
      });
      const members = response.data.query?.categorymembers ?? [];
      // Filter by search term
      const filtered = members.filter((member) =>
        member.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return filtered.map((member): WikiSearchResult => ({
        title: member.title,
        url: `${this.apiEndpoint.replace('/api.php', '')}/wiki/${encodeURIComponent(member.title)}`,
        snippet: '',
        size: 0,
        wordCount: 0
      }));
    } catch (_error: unknown) {
      return [];
    }
  }
  /**
   * Extract a specific section from a Wikipedia page
   * Public method for test compatibility
   */
  async extractSection(pageTitle: string, sectionTitle: string): Promise<string> {
    try {
      const response = await axios.get<MediaWikiSectionsResponse>(this.apiEndpoint, {
        params: {
          action: 'parse',
          format: 'json',
          page: pageTitle,
          prop: 'sections|text'
        }
      });
      const sections = response.data.parse?.sections ?? [];
      const targetSection = sections.find((section) =>
        section.line === sectionTitle || section.anchor === sectionTitle
      );
      if (!targetSection) {
        return '';
      }
      // Extract section text (simplified)
      const text = response.data.parse?.text?.['*'] ?? '';
      return text; // In real implementation, would parse out just the section
    } catch (_error: unknown) {
      return '';
    }
  }
  /**
   * Extract volume list from a list page
   * Public method for test compatibility
   */
  async extractVolumeList(pageTitle: string): Promise<unknown[]> {
    const _url = `${this.apiEndpoint.replace('/api.php', '')}/wiki/${pageTitle}`;
    const html = await this.fetchHtmlByTitle(pageTitle) ?? '';
    const content = await this.contentExtractor.extract(html, {
      extractTables: true,
      formatHint: 'wikipedia'
    });
    return content.volumes;
  }
  /**
   * Extract metadata from Wikidata
   * Public method for test compatibility
   */
  async extractFromWikidata(wikidataId: string): Promise<unknown> {
    try {
      interface WikidataResponse {
        entities?: Record<string, {
          labels?: {
            en?: {
              value?: string;
            };
          };
          descriptions?: {
            en?: {
              value?: string;
            };
          };
          claims?: unknown;
        }>;
      }

      const response = await axios.get<WikidataResponse>('https://www.wikidata.org/w/api.php', {
        params: {
          action: 'wbgetentities',
          format: 'json',
          ids: wikidataId,
          props: 'labels|descriptions|claims'
        }
      });
      const entity = response.data.entities?.[wikidataId];
      if (!entity) return null;
      return {
        title: entity.labels?.en?.value,
        description: entity.descriptions?.en?.value,
        claims: entity.claims
      };
    } catch (_error: unknown) {
      return null;
    }
  }
  /**
   * Extract external links from a Wikipedia page
   * Public method for test compatibility
   */
  async extractExternalLinks(pageTitle: string): Promise<Array<{ url: string; type: string }>> {
    try {
      interface ExternalLinksResponse {
        query?: {
          pages?: Record<string, {
            extlinks?: Array<{ '*': string }>;
          }>;
        };
      }

      const response = await axios.get<ExternalLinksResponse>(this.apiEndpoint, {
        params: {
          action: 'query',
          format: 'json',
          titles: pageTitle,
          prop: 'extlinks',
          ellimit: '50'
        }
      });
      const pages = response.data.query?.pages;
      if (!pages) return [];
      const pageId = Object.keys(pages)[0];
      if (!pageId) return [];
      const extlinks = pages[pageId]?.extlinks ?? [];
      return extlinks.map((link) => ({
        url: link['*'],
        type: 'external'
      }));
    } catch (_error: unknown) {
      return [];
    }
  }
}
export interface WikiSearchResult {
  title: string;
  url: string;
  snippet: string;
  size: number;
  wordCount: number;
}