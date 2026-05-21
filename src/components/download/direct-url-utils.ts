/**
 * Direct URL Download Utilities
 *
 * URL parsing, validation, and type detection utilities for direct URL downloads.
 * Supports magnet links, .torrent files, NZB URLs, and direct file downloads.
 *
 * @module direct-url-utils
 */

/**
 * URL type classification
 */
export type UrlType = 'magnet' | 'torrent' | 'nzb' | 'direct' | 'unknown';

/**
 * Protocol type for download client selection
 */
export type ProtocolType = 'torrent' | 'usenet';

/**
 * Parsed URL result with validation info
 */
export interface ParsedUrl {
  url: string;
  type: UrlType;
  protocol: ProtocolType;
  filename: string | undefined;
  isValid: boolean;
  error: string | undefined;
}

/**
 * Download client compatibility info
 */
export interface ClientCompatibility {
  torrent: string[];
  usenet: string[];
}

/**
 * Known torrent clients
 */
export const TORRENT_CLIENTS = ['transmission', 'deluge', 'qbittorrent'] as const;

/**
 * Known usenet clients
 */
export const USENET_CLIENTS = ['nzbget', 'sabnzbd'] as const;

/**
 * URL pattern matchers
 */
const URL_PATTERNS = {
  /** Magnet URI scheme */
  magnet: /^magnet:\?xt=urn:btih:/i,
  /** .torrent file extension */
  torrentFile: /\.torrent(\?.*)?$/i,
  /** .nzb file extension */
  nzbFile: /\.nzb(\?.*)?$/i,
  /** Common NZB indexer API patterns */
  nzbApi: /[?&](t=get|action=getnzb|nzbid=|id=\d+.*\.nzb)/i,
  /** Direct download file extensions */
  directFile: /\.(cbz|cbr|zip|rar|7z|pdf)(\?.*)?$/i,
} as const;

/**
 * Detects the URL type based on patterns
 *
 * @param url - URL string to analyze
 * @returns Detected URL type
 */
export function detectUrlType(url: string): UrlType {
  const trimmedUrl = url.trim();

  // Magnet links are most specific
  if (URL_PATTERNS.magnet.test(trimmedUrl)) {
    return 'magnet';
  }

  // Check file extensions
  if (URL_PATTERNS.torrentFile.test(trimmedUrl)) {
    return 'torrent';
  }

  if (URL_PATTERNS.nzbFile.test(trimmedUrl)) {
    return 'nzb';
  }

  // Check NZB API patterns
  if (URL_PATTERNS.nzbApi.test(trimmedUrl)) {
    return 'nzb';
  }

  // Check direct file downloads
  if (URL_PATTERNS.directFile.test(trimmedUrl)) {
    return 'direct';
  }

  // Check if it's a valid URL at all
  try {
    new URL(trimmedUrl);
    return 'direct'; // Valid URL but unknown type, assume direct
  } catch {
    return 'unknown';
  }
}

/**
 * Gets the protocol type for a URL type
 *
 * @param urlType - The detected URL type
 * @returns Protocol type for client selection
 */
export function getProtocolForUrlType(urlType: UrlType): ProtocolType {
  switch (urlType) {
    case 'magnet':
    case 'torrent':
      return 'torrent';
    case 'nzb':
      return 'usenet';
    case 'direct':
    case 'unknown':
    default:
      // Default to torrent for direct/unknown - most common use case
      return 'torrent';
  }
}

/**
 * Extracts filename from URL
 *
 * @param url - URL to extract filename from
 * @returns Extracted filename or undefined
 */
export function extractFilename(url: string): string | undefined {
  const trimmedUrl = url.trim();

  // For magnet links, extract from dn parameter
  if (trimmedUrl.startsWith('magnet:')) {
    const match = trimmedUrl.match(/[?&]dn=([^&]+)/i);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
    return undefined;
  }

  // For regular URLs, extract from path
  try {
    const urlObj = new URL(trimmedUrl);
    const pathParts = urlObj.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart) {
      try {
        return decodeURIComponent(lastPart);
      } catch {
        return lastPart;
      }
    }
  } catch {
    // Invalid URL
  }

  return undefined;
}

/**
 * Validates a single URL
 *
 * @param url - URL string to validate
 * @returns Parsed URL result with validation info
 */
export function validateUrl(url: string): ParsedUrl {
  const trimmedUrl = url.trim();

  // Empty check
  if (!trimmedUrl) {
    return {
      url: trimmedUrl,
      type: 'unknown',
      protocol: 'torrent',
      filename: undefined,
      isValid: false,
      error: 'URL is empty',
    };
  }

  // Detect type
  const type = detectUrlType(trimmedUrl);
  const protocol = getProtocolForUrlType(type);
  const filename = extractFilename(trimmedUrl);

  // Unknown type means invalid URL format
  if (type === 'unknown') {
    return {
      url: trimmedUrl,
      type,
      protocol,
      filename,
      isValid: false,
      error: 'Invalid URL format',
    };
  }

  // Magnet links don't need further URL validation
  if (type === 'magnet') {
    // Validate magnet has required infohash
    if (!URL_PATTERNS.magnet.test(trimmedUrl)) {
      return {
        url: trimmedUrl,
        type,
        protocol,
        filename,
        isValid: false,
        error: 'Invalid magnet link: missing infohash',
      };
    }

    return {
      url: trimmedUrl,
      type,
      protocol,
      filename,
      isValid: true,
      error: undefined,
    };
  }

  // Validate URL format for non-magnet URLs
  try {
    const urlObj = new URL(trimmedUrl);

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        url: trimmedUrl,
        type,
        protocol,
        filename,
        isValid: false,
        error: `Unsupported protocol: ${urlObj.protocol}`,
      };
    }

    return {
      url: trimmedUrl,
      type,
      protocol,
      filename,
      isValid: true,
      error: undefined,
    };
  } catch {
    return {
      url: trimmedUrl,
      type,
      protocol,
      filename,
      isValid: false,
      error: 'Invalid URL format',
    };
  }
}

/**
 * Parses multiple URLs from input (comma, newline, or semicolon separated)
 *
 * @param input - Input string containing one or more URLs
 * @returns Array of parsed URL results
 */
export function parseMultipleUrls(input: string): ParsedUrl[] {
  if (!input.trim()) {
    return [];
  }

  // Split by comma, newline, or semicolon
  const separators = /[,\n;]+/;
  const urls = input
    .split(separators)
    .map((u) => u.trim())
    .filter(Boolean);

  return urls.map(validateUrl);
}

/**
 * Gets compatible download clients for a URL type
 *
 * @param urlType - The detected URL type
 * @param enabledClients - Array of enabled client names
 * @returns Filtered array of compatible client names
 */
export function getCompatibleClients(
  urlType: UrlType,
  enabledClients: string[]
): string[] {
  const protocol = getProtocolForUrlType(urlType);
  const enabledLower = enabledClients.map((c) => c.toLowerCase());

  if (protocol === 'torrent') {
    return TORRENT_CLIENTS.filter((c) => enabledLower.includes(c));
  }

  // Protocol is 'usenet'
  return USENET_CLIENTS.filter((c) => enabledLower.includes(c));
}

/**
 * Gets display label for URL type
 *
 * @param type - URL type
 * @returns Human-readable label
 */
export function getUrlTypeLabel(type: UrlType): string {
  switch (type) {
    case 'magnet':
      return 'Magnet Link';
    case 'torrent':
      return 'Torrent File';
    case 'nzb':
      return 'NZB File';
    case 'direct':
      return 'Direct Download';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

/**
 * Gets color for URL type badge
 *
 * @param type - URL type
 * @returns Mantine color name
 */
export function getUrlTypeColor(type: UrlType): string {
  switch (type) {
    case 'magnet':
      return 'violet';
    case 'torrent':
      return 'blue';
    case 'nzb':
      return 'orange';
    case 'direct':
      return 'green';
    case 'unknown':
    default:
      return 'gray';
  }
}

/**
 * Checks if any parsed URLs require usenet client
 *
 * @param parsedUrls - Array of parsed URLs
 * @returns True if any URL requires usenet
 */
export function requiresUsenetClient(parsedUrls: ParsedUrl[]): boolean {
  return parsedUrls.some((p) => p.protocol === 'usenet');
}

/**
 * Checks if any parsed URLs require torrent client
 *
 * @param parsedUrls - Array of parsed URLs
 * @returns True if any URL requires torrent client
 */
export function requiresTorrentClient(parsedUrls: ParsedUrl[]): boolean {
  return parsedUrls.some((p) => p.protocol !== 'usenet');
}
