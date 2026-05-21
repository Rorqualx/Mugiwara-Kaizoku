/**
 * MetadataSelectionStep Utilities
 *
 * Helper functions for value extraction, cleaning, and common operations
 * used across all MetadataSelectionStep sub-components.
 */

/**
 * Clean HTML from text - removes tags, decodes entities
 *
 * @param html - HTML string to clean
 * @returns Cleaned plain text string
 */
export function cleanHtml(html: string): string {
  // First remove figure tags and their content completely (images)
  let cleaned = html.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '');

  // Remove all HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));

  // Remove extra whitespace and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Extract actual value from provider-suffixed value (e.g., "value::provider" -> "value")
 *
 * @param value - Value that may contain provider suffix
 * @returns Extracted value without provider suffix
 */
export function extractValue(value: string | null | undefined): string {
  if (!value) return '';
  if (value.includes('::')) {
    return value.split('::')[0] ?? '';
  }
  return value;
}

/**
 * Clean provider suffix/badge from values
 * Handles both "value::provider" and "[provider] value" formats
 *
 * @param value - Value with potential provider suffix/badge
 * @returns Cleaned value without provider information
 */
export function cleanProviderSuffix(value: string): string {
  let cleaned = value;

  // Remove provider badge if present "[provider] value"
  if (cleaned.startsWith('[') && cleaned.includes('] ')) {
    cleaned = cleaned.substring(cleaned.indexOf('] ') + 2);
  }

  // Remove provider suffix "value::provider"
  if (cleaned.includes('::')) {
    cleaned = cleaned.split('::')[0] ?? '';
  }

  return cleaned;
}

/**
 * Clean an array of values, removing provider suffixes
 *
 * @param values - Array of values with potential provider suffixes
 * @returns Cleaned array of values
 */
export function cleanValueArray(values: string[]): string[] {
  return values
    .map(cleanProviderSuffix)
    .filter((v): v is string => v !== '');
}

/**
 * Extract provider-specific URL from metadata
 *
 * @param provider - Provider name (e.g., "anilist", "myanimelist", "fandom")
 * @param metaObj - Metadata object from provider
 * @returns Provider URL or null if not found
 */
// eslint-disable-next-line complexity -- Complex URL extraction for multiple providers with various URL formats
export function extractProviderUrl(provider: string, metaObj: Record<string, unknown>): string | null {
  const providerLower = provider.toLowerCase();

  // AniList
  if (providerLower === 'anilist') {
    const anilistId = metaObj['id'] ?? metaObj['anilistId'] ?? metaObj['sourceId'];
    if (anilistId) return `https://anilist.co/manga/${anilistId}`;
  }

  // Fandom - check multiple URL fields and construct from wikiKey if needed
  if (providerLower === 'fandom') {
    // First check direct URL fields
    const directUrl = metaObj['url'] ?? metaObj['wikiUrl'] ?? metaObj['providerUrl'];
    if (typeof directUrl === 'string' && directUrl.includes('fandom.com')) {
      return directUrl;
    }
    // Check rawData for URL
    const rawData = metaObj['rawData'] as Record<string, unknown> | undefined;
    if (rawData) {
      const rawUrl = rawData['url'] ?? rawData['wikiUrl'];
      if (typeof rawUrl === 'string' && rawUrl.includes('fandom.com')) {
        return rawUrl;
      }
    }
    // Try to construct from wikiKey and title
    const metadata = metaObj['metadata'] as Record<string, unknown> | undefined;
    const wikiKey = metaObj['wikiKey'] ?? metadata?.['wikiKey'] ?? rawData?.['wikiKey'];
    const title = metaObj['title'];
    if (typeof wikiKey === 'string' && typeof title === 'string') {
      const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
      return `https://${wikiKey}.fandom.com/wiki/${encodedTitle}`;
    }
    return null;
  }

  // Wikipedia
  if (providerLower === 'wikipedia') {
    const wikiUrl = metaObj['url'] ?? metaObj['wikipediaUrl'] ?? metaObj['articleUrl'];
    if (typeof wikiUrl === 'string' && wikiUrl.startsWith('http')) {
      return wikiUrl;
    }
    const articleTitle = metaObj['title'] ?? metaObj['articleTitle'] ?? metaObj['pageName'];
    if (typeof articleTitle === 'string') {
      const encodedTitle = encodeURIComponent(articleTitle.replace(/ /g, '_'));
      return `https://en.wikipedia.org/wiki/${encodedTitle}`;
    }
  }

  // ComicVine
  if (providerLower === 'comicvine') {
    const cvUrl = metaObj['url'] ?? metaObj['siteDetailUrl'] ?? metaObj['providerUrl'];
    if (typeof cvUrl === 'string' && cvUrl.includes('comicvine')) {
      return cvUrl;
    }
  }

  // MyAnimeList
  if (providerLower === 'myanimelist' || providerLower === 'mal') {
    const malId = metaObj['id'] ?? metaObj['malId'] ?? metaObj['idMal'];
    if (malId) return `https://myanimelist.net/manga/${malId}`;
  }

  return null;
}

/**
 * Check if a URL belongs to a specific provider
 *
 * @param url - URL to check
 * @param provider - Provider name (lowercase)
 * @returns True if URL matches the provider domain
 */
export function isUrlForProvider(url: string, provider: string): boolean {
  const providerDomains: Record<string, string[]> = {
    fandom: ['fandom.com'],
    anilist: ['anilist.co'],
    myanimelist: ['myanimelist.net'],
    mal: ['myanimelist.net'],
    comicvine: ['comicvine.gamespot.com', 'comicvine.com'],
    wikipedia: ['wikipedia.org', 'en.wikipedia.org'],
  };

  const domains = providerDomains[provider];
  if (!domains) return false;

  try {
    const urlObj = new URL(url);
    return domains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Extract URLs from metadata object
 *
 * @param metadata - Metadata object that may contain URL fields
 * @returns Array of extracted URLs
 */
export function extractUrlsFromMetadata(metadata: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const urlFields = ['url', 'sourceUrl', 'link', 'externalUrl', 'officialUrl', 'mangaUrl', 'websiteUrl', 'siteUrl'];

  urlFields.forEach(field => {
    const value = metadata[field];
    if (typeof value === 'string' && value.startsWith('http')) {
      urls.push(value);
    }
  });

  // Check externalLinks array (populated by Fandom provider for MAL URLs, etc.)
  const externalLinks = metadata['externalLinks'];
  if (Array.isArray(externalLinks)) {
    externalLinks.forEach(link => {
      if (typeof link === 'string' && link.startsWith('http')) {
        urls.push(link);
      }
    });
  }

  // Check rawData
  const rawData = metadata['rawData'] as Record<string, unknown> | undefined;
  if (rawData && typeof rawData === 'object') {
    urlFields.forEach(field => {
      const value = rawData[field];
      if (typeof value === 'string' && value.startsWith('http')) {
        urls.push(value);
      }
    });
  }

  return urls;
}

/**
 * Find matching option value from options list
 * Used for Select components to match selectedMetadata to option values
 *
 * @param currentValue - Current selected value
 * @param options - Available options
 * @param usePrefix - If true, match by prefix (value::provider), otherwise extract value
 * @returns Matching option value or empty string
 */
export function findMatchingOptionValue(
  currentValue: string | undefined,
  options: { value: string; label: string }[],
  usePrefix: boolean = false
): string {
  if (!currentValue) return '';

  const matchingOption = options.find(opt => {
    if (usePrefix) {
      return opt.value.startsWith(currentValue + '::');
    }
    const extractedValue = extractValue(opt.value);
    return extractedValue === currentValue;
  });

  return matchingOption ? matchingOption.value : (usePrefix ? currentValue : '');
}

/**
 * Create a standard onChange handler for Select components
 * Extracts value from provider-suffixed format and updates metadata
 *
 * @param setSelectedMetadata - State setter for selected metadata
 * @param field - Field name to update
 * @returns Change handler function
 */
export function createSelectChangeHandler<T extends string>(
  setSelectedMetadata: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  field: T
): (value: string | null) => void {
  return (value: string | null): void => {
    let actualValue = value ?? '';
    if (actualValue.includes('::')) {
      actualValue = actualValue.split('::')[0] ?? '';
    }
    setSelectedMetadata(prev => ({
      ...prev,
      [field]: actualValue
    }));
  };
}
