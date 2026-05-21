/**
 * MediaWiki API Implementation for Fandom
 */

import { FandomAPIClient } from './FandomAPIClient';

import type {
  MediaWikiAPIResponse,
  MediaWikiSearchResult,
  MediaWikiPage,
  MediaWikiImageInfo,
  PortableInfoboxData,
  InfoboxItem
} from './types';

export class MediaWikiAPI extends FandomAPIClient {

  /**
   * Search for articles
   */
  async search(
    query: string,
    options: {
      limit?: number;
      namespace?: string;
      offset?: number;
    } = {}
  ): Promise<MediaWikiSearchResult[]> {
    const response = await this.request<MediaWikiAPIResponse<{
      search: MediaWikiSearchResult[];
    }>>('/api.php', {
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: query,
      srnamespace: options.namespace ?? '0',
      srlimit: options.limit ?? 10,
      sroffset: options.offset ?? 0,
      srprop: 'snippet|titlesnippet|size|wordcount|timestamp'
    });

    return response.query?.search ?? [];
  }

  /**
   * Get page content by title
   */
  async getPageByTitle(
    title: string,
    props: string[] = ['revisions', 'categories', 'images', 'pageprops']
  ): Promise<MediaWikiPage | null> {
    const response = await this.request<MediaWikiAPIResponse<{
      pages: Record<string, MediaWikiPage>;
    }>>('/api.php', {
      action: 'query',
      format: 'json',
      titles: title,
      prop: props.join('|'),
      rvprop: 'content',
      rvslots: 'main',
      cllimit: 'max',
      imlimit: 'max'
    });

    const pages = response.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (!pageId) return null;

    const page = pages[pageId];

    // Check if page exists (pageid !== -1)
    if (!page || page.pageid === -1) {
      return null;
    }

    return page;
  }

  /**
   * Get page content by ID
   */
  async getPageById(
    pageId: number,
    props: string[] = ['revisions', 'categories', 'images', 'pageprops']
  ): Promise<MediaWikiPage | null> {
    const response = await this.request<MediaWikiAPIResponse<{
      pages: Record<string, MediaWikiPage>;
    }>>('/api.php', {
      action: 'query',
      format: 'json',
      pageids: pageId,
      prop: props.join('|'),
      rvprop: 'content',
      rvslots: 'main',
      cllimit: 'max',
      imlimit: 'max'
    });

    const pages = response.query?.pages;
    if (!pages) return null;

    const page = pages[String(pageId)];
    return page ?? null;
  }

  /**
   * Get pages in a category
   */
  async getCategoryMembers(
    category: string,
    options: {
      limit?: number;
      type?: 'page' | 'subcat' | 'file';
      namespace?: string;
    } = {}
  ): Promise<Array<{ title: string; pageid: number; ns: number }>> {
    const categoryTitle = category.startsWith('Category:') 
      ? category 
      : `Category:${category}`;

    const response = await this.request<MediaWikiAPIResponse<{
      categorymembers: Array<{
        pageid: number;
        ns: number;
        title: string;
      }>;
    }>>('/api.php', {
      action: 'query',
      format: 'json',
      list: 'categorymembers',
      cmtitle: categoryTitle,
      cmlimit: options.limit ?? 500,
      cmtype: options.type ?? 'page',
      cmnamespace: options.namespace
    });

    return response.query?.categorymembers ?? [];
  }

  /**
   * Get all categories
   */
  async getAllCategories(
    options: {
      prefix?: string;
      limit?: number;
    } = {}
  ): Promise<string[]> {
    const response = await this.request<MediaWikiAPIResponse<{
      allcategories: Array<{ category: string }>;
    }>>('/api.php', {
      action: 'query',
      format: 'json',
      list: 'allcategories',
      aclimit: options.limit ?? 500,
      acprefix: options.prefix
    });

    return response.query?.allcategories.map(cat => cat.category) ?? [];
  }

  /**
   * Get image information
   */
  async getImageInfo(
    titles: string | string[],
    options: {
      width?: number;
      height?: number;
    } = {}
  ): Promise<Record<string, MediaWikiImageInfo>> {
    const imageTitles = Array.isArray(titles) ? titles.join('|') : titles;

    const response = await this.request<MediaWikiAPIResponse<{
      pages: Record<string, {
        pageid: number;
        title: string;
        imageinfo?: MediaWikiImageInfo[];
      }>;
    }>>('/api.php', {
      action: 'query',
      format: 'json',
      titles: imageTitles,
      prop: 'imageinfo',
      iiprop: 'url|size|mime|thumburl',
      iiurlwidth: options.width ?? 300,
      iiurlheight: options.height ?? 300
    });

    const result: Record<string, MediaWikiImageInfo> = {};
    const pages = response.query?.pages;

    if (pages) {
      Object.values(pages).forEach(page => {
        if (page.imageinfo?.[0]) {
          result[page["title"]] = page.imageinfo[0];
        }
      });
    }

    return result;
  }

  /**
   * Parse portable infobox data
   */
  parseInfobox(infoboxJson: string): PortableInfoboxData[] | null {
    try {
      const parsed = JSON.parse(infoboxJson) as unknown;
      
      if (!Array.isArray(parsed)) {
        return null;
      }

      return parsed as PortableInfoboxData[];
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
this.log.error('Failed to parse infobox data', { errorMessage });
      return null;
    }
  }

  /**
   * Extract structured data from infobox
   */
  extractInfoboxData(infobox: PortableInfoboxData): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    const processItem = (item: InfoboxItem): void => {
      switch (item.type) {
        case 'title':
          data["title"] = item.data.value;
          break;

        case 'data':
          if (item.data.label && item.data.value) {
            // Clean HTML from value
            const cleanValue = this.cleanHtml(item.data.value);
            data[item.data.label] = cleanValue;
            this.log.debug('Extracted infobox field:', {
              label: item.data.label,
              value: cleanValue.substring(0, 50)
            });
          }
          break;

        case 'image':
          if (item.data[0]) {
            data["image"] = item.data[0].url;
            if (item.data[0].caption) {
              data["imageCaption"] = item.data[0].caption;
            }
          }
          break;

        case 'group':
          if (Array.isArray(item.data.value)) {
            item.data.value.forEach(processItem);
          }
          break;

        case 'header':
        default:
          // Headers are used for organization, not data
          break;
      }
    };

    if (Array.isArray(infobox.data)) {
      infobox.data.forEach(processItem);
    }

    return data;
  }

  /**
   * Clean HTML tags from text
   */
  private cleanHtml(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')  // Replace non-breaking spaces
      .replace(/&amp;/g, '&')   // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }

  /**
   * Parse wikitext content into sections
   */
  parseWikitext(wikitext: string): Array<{ title: string; content: string; level: number }> {
    const sections: Array<{ title: string; content: string; level: number }> = [];
    const lines = wikitext.split('\n');
    
    let currentSection: { title: string; content: string[]; level: number } | null = null;

    lines.forEach(line => {
      // Check for headers (=Title=, ==Subtitle==, etc.)
      const headerMatch = line.match(/^(={1,6})\s*(.+?)\s*\1$/);
      
      if (headerMatch?.[2] && headerMatch[1]) {
        // Save previous section
        if (currentSection) {
          sections.push({
            title: currentSection["title"],
            content: currentSection.content.join('\n').trim(),
            level: currentSection.level
          });
        }

        // Start new section
        currentSection = {
          title: headerMatch[2],
          content: [],
          level: headerMatch[1].length
        };
      } else if (currentSection) {
        // Add content to current section
        currentSection.content.push(line);
      }
    });

    // Save last section - cast needed due to TypeScript's closure analysis limitation
    const finalSection = currentSection as { title: string; content: string[]; level: number } | null;
    if (finalSection !== null && finalSection.content.length > 0) {
      sections.push({
        title: finalSection.title,
        content: finalSection.content.join('\n').trim(),
        level: finalSection.level
      });
    }

    return sections;
  }

  /**
   * Get recent changes
   */
  async getRecentChanges(
    options: {
      namespace?: string;
      limit?: number;
      type?: string;
    } = {}
  ): Promise<unknown[]> {
    const response = await this.request<MediaWikiAPIResponse<{
      recentchanges: unknown[];
    }>>('/api.php', {
      action: 'query',
      format: 'json',
      list: 'recentchanges',
      rcnamespace: options.namespace ?? '0',
      rclimit: options.limit ?? 50,
      rctype: options.type ?? 'edit|new',
      rcprop: 'title|timestamp|user|comment|sizes'
    });

    return response.query?.recentchanges ?? [];
  }

  /**
   * Search for images
   */
  async searchImages(
    query: string,
    limit: number = 20
  ): Promise<Array<{ title: string; url?: string }>> {
    const response = await this.request<MediaWikiAPIResponse<{
      allimages: Array<{
        name: string;
        title: string;
        url: string;
      }>;
    }>>('/api.php', {
      action: 'query',
      format: 'json',
      list: 'allimages',
      aiprefix: query,
      ailimit: limit,
      aiprop: 'url'
    });

    return response.query?.allimages.map(img => ({
      title: img["title"],
      url: img.url
    })) ?? [];
  }
}