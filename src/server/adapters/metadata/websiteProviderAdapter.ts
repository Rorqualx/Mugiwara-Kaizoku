// Example implementation of a website provider adapter
// This demonstrates how to create a concrete adapter for a specific website

import type { NativeDownloadAdapterConfig, NativeDownloadProviderConfig, NativeDownloadSearchOptions } from '@/types/adapters/native-download-types';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, isSuccess } from '@/utils/async-result';

import { BaseNativeDownloadAdapter } from './baseNativeDownloadAdapter';

export interface WebsiteProviderConfig extends NativeDownloadAdapterConfig {
  // Add any website-specific configuration here
  // Note: url and apiKey are inherited from NativeDownloadAdapterConfig as required fields
  // Additional optional properties:
  baseUrl?: string; // Base URL for the website (different from url)
  searchUrl?: string;
  selectors?: unknown;
  rateLimit?: number; // Rate limit in requests per second
  authentication?: {
    type: 'none' | 'basic' | 'cookie' | 'oauth';
    username?: string;
    password?: string;
    cookie?: string;
    token?: string;
  };
}

export class WebsiteProviderAdapter extends BaseNativeDownloadAdapter {
  constructor(config: WebsiteProviderConfig) {
    // Ensure required fields have values
    const fullConfig = {
      ...config,
      id: (config as unknown as Record<string, unknown>)["id"] as string || 'websiteprovider',
      searchUrl: config.searchUrl ?? '',
      selectors: config.selectors ?? {}
    };
    super(fullConfig as unknown as NativeDownloadProviderConfig, 'websiteprovider');
  }
  
  // Implement URL building methods
  buildSearchUrl(query: string, options?: NativeDownloadSearchOptions): string {
    // Replace {query} placeholder with actual search term
    const encodedQuery = encodeURIComponent(query);
    let url = this.config.searchUrl.replace('{query}', encodedQuery);
    
    // Add pagination if supported
    if (options?.offset) {
      const page = Math.floor(options.offset / (options.limit ?? 20)) + 1;
      url += `&page=${page}`;
    }
    
    return url;
  }
  
  buildMangaUrl(mangaId: string): string {
    // Build URL for manga details page
    // This is a common pattern, adjust based on website structure
    return `${this.config.baseUrl}/manga/${mangaId}`;
  }
  
  buildChapterUrl(mangaId: string, chapterId: string): string {
    // Build URL for chapter reading page
    // Adjust pattern based on website structure
    return `${this.config.baseUrl}/chapter/${mangaId}/${chapterId}`;
  }
  
  // Optional: Override methods if website needs special handling
  async getStatus(): Promise<AsyncResult<{ status: 'ok' | 'error'; message?: string }, Error>> {
    try {
      // Can add custom health check logic here
      const result = await super.getStatus();
      
      // Check if we got a successful result
      if (isSuccess(result)) {
        // Additional website-specific checks
        if (result.data["status"] === 'ok' && this.config.authentication?.type === 'cookie') {
          // Verify authentication is still valid
          const authValid = await this.verifyAuthentication();
          if (!authValid) {
            return createSuccessResult({
              status: 'error',
              message: 'Authentication expired'
            });
          }
        }
      }
      
      return result;
    } catch (error: unknown) {
      return createSuccessResult({
        status: 'error',
        message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
      });
    }
  }
  
  // Helper method for authentication verification
  private async verifyAuthentication(): Promise<boolean> {
    if (!this.config.authentication || this.config.authentication.type === 'none') {
      return true;
    }
    
    try {
      // Make a request that requires authentication
      const testUrl = `${this.config.baseUrl}/api/user`;
      const scraper = this.scraper as { fetchPage: (url: string) => Promise<unknown> };
      const response = await scraper.fetchPage(testUrl);
      const responseStr = typeof response === 'string' ? response : String(response);

      // Check if we got a login page redirect
      return !responseStr.includes('login') && !responseStr.includes('sign-in');
    } catch {
      return false;
    }
  }
  
  /**
   * Implement abstract method from base class
   */
  protected testSelectors(html: string, selectors: unknown): Promise<Record<string, boolean>> {
    // Test selectors against HTML content
    // This is a placeholder implementation
    const results: Record<string, boolean> = {};

    // Test each selector
    if (selectors) {
      for (const key in selectors) {
        // In a real implementation, you'd use a DOM parser like cheerio
        // to test if the selector matches elements in the HTML
        results[key] = true; // Placeholder
      }
    }

    return Promise.resolve(results);
  }
}

// Factory function for creating adapters
export function createWebsiteProviderAdapter(
  config: Partial<WebsiteProviderConfig>
): WebsiteProviderAdapter {
  const defaultConfig: WebsiteProviderConfig = {
    // Required fields
    url: '', // Required url property from NativeDownloadAdapterConfig
    apiKey: '', // Required apiKey property
    baseUrl: '',
    searchUrl: '',
    selectors: {
      searchResults: {
        container: '',
        id: { css: '', extract: 'attribute', attribute: 'href' },
        title: { css: '', extract: 'text' },
        coverUrl: { css: '', extract: 'attribute', attribute: 'src' },
        url: { css: '', extract: 'attribute', attribute: 'href' }
      },
      mangaDetails: {
        title: { css: '', extract: 'text' }
      },
      chapterList: {
        container: '',
        chapterId: { css: '', extract: 'attribute', attribute: 'href' },
        chapterNumber: { css: '', extract: 'text' },
        chapterTitle: { css: '', extract: 'text' },
        chapterUrl: { css: '', extract: 'attribute', attribute: 'href' }
      },
      downloadLinks: {
        imageContainer: '',
        imageUrl: { css: '', extract: 'attribute', attribute: 'src' }
      }
    },
    ...config // Spread config to override defaults
  } as WebsiteProviderConfig;
  
  return new WebsiteProviderAdapter(defaultConfig);
}

// Example: Pre-configured adapter for a popular manga site
export function createMangaReaderAdapter(): WebsiteProviderAdapter {
  return createWebsiteProviderAdapter({
    url: 'https://www.mangareader.tv', // Required url property
    apiKey: 'not-required-for-public-site', // Required apiKey property (not used for public site)
    baseUrl: 'https://www.mangareader.tv',
    searchUrl: 'https://www.mangareader.tv/search?w={query}',
    selectors: {
      searchResults: {
        container: '.manga-list .manga-item',
        id: {
          css: 'a.manga-link',
          extract: 'attribute',
          attribute: 'href',
          transform: [{
            type: 'regex',
            params: { pattern: '/read/([^/]+)', flags: '' }
          }]
        },
        title: {
          css: 'h3.manga-title',
          extract: 'text',
          transform: [{
            type: 'trim',
            params: {}
          }]
        },
        coverUrl: {
          css: 'img.manga-cover',
          extract: 'attribute',
          attribute: 'data-src',
          transform: [{
            type: 'replace',
            params: { search: '/small/', replace: '/medium/' }
          }]
        },
        url: {
          css: 'a.manga-link',
          extract: 'attribute',
          attribute: 'href'
        }
      },
      mangaDetails: {
        title: {
          css: 'h1.manga-title',
          extract: 'text'
        },
        alternativeTitles: {
          css: '.manga-info .alt-titles',
          extract: 'text',
          transform: [{
            type: 'split',
            params: { separator: ';', index: -1 }
          }]
        },
        description: {
          css: '.manga-description p',
          extract: 'text'
        },
        coverUrl: {
          css: '.manga-cover img',
          extract: 'attribute',
          attribute: 'src'
        },
        status: {
          css: '.manga-status',
          extract: 'text',
          transform: [{
            type: 'replace',
            params: { search: 'Status: ', replace: '' }
          }]
        },
        authors: {
          css: '.manga-author a',
          extract: 'text'
        },
        genres: {
          css: '.manga-genres a',
          extract: 'text'
        }
      },
      chapterList: {
        container: '.chapter-list li',
        chapterId: {
          css: 'a',
          extract: 'attribute',
          attribute: 'href',
          transform: [{
            type: 'regex',
            params: { pattern: '/chapter/([^/]+)', flags: '' }
          }]
        },
        chapterNumber: {
          css: '.chapter-number',
          extract: 'text',
          transform: [{
            type: 'regex',
            params: { pattern: 'Chapter ([0-9.]+)', flags: '' }
          }]
        },
        chapterTitle: {
          css: '.chapter-title',
          extract: 'text'
        },
        chapterUrl: {
          css: 'a',
          extract: 'attribute',
          attribute: 'href'
        },
        uploadDate: {
          css: '.chapter-date',
          extract: 'text'
        }
      },
      downloadLinks: {
        imageContainer: '.reading-content img',
        imageUrl: {
          css: '',
          extract: 'attribute',
          attribute: 'data-src',
          transform: [{
            type: 'replace',
            params: { search: 'compressed', replace: 'original' }
          }]
        }
      }
    },
    rateLimit: 2 // requests per second
  });
}

// Pre-configured adapter for GetComics.org (Comic Books - NOT Manga)
export function createGetComicsAdapter(): WebsiteProviderAdapter {
  return createWebsiteProviderAdapter({
    url: 'https://getcomics.org', // Required url property
    apiKey: 'not-required-for-public-site', // Required apiKey property (not used for public site)
    baseUrl: 'https://getcomics.org',
    searchUrl: 'https://getcomics.org/?s={query}',
    selectors: {
      searchResults: {
        container: 'article.post',
        id: {
          css: 'h1.post-title a',
          extract: 'attribute',
          attribute: 'href',
          transform: [{
            type: 'regex',
            params: { pattern: '/([^/]+)/?$', flags: '' }
          }]
        },
        title: {
          css: 'h1.post-title a',
          extract: 'text',
          transform: [{
            type: 'trim',
            params: {}
          }]
        },
        coverUrl: {
          css: '.post-thumbnail img',
          extract: 'attribute',
          attribute: 'src'
        },
        url: {
          css: 'h1.post-title a',
          extract: 'attribute',
          attribute: 'href'
        }
      },
      mangaDetails: {
        title: {
          css: 'h1.post-title',
          extract: 'text'
        },
        description: {
          css: '.post-content',
          extract: 'text'
        },
        // Note: GetComics doesn't have traditional manga/comic metadata like volumes
        // Using year and size info from post meta
        status: {
          css: '.post-info',
          extract: 'text',
          transform: [{
            type: 'regex',
            params: { pattern: 'Year\\s*:\\s*([^|]+)', flags: 'i' }
          }]
        }
      },
      chapterList: {
        // GetComics has download links instead of chapters
        // Treating each download link as a "chapter" for compatibility
        container: '.aio-button-center a',
        chapterId: {
          css: '',
          extract: 'attribute',
          attribute: 'href'
        },
        chapterNumber: {
          css: '',
          extract: 'text'
        },
        chapterTitle: {
          css: '',
          extract: 'text'
        },
        chapterUrl: {
          css: '',
          extract: 'attribute',
          attribute: 'href'
        }
      },
      downloadLinks: {
        // GetComics provides direct download links to various services
        // (Mega, MediaFire, Google Drive, etc.)
        imageContainer: '.aio-button-center a',
        imageUrl: {
          css: '',
          extract: 'attribute',
          attribute: 'href'
        }
      }
    },
    rateLimit: 1 // Be respectful: 1 request per second
  });
}
