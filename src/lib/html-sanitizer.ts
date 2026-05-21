/**
 * HTML Sanitization Utilities
 *
 * Provides secure HTML sanitization using sanitize-html to prevent:
 * - Cross-Site Scripting (XSS) attacks
 * - Script injection through user-generated content
 * - Malicious HTML attributes (onclick, onerror, etc.)
 * - Protocol-based attacks (javascript:, data: URIs)
 *
 * OWASP A03:2021 - Injection Prevention
 *
 * @module lib/html-sanitizer
 */

import sanitize from 'sanitize-html';

import { logger } from '@/utils/logging';

import type { IOptions } from 'sanitize-html';

/**
 * Sanitization profiles for different use cases
 */
export const SANITIZATION_PROFILES = {
  /**
   * Strict profile - Only basic text formatting
   * Use for: User comments, forum posts, general UGC
   */
  STRICT: {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'b', 'i'],
    allowedAttributes: {},
    allowedSchemes: [] as string[],
    disallowedTagsMode: 'discard' as const,
  },

  /**
   * Basic profile - Text formatting with links
   * Use for: Blog posts, article summaries, descriptions
   */
  BASIC: {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'b', 'i', 'a', 'ul', 'ol', 'li'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https'],
    disallowedTagsMode: 'discard' as const,
  },

  /**
   * Rich content profile - Full formatting with images
   * Use for: Manga descriptions, author bios, editorial content
   */
  RICH: {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'mark',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'img',
      'div', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https'],
    disallowedTagsMode: 'discard' as const,
  },

  /**
   * Markdown profile - For markdown-generated HTML
   * Use for: Markdown content, README files, documentation
   */
  MARKDOWN: {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
    },
    allowedSchemes: ['http', 'https'],
    disallowedTagsMode: 'discard' as const,
  },
} as const;

/**
 * Sanitize HTML to prevent XSS attacks
 *
 * This function uses sanitize-html to remove potentially dangerous HTML/JavaScript:
 * - <script> tags
 * - Event handlers (onclick, onload, etc.)
 * - javascript: and data: URIs
 * - Unsafe protocols
 * - Malformed or nested HTML
 *
 * @param html - Untrusted HTML string (from user input or external API)
 * @param options - Sanitization options
 * @returns Sanitized HTML safe for rendering with dangerouslySetInnerHTML
 *
 * @example
 * ```typescript
 * // Basic usage with default strict profile
 * const safe = sanitizeHtml(userInput);
 *
 * // Use rich profile for manga descriptions
 * const description = sanitizeHtml(manga.description, { profile: 'RICH' });
 *
 * // Custom allowed tags
 * const custom = sanitizeHtml(content, {
 *   allowedTags: ['p', 'strong', 'a'],
 *   allowedAttributes: ['href']
 * });
 * ```
 */
// eslint-disable-next-line complexity -- HTML sanitization with multiple profiles, custom allowlists, and warning modes
export function sanitizeHtml(
  html: string,
  options?: {
    profile?: keyof typeof SANITIZATION_PROFILES;
    allowedTags?: string[];
    allowedAttributes?: string[];
    stripAll?: boolean; // Return plain text (remove all HTML)
    logWarnings?: boolean; // Log when sanitization removes content
  }
): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Strip all HTML if requested
  if (options?.stripAll) {
    return sanitize(html, {
      allowedTags: [],
      allowedAttributes: {},
    });
  }

  // Build configuration
  let config: IOptions;

  if (options?.allowedTags ?? options?.allowedAttributes) {
    // Custom configuration
    const customAllowedTags = options.allowedTags ?? [...SANITIZATION_PROFILES.STRICT.allowedTags];

    // Convert flat allowedAttributes array to sanitize-html format
    const attrArray = options.allowedAttributes ?? [];
    const customAllowedAttributes: Record<string, string[]> = {};
    if (attrArray.length > 0) {
      customAllowedAttributes['*'] = attrArray;
    }

    config = {
      allowedTags: customAllowedTags,
      allowedAttributes: customAllowedAttributes,
      allowedSchemes: ['http', 'https'],
      disallowedTagsMode: 'discard',
    };
  } else {
    // Use profile
    const profileName = options?.profile ?? 'STRICT';
    const selectedProfile = SANITIZATION_PROFILES[profileName];

    // Deep copy allowedAttributes to make it mutable
    const allowedAttrs: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(selectedProfile.allowedAttributes)) {
      allowedAttrs[key] = [...value];
    }

    config = {
      allowedTags: [...selectedProfile.allowedTags],
      allowedAttributes: allowedAttrs,
      allowedSchemes: [...selectedProfile.allowedSchemes],
      disallowedTagsMode: selectedProfile.disallowedTagsMode,
    };
  }

  // Additional security: explicitly exclude dangerous tags
  // sanitize-html discards unlisted tags by default, but we ensure these are never allowed
  const forbiddenTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button'];
  const currentTags = config.allowedTags;
  if (Array.isArray(currentTags)) {
    config.allowedTags = currentTags.filter(
      (tag: string) => !forbiddenTags.includes(tag)
    );
  }

  try {
    const originalLength = html.length;
    const sanitized = sanitize(html, config);

    // Log if significant content was removed
    if (options?.logWarnings && sanitized.length < originalLength * 0.8) {
      logger.warn('HTML sanitization removed significant content', {
        originalLength,
        sanitizedLength: sanitized.length,
        removedPercent: Math.round((1 - sanitized.length / originalLength) * 100),
      });
    }

    return sanitized;
  } catch (error) {
    logger.error('HTML sanitization failed', {
      error: error instanceof Error ? error.message : String(error),
      htmlLength: html.length,
    });

    // Fail-safe: Return empty string on error
    return '';
  }
}

/**
 * Sanitize HTML for React's dangerouslySetInnerHTML
 *
 * Convenience wrapper that returns the object format required by React.
 *
 * @param html - Untrusted HTML string
 * @param options - Sanitization options
 * @returns Object with __html property for React
 *
 * @example
 * ```tsx
 * <div dangerouslySetInnerHTML={sanitizeForReact(volume.description, { profile: 'RICH' })} />
 * ```
 */
export function sanitizeForReact(
  html: string,
  options?: Parameters<typeof sanitizeHtml>[1]
): { __html: string } {
  return {
    __html: sanitizeHtml(html, options),
  };
}

/**
 * Check if HTML string contains potentially dangerous content
 *
 * Use this for validation/warnings before sanitization.
 * Returns true if HTML appears to contain unsafe elements.
 *
 * @param html - HTML string to check
 * @returns true if potentially dangerous content detected
 *
 * @example
 * ```typescript
 * if (containsDangerousHtml(userInput)) {
 *   logger.warn('User attempted to submit dangerous HTML');
 *   // Still sanitize, but maybe show a warning to the user
 * }
 * const safe = sanitizeHtml(userInput);
 * ```
 */
export function containsDangerousHtml(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return false;
  }

  const dangerousPatterns = [
    /<script[\s>]/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
    /<form[\s>]/i,
    /data:text\/html/i,
    /<svg[\s>].*<script/is,
  ];

  return dangerousPatterns.some(pattern => pattern.test(html));
}

/**
 * Strip all HTML tags and return plain text
 *
 * Useful for:
 * - Search indexing
 * - Preview text
 * - Email notifications
 * - Meta descriptions
 *
 * @param html - HTML string
 * @param options - Strip options
 * @returns Plain text with no HTML
 *
 * @example
 * ```typescript
 * const plainText = stripHtml('<p>Hello <strong>world</strong></p>');
 * // Returns: "Hello world"
 *
 * const excerpt = stripHtml(longDescription, { maxLength: 200 });
 * // Returns: First 200 characters as plain text
 * ```
 */
export function stripHtml(
  html: string,
  options?: {
    maxLength?: number;
    preserveWhitespace?: boolean;
  }
): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Remove all HTML tags
  let text = sanitize(html, {
    allowedTags: [],
    allowedAttributes: {},
  });

  // Collapse whitespace unless preserved
  if (!options?.preserveWhitespace) {
    text = text.replace(/\s+/g, ' ').trim();
  }

  // Truncate if needed
  if (options?.maxLength && text.length > options.maxLength) {
    text = text.substring(0, options.maxLength).trim() + '...';
  }

  return text;
}

/**
 * Sanitize URL to prevent XSS through href attributes
 *
 * Validates and sanitizes URLs to ensure they're safe for use in links.
 * Blocks javascript: and data: protocols that could execute code.
 *
 * @param url - URL to sanitize
 * @returns Safe URL or empty string if invalid/dangerous
 *
 * @example
 * ```typescript
 * const safeUrl = sanitizeUrl(userProvidedUrl);
 * if (safeUrl) {
 *   return <a href={safeUrl}>Link</a>;
 * }
 * ```
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Block dangerous protocols
  const dangerousProtocols = /^(javascript|data|vbscript|file):/i;
  if (dangerousProtocols.test(url.trim())) {
    logger.warn('Blocked dangerous URL protocol', {
      url: url.substring(0, 50),
    });
    return '';
  }

  // Allow only http, https, mailto, tel
  const safeProtocols = /^(https?|mailto|tel):/i;
  const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(url);

  if (hasProtocol && !safeProtocols.test(url)) {
    logger.warn('Blocked unsafe URL protocol', {
      url: url.substring(0, 50),
    });
    return '';
  }

  // If no protocol, allow relative URLs
  // But block those starting with //
  if (!hasProtocol && url.startsWith('//')) {
    logger.warn('Blocked protocol-relative URL', {
      url: url.substring(0, 50),
    });
    return '';
  }

  return url;
}
