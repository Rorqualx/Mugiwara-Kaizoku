/**
 * Data transformation utilities for the UniversalImportWizard
 *
 * Contains functions for converting and normalizing data from various providers
 * into consistent formats for manga import.
 */

/**
 * Convert date objects from various formats to ISO string format (YYYY-MM-DD)
 */
export const convertDateValue = (value: unknown): string => {
  if (!value) return '';

  if (typeof value === 'string') return value;

  if (typeof value === 'object' && 'year' in value) {
    // Handle AniList date objects {year, month, day}
    const dateObj = value as Record<string, unknown>;
    const year = dateObj["year"];
    const month = dateObj["month"];
    const day = dateObj["day"];
    return `${year}-${String(month ?? 1).padStart(2, '0')}-${String(day ?? 1).padStart(2, '0')}`;
  }

  if (value instanceof Date) {
    // Handle JavaScript Date objects
    const parts = value.toISOString().split('T');
    return parts[0] ?? '';
  }

  return String(value);
};

/**
 * Extract publisher string from various provider-specific formats
 */
export const extractPublisherValue = (value: unknown): string => {
  if (!value) return '';

  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const valueObj = value as Record<string, unknown>;

    // Handle empty object case
    if (Object.keys(value).length === 0) return '';

    // Handle ComicVine publisher objects {name: "Publisher Name", id: 123, ...}
    if ('name' in value) return valueObj["name"] as string;

    // Handle Fandom publisher formats {japan: "...", english: "..."}
    if ('japan' in value || 'english' in value) {
      return (valueObj["english"] ?? valueObj["japan"] ?? '') as string;
    }

    // Handle other possible publisher object formats
    if ('publisher' in value) return valueObj["publisher"] as string;
    if ('title' in value) return valueObj["title"] as string;
  }

  return String(value);
};

/**
 * Normalize manga publication status values to standard format
 */
export const normalizeStatus = (status: unknown): string | null => {
  if (!status) return null;

  const statusStr = String(status).toUpperCase();

  // Skip API status values
  if (['SUCCESS', 'ERROR', 'FAIL', 'FAILED', 'PENDING'].includes(statusStr)) {
    return null;
  }

  // Map common variations to standard values
  if (['ONGOING', 'PUBLISHING', 'RELEASING', 'ACTIVE'].includes(statusStr)) {
    return 'ONGOING';
  }

  if (['COMPLETED', 'FINISHED', 'COMPLETE', 'ENDED'].includes(statusStr)) {
    return 'COMPLETED';
  }

  if (['HIATUS', 'ON_HIATUS', 'PAUSED'].includes(statusStr)) {
    return 'HIATUS';
  }

  if (['CANCELLED', 'CANCELED', 'DISCONTINUED', 'DROPPED'].includes(statusStr)) {
    return 'CANCELLED';
  }

  // If it's "Unknown" or similar, return null to use defaults
  if (['UNKNOWN', 'N/A', 'TBD'].includes(statusStr)) {
    return null;
  }

  return String(status); // Return original if it doesn't match any pattern
};

/**
 * Format date for display purposes
 */
export const formatDateForDisplay = (date: unknown): string => {
  if (!date) return '';

  if (typeof date === 'string') return date;

  if (typeof date === 'object' && 'year' in date) {
    const dateObj = date as Record<string, unknown>;
    const year = dateObj["year"];
    const month = dateObj["month"];
    const day = dateObj["day"];
    return `${year}-${String(month || 1).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}`;
  }

  return String(date);
};

/**
 * Extract and normalize genres from various formats
 */
export const normalizeGenres = (genres: unknown): string[] => {
  if (!genres) return [];

  if (Array.isArray(genres)) {
    return (genres as unknown[]).filter((g): g is string => typeof g === 'string' && g.trim() !== '');
  }

  if (typeof genres === 'string') {
    // Handle comma-separated strings
    return genres.split(',').map(g => g.trim()).filter(g => g !== '');
  }

  return [];
};

/**
 * Extract and normalize tags/themes
 */
export const normalizeTags = (tags: unknown): string[] => {
  if (!tags) return [];

  if (Array.isArray(tags)) {
    return (tags as unknown[]).filter((t): t is string => typeof t === 'string' && t.trim() !== '');
  }

  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim()).filter(t => t !== '');
  }

  return [];
};

/**
 * Extract author/artist information from various formats
 */
export const extractCreators = (creators: unknown): string[] => {
  if (!creators) return [];

  if (Array.isArray(creators)) {
    return creators
      .map(c => {
        if (typeof c === 'string') return c;
        if (typeof c === 'object' && c !== null) {
          const creatorObj = c as Record<string, unknown>;
          return (creatorObj["name"] ?? creatorObj["title"] ?? '') as string;
        }
        return '';
      })
      .filter(c => c !== '');
  }

  if (typeof creators === 'string') {
    return creators.split(',').map(c => c.trim()).filter(c => c !== '');
  }

  if (typeof creators === 'object') {
    const creatorsObj = creators as Record<string, unknown>;
    if ('name' in creators) return [creatorsObj["name"] as string];
    if ('title' in creators) return [creatorsObj["title"] as string];
  }

  return [];
};

/**
 * Convert format type to standardized value
 */
export const normalizeFormat = (format: unknown): string => {
  if (!format) return 'MANGA';

  const formatStr = String(format).toUpperCase();

  const formatMap: Record<string, string> = {
    'MANGA': 'MANGA',
    'MANHWA': 'MANHWA',
    'MANHUA': 'MANHUA',
    'NOVEL': 'NOVEL',
    'LIGHT_NOVEL': 'NOVEL',
    'LIGHT NOVEL': 'NOVEL',
    'ONE_SHOT': 'ONE_SHOT',
    'ONESHOT': 'ONE_SHOT',
    'ONE SHOT': 'ONE_SHOT',
    'DOUJINSHI': 'DOUJINSHI',
    'COMIC': 'MANGA',
    'WEBCOMIC': 'MANGA',
    'WEBTOON': 'MANHWA'
  };

  return formatMap[formatStr] ?? 'MANGA';
};

/**
 * Extract volume/chapter count from various formats
 */
export const extractCount = (value: unknown): number | null => {
  if (value === null) return null;

  // If it's already a number, return it
  if (typeof value === 'number') return value;

  // If it's an array, return its length
  if (Array.isArray(value)) return value.length;

  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
};

/**
 * Extract external IDs from various provider data structures
 */
// eslint-disable-next-line complexity -- Complex ID extraction with provider-specific logic
export const extractExternalIds = (data: unknown, provider: string): Record<string, string> => {
  const ids: Record<string, string> = {};

  if (!data) return ids;

  const dataObj = data as Record<string, unknown>;
  const metadata = dataObj["metadata"] as Record<string, unknown> | undefined;
  const rawData = dataObj["rawData"] as Record<string, unknown> | undefined;

  // Extract AniList ID
  if (provider === 'anilist') {
    const anilistId = dataObj["id"] || dataObj["sourceId"] || metadata?.["id"];
    if (anilistId) ids["anilistId"] = String(anilistId);

    // Also try to get MAL ID from AniList data
    const malId = dataObj["idMal"] || metadata?.["idMal"] || rawData?.["idMal"];
    if (malId) ids["malId"] = String(malId);
  }

  // Extract ComicVine ID
  if (provider === 'comicvine') {
    const cvId = dataObj["id"] || dataObj["sourceId"] || dataObj["volumeId"] || metadata?.["id"];
    if (cvId) ids["comicVineId"] = String(cvId);
  }

  // Try generic extraction for all providers
  if (dataObj["anilistId"]) ids["anilistId"] = String(dataObj["anilistId"]);
  if (dataObj["malId"] || dataObj["idMal"]) ids["malId"] = String(dataObj["malId"] || dataObj["idMal"]);
  if (dataObj["comicVineId"]) ids["comicVineId"] = String(dataObj["comicVineId"]);
  if (dataObj["mangaUpdatesId"]) ids["mangaUpdatesId"] = String(dataObj["mangaUpdatesId"]);

  // Check metadata for IDs
  if (metadata) {
    if (metadata["anilistId"]) ids["anilistId"] = String(metadata["anilistId"]);
    if (metadata["malId"]) ids["malId"] = String(metadata["malId"]);
    if (metadata["comicVineId"]) ids["comicVineId"] = String(metadata["comicVineId"]);
  }

  // Check rawData for IDs
  if (rawData) {
    if (rawData["anilistId"]) ids["anilistId"] = String(rawData["anilistId"]);
    if (rawData["idMal"]) ids["malId"] = String(rawData["idMal"]);
    if (rawData["comicVineId"]) ids["comicVineId"] = String(rawData["comicVineId"]);
  }

  return ids;
};

/**
 * Extract external links from provider data
 */
export const extractExternalLinks = (data: unknown): string[] => {
  const links: string[] = [];

  if (!data) return links;

  const dataObj = data as Record<string, unknown>;

  // Check for direct URL fields
  const url = dataObj["url"];
  if (url && typeof url === 'string' && url.startsWith('http')) {
    links.push(url);
  }

  const wikiUrl = dataObj["wikiUrl"];
  if (wikiUrl && typeof wikiUrl === 'string' && wikiUrl.startsWith('http')) {
    links.push(wikiUrl);
  }

  const siteUrl = dataObj["siteUrl"];
  if (siteUrl && typeof siteUrl === 'string' && siteUrl.startsWith('http')) {
    links.push(siteUrl);
  }

  // Check for links object
  const linksObj = dataObj["links"];
  if (linksObj && typeof linksObj === 'object') {
    Object.values(linksObj as Record<string, unknown>).forEach((link: unknown) => {
      if (typeof link === 'string' && link.startsWith('http')) {
        links.push(link);
      }
    });
  }

  // Check for externalLinks array
  const externalLinks = dataObj["externalLinks"];
  if (Array.isArray(externalLinks)) {
    externalLinks.forEach((link: unknown) => {
      if (typeof link === 'string' && link.startsWith('http')) {
        links.push(link);
      }
    });
  }

  // Remove duplicates
  return [...new Set(links)];
};

/**
 * Merge alternative titles from multiple sources
 */
export const mergeAlternativeTitles = (sources: unknown[]): string[] => {
  const allTitles = new Set<string>();

  sources.forEach(source => {
    if (!source) return;

    const sourceObj = source as Record<string, unknown>;
    const metadata = sourceObj["metadata"] as Record<string, unknown> | undefined;

    // Direct alternative titles array
    const altTitles = sourceObj["alternativeTitles"];
    if (Array.isArray(altTitles)) {
      altTitles.forEach((title: unknown) => {
        if (typeof title === 'string' && title.trim()) {
          allTitles.add(title.trim());
        }
      });
    }

    // Check metadata
    const metadataAltTitles = metadata?.["alternativeTitles"];
    if (Array.isArray(metadataAltTitles)) {
      metadataAltTitles.forEach((title: unknown) => {
        if (typeof title === 'string' && title.trim()) {
          allTitles.add(title.trim());
        }
      });
    }

    // Check for title variations
    const titleEnglish = sourceObj["title_english"];
    if (titleEnglish && typeof titleEnglish === 'string' && titleEnglish !== sourceObj["title"]) {
      allTitles.add(titleEnglish);
    }

    const titleJapanese = sourceObj["title_japanese"];
    if (titleJapanese && typeof titleJapanese === 'string' && titleJapanese !== sourceObj["title"]) {
      allTitles.add(titleJapanese);
    }

    const titleRomaji = sourceObj["title_romaji"];
    if (titleRomaji && typeof titleRomaji === 'string' && titleRomaji !== sourceObj["title"]) {
      allTitles.add(titleRomaji);
    }
  });

  return Array.from(allTitles);
};