/**
 * Native Download Website Operations Router
 *
 * Handles website validation, content fetching, and selector testing
 * for the visual inspector feature.
 *
 * Procedures:
 * - validateWebsite: Validate a website URL for use as source
 * - fetchWebsiteContent: Proxy fetch website HTML for visual inspector
 * - validateSelector: Test CSS selector against fetched HTML
 *
 * @module server/trpc/routers/native-download/website-operations
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';


import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import { validateWebsiteInput, websiteValidator } from './utils';

import type { AnyNode } from 'domhandler';

// ============================================================================
// Selector Extraction Helpers
// ============================================================================

type ExtractType = 'text' | 'attribute' | 'html';

interface ExtractionResult {
  count: number;
  samples: string[];
}

// Using ReturnType to infer CheerioAPI type from cheerio.load
type CheerioLoadFn = typeof import('cheerio').load;
type CheerioAPI = ReturnType<CheerioLoadFn>;

/**
 * Extract samples from CSS selector matches using cheerio
 */
function extractCssSamples(
  $: CheerioAPI,
  selector: string,
  extractType: ExtractType,
  attribute?: string
): ExtractionResult {
  const elements = $(selector);
  const count = elements.length;
  const samples: string[] = [];

  elements.slice(0, 5).each((_index: number, element: AnyNode) => {
    let value = '';
    if (extractType === 'text') {
      value = String($(element).text()).trim();
    } else if (extractType === 'attribute' && attribute) {
      value = String($(element).attr(attribute) ?? '');
    } else if (extractType === 'html') {
      value = String($.html(element));
    }
    if (value) {
      samples.push(value.slice(0, 500));
    }
  });

  return { count, samples };
}

/**
 * Extract samples from XPath selector matches
 */
async function extractXPathSamples(
  cleanHtml: string,
  selector: string,
  extractType: ExtractType
): Promise<ExtractionResult> {
  const { DOMParser } = await import('@xmldom/xmldom');
  const xpath = await import('xpath');

  const doc = new DOMParser({
    errorHandler: {
      warning: (): void => { /* ignore warnings */ },
      error: (): void => { /* ignore errors */ },
      fatalError: (): void => { /* ignore fatal errors */ }
    }
  }).parseFromString(cleanHtml, 'text/html');

  const nodes = xpath.select(selector, doc);

  if (!Array.isArray(nodes)) {
    return { count: 0, samples: [] };
  }

  const count = nodes.length;
  const samples: string[] = [];

  nodes.slice(0, 5).forEach(node => {
    const value = extractXPathValue(node, extractType);
    if (value) {
      samples.push(value.slice(0, 500));
    }
  });

  return { count, samples };
}

/**
 * Extract single value from an XPath node
 */
function extractXPathValue(node: unknown, extractType: ExtractType): string {
  const xmlNode = node as { textContent?: string; value?: string; nodeValue?: string };

  if (extractType === 'text') {
    return (xmlNode.textContent ?? xmlNode.nodeValue ?? '').trim();
  }
  if (extractType === 'attribute') {
    return xmlNode.value ?? '';
  }
  // extractType === 'html' - only remaining option after above checks
  return xmlNode.textContent ?? '';
}

// ============================================================================
// Website Operations Router
// ============================================================================

export const nativeDownloadWebsiteOperationsRouter = router({
  /**
   * Validate a website for use as a native download source
   */
  validateWebsite: protectedProcedure
    .input(validateWebsiteInput)
    .mutation(async ({ input }) => {
      try {
        // Use the WebsiteValidator service
        const result = await websiteValidator.validate(input.url);
        logger.info(`Validated website: ${input.url}`);
        return result;
      } catch (error: unknown) {
        logger.error(`Failed to validate website ${input.url}`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to validate website',
          cause: error
        });
      }
    }),

  /**
   * Fetch website content for visual inspector
   * Proxies remote website HTML to bypass CORS restrictions
   */
  fetchWebsiteContent: publicProcedure
    .input(
      z.object({
        url: z.string().url('Must be a valid URL'),
        headers: z.record(z.string()).optional()
      })
    )
    .query(async ({ input }) => {
      try {
        // Import dependencies for HTML sanitization
        const sanitizeHtml = (await import('sanitize-html')).default;

        // Fetch the page using fetch API with custom headers
        const response = await fetch(input.url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...input.headers
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();

        // Sanitize HTML to prevent XSS attacks
        const sanitized = sanitizeHtml(html, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            'img',
            'figure',
            'video',
            'audio',
            'iframe',
            'style',
            'link',
            'script'
          ]),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            '*': ['class', 'id', 'data-*', 'style']
          },
          allowedSchemes: ['http', 'https', 'data'],
          allowedSchemesByTag: {
            img: ['http', 'https', 'data'],
            link: ['http', 'https']
          }
        });

        logger.info(`Fetched website content for: ${input.url}`);

        return {
          html: sanitized,
          url: input.url
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          `Failed to fetch website content ${input.url}`,
          errorMessage
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch website content',
          cause: errorMessage
        });
      }
    }),

  /**
   * Validate a CSS or XPath selector against fetched HTML
   * Returns match count and sample results for testing
   */
  validateSelector: publicProcedure
    .input(
      z.object({
        url: z.string().url('Must be a valid URL'),
        selector: z.string().min(1, 'Selector is required'),
        selectorType: z.enum(['css', 'xpath']).default('css'),
        extractType: z.enum(['text', 'attribute', 'html']).default('text'),
        attribute: z.string().optional()
      })
    )
    .query(async ({ input }) => {
      try {
        const cheerio = await import('cheerio');

        const response = await fetch(input.url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        let result: ExtractionResult;

        if (input.selectorType === 'xpath') {
          const cleanHtml = $.html();
          result = await extractXPathSamples(cleanHtml, input.selector, input.extractType);
        } else {
          result = extractCssSamples($, input.selector, input.extractType, input.attribute);
        }

        logger.info(
          `Validated ${input.selectorType} selector for ${input.url}: ${result.count} matches`
        );

        return {
          isValid: result.count > 0,
          matchCount: result.count,
          samples: result.samples,
          selector: input.selector,
          selectorType: input.selectorType
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          `Failed to validate selector for ${input.url}`,
          errorMessage
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to validate selector',
          cause: errorMessage
        });
      }
    })
});
