/**
 * Fandom v1 API Implementation
 */

import { FandomAPIClient } from './FandomAPIClient';

import type {
  FandomV1APIResponse,
  FandomV1SearchItem,
  FandomV1ArticleDetails,
  FandomV1SimpleArticle
} from './types';

export class FandomV1API extends FandomAPIClient {

  /**
   * Search for articles using Fandom v1 API
   */
  async searchArticles(
    query: string,
    options: {
      limit?: number;
      namespaces?: string;
      minArticleQuality?: number;
    } = {}
  ): Promise<FandomV1SearchItem[]> {
    const response = await this.request<FandomV1APIResponse<FandomV1SearchItem[]>>(
      '/api/v1/Search/List',
      {
        query,
        limit: options.limit ?? 10,
        namespaces: options.namespaces ?? '0',
        minArticleQuality: options.minArticleQuality ?? 0
      }
    );

    return response.items ?? [];
  }

  /**
   * Get article details by IDs
   */
  async getArticleDetails(
    ids: number | number[],
    options: {
      abstract?: number;
      width?: number;
      height?: number;
    } = {}
  ): Promise<Record<string, FandomV1ArticleDetails>> {
    const articleIds = Array.isArray(ids) ? ids.join(',') : String(ids);

    const response = await this.request<FandomV1APIResponse<Record<string, FandomV1ArticleDetails>>>(
      '/api/v1/Articles/Details',
      {
        ids: articleIds,
        abstract: options.abstract ?? 200,
        width: options.width ?? 300,
        height: options.height ?? 300
      }
    );

    return response.items ?? {};
  }

  /**
   * Get simplified article content
   */
  async getSimpleArticle(articleId: number): Promise<FandomV1SimpleArticle | null> {
    try {
      const response = await this.request<FandomV1SimpleArticle>(
        `/api/v1/Articles/AsSimpleJson`,
        {
          id: articleId
        }
      );

      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Failed to get simple article', { articleId, errorMessage });
      return null;
    }
  }

  /**
   * List articles by category
   */
  async listArticlesByCategory(
    category: string,
    options: {
      limit?: number;
      offset?: number;
      namespaces?: string;
    } = {}
  ): Promise<Array<{ id: number; title: string; url: string; ns: number }>> {
    const response = await this.request<FandomV1APIResponse<Array<{
      id: number;
      title: string;
      url: string;
      ns: number;
    }>>>(
      '/api/v1/Articles/List',
      {
        category,
        limit: options.limit ?? 50,
        offset: options.offset ?? 0,
        namespaces: options.namespaces ?? '0'
      }
    );

    return response.items ?? [];
  }

  /**
   * Get top articles
   */
  async getTopArticles(
    options: {
      namespaces?: string;
      category?: string;
      limit?: number;
    } = {}
  ): Promise<Array<{ id: number; title: string; url: string }>> {
    const response = await this.request<FandomV1APIResponse<Array<{
      id: number;
      title: string;
      url: string;
    }>>>(
      '/api/v1/Articles/Top',
      {
        namespaces: options.namespaces ?? '0',
        category: options.category,
        limit: options.limit ?? 10
      }
    );

    return response.items ?? [];
  }

  /**
   * Get most linked articles
   */
  async getMostLinkedArticles(
    options: {
      namespaces?: string;
      limit?: number;
    } = {}
  ): Promise<Array<{ id: number; title: string; url: string; backlinks: number }>> {
    const response = await this.request<FandomV1APIResponse<Array<{
      id: number;
      title: string;
      url: string;
      backlinks: number;
    }>>>(
      '/api/v1/Articles/MostLinked',
      {
        namespaces: options.namespaces ?? '0',
        limit: options.limit ?? 10
      }
    );

    return response.items ?? [];
  }

  /**
   * Get new articles
   */
  async getNewArticles(
    options: {
      namespaces?: string;
      limit?: number;
      minArticleQuality?: number;
    } = {}
  ): Promise<Array<{ id: number; title: string; url: string; creation_date: string }>> {
    const response = await this.request<FandomV1APIResponse<Array<{
      id: number;
      title: string;
      url: string;
      creation_date: string;
    }>>>(
      '/api/v1/Articles/New',
      {
        namespaces: options.namespaces ?? '0',
        limit: options.limit ?? 10,
        minArticleQuality: options.minArticleQuality ?? 0
      }
    );

    return response.items ?? [];
  }

  /**
   * Get popular articles
   */
  async getPopularArticles(
    limit: number = 10
  ): Promise<Array<{ id: number; title: string; url: string }>> {
    const response = await this.request<FandomV1APIResponse<Array<{
      id: number;
      title: string;
      url: string;
    }>>>(
      '/api/v1/Articles/Popular',
      {
        limit
      }
    );

    return response.items ?? [];
  }

  /**
   * Get article content (expanded)
   */
  async getExpandedArticle(
    title: string
  ): Promise<{ content: string; sections: unknown[] } | null> {
    try {
      const response = await this.request<FandomV1APIResponse<{
        content: string;
        sections: unknown[];
      }>>(
        '/api/v1/Articles/Content',
        {
          titles: title
        }
      );

      return response.items ?? null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Failed to get expanded article', { title, errorMessage });
      return null;
    }
  }

  /**
   * Get related pages
   */
  async getRelatedPages(
    articleId: number,
    limit: number = 10
  ): Promise<Array<{ id: number; title: string; url: string }>> {
    const response = await this.request<FandomV1APIResponse<Array<{
      id: number;
      title: string;
      url: string;
    }>>>(
      '/api/v1/RelatedPages/List',
      {
        ids: articleId,
        limit
      }
    );

    return response.items ?? [];
  }

  /**
   * Get wiki variables (configuration)
   */
  async getWikiVariables(): Promise<Record<string, unknown>> {
    const response = await this.request<FandomV1APIResponse<Record<string, unknown>>>(
      '/api/v1/Mercury/WikiVariables'
    );

    return response.items ?? {};
  }

  /**
   * Search suggestions
   */
  async getSearchSuggestions(query: string): Promise<string[]> {
    const response = await this.request<FandomV1APIResponse<string[]>>(
      '/api/v1/SearchSuggestions/List',
      {
        query
      }
    );

    return response.items ?? [];
  }

  /**
   * Extract content from simple article
   */
  extractContentFromSimpleArticle(article: FandomV1SimpleArticle): {
    title?: string;
    sections: Array<{
      title: string;
      level: number;
      text: string;
      images: string[];
    }>;
  } {
    const sections: Array<{
      title: string;
      level: number;
      text: string;
      images: string[];
    }> = [];

    if (article.sections.length === 0) {
      return { sections };
    }

    article.sections.forEach(section => {
      const sectionData = {
        title: section["title"] || 'Untitled',
        level: section.level || 1,
        text: '',
        images: [] as string[]
      };

      // Extract text content
      if (section.content) {
        const textParts: string[] = [];

        section.content.forEach(content => {
          if (content.type === 'paragraph' && content.text) {
            textParts.push(content.text);
          } else if (content.type === 'list' && content.elements) {
            content.elements.forEach((element: unknown) => {
              if (typeof element === 'object' && element !== null && 'text' in element && typeof (element as { text: unknown }).text === 'string') {
                textParts.push(`• ${(element as { text: string }).text}`);
              }
            });
          }
        });

        sectionData.text = textParts.join('\n\n');
      }

      // Extract images
      if (section.images) {
        section.images.forEach(image => {
          if (image.src) {
            sectionData.images.push(image.src);
          }
        });
      }

      sections.push(sectionData);
    });

    // Set title from first section if it's a title section
    const firstSection = sections[0];
    const title = firstSection?.level === 1 ? firstSection.title : undefined;

    return {
      sections,
      ...(title !== undefined ? { title } : {})
    };
  }
}