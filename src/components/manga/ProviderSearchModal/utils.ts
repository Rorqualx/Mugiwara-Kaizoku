/**
 * Utility functions for Provider Search Modal
 */

import {
  IconBook,
  IconCalendar,
  IconUser,
  IconDatabase,
  IconTags,
  IconPalette,
  IconBuildingStore,
  IconStar,
  IconEye,
  IconCheck,
  IconLanguage,
  IconWorld,
  IconPhoto,
  IconList,
  IconUsers,
  IconBooks,
  IconFileText
} from '@tabler/icons-react';

import type { MetadataFieldConfig, FieldSelection } from './types';

/** Manga-level metadata fields — matches the import wizard's enrichable fields */
export const METADATA_FIELDS: MetadataFieldConfig[] = [
  // Core text
  { key: 'title', label: 'Title', icon: IconBook },
  { key: 'alternativeTitles', label: 'Alternative Titles', icon: IconBook },
  { key: 'description', label: 'Description', icon: IconDatabase },

  // Media
  { key: 'coverUrl', label: 'Cover Image', icon: IconPhoto },
  { key: 'bannerImage', label: 'Banner Image', icon: IconPhoto },

  // Publication metadata
  { key: 'status', label: 'Status', icon: IconCheck },
  { key: 'format', label: 'Format', icon: IconList },
  { key: 'demographic', label: 'Demographic', icon: IconUsers },
  { key: 'countryOfOrigin', label: 'Country', icon: IconWorld },
  { key: 'language', label: 'Language', icon: IconLanguage },

  // Categorization
  { key: 'genres', label: 'Genres', icon: IconTags },
  { key: 'tags', label: 'Tags', icon: IconTags },
  { key: 'themes', label: 'Themes', icon: IconTags },

  // Creator info
  { key: 'author', label: 'Author', icon: IconUser },
  { key: 'artist', label: 'Artist', icon: IconPalette },
  { key: 'publisher', label: 'Publisher', icon: IconBuildingStore },
  { key: 'englishPublisher', label: 'English Publisher', icon: IconBuildingStore },
  { key: 'magazine', label: 'Magazine', icon: IconBooks },

  // Dates
  { key: 'startDate', label: 'Start Date', icon: IconCalendar },
  { key: 'endDate', label: 'End Date', icon: IconCalendar },
  { key: 'originalRun', label: 'Original Run', icon: IconCalendar },

  // Counts & ratings
  { key: 'chapters', label: 'Chapters', icon: IconBook },
  { key: 'volumes', label: 'Volumes', icon: IconBooks },
  { key: 'score', label: 'Score', icon: IconStar },
  { key: 'popularity', label: 'Popularity', icon: IconEye },

  // Media gallery (Fandom)
  { key: 'gallery', label: 'Gallery', icon: IconPhoto },
];

/** Volume-level source preference fields — selects which provider to use for volume metadata */
export const VOLUME_SOURCE_FIELDS: MetadataFieldConfig[] = [
  { key: 'volumeCover', label: 'Volume Cover Source', icon: IconPhoto },
  { key: 'volumeTitle', label: 'Volume Title Source', icon: IconFileText },
  { key: 'volumeSummary', label: 'Volume Summary Source', icon: IconDatabase },
];

/** Chapter-level source preference fields — selects which provider to use for chapter metadata */
export const CHAPTER_SOURCE_FIELDS: MetadataFieldConfig[] = [
  { key: 'chapterCover', label: 'Chapter Cover Source', icon: IconPhoto },
  { key: 'chapterTitle', label: 'Chapter Title Source', icon: IconFileText },
  { key: 'chapterSummary', label: 'Chapter Summary Source', icon: IconDatabase },
];

export const PROVIDER_LIST = ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'] as const;

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not available';
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 100) + '...';
  }
  return String(value);
}

export function getProviderColor(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'current': return 'gray';
    case 'anilist': return 'blue';
    case 'comicvine': return 'green';
    case 'fandom': return 'purple';
    case 'wikipedia': return 'orange';
    case 'mangadex': return 'red';
    default: return 'gray';
  }
}

/**
 * Field alias mappings: target field → list of source field names to check (in priority order).
 * Used by normalizeProviderResult to unify varying field names across providers.
 */
const FIELD_ALIASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['coverUrl', ['coverImage', 'cover', 'imageUrl']],
  ['score', ['averageScore', 'meanScore']],
  ['alternativeTitles', ['synonyms', 'altTitles']],
  ['externalLinks', ['providerUrl', 'siteDetailUrl', 'wikiUrl', 'url']],
  ['chapters', ['totalChapters']],
  ['description', ['synopsis', 'summary']],
  ['originalRun', ['published']],
  ['englishPublisher', ['english_publisher']],
] as const;

/** Scalar fields to promote from a nested `metadata` sub-object. */
const NESTED_SCALAR_FIELDS = [
  'publisher', 'englishPublisher', 'format', 'countryOfOrigin', 'language',
  'bannerImage', 'demographic', 'magazine', 'themes', 'originalRun', 'externalLinks', 'gallery',
] as const;

/**
 * Normalizes a SearchResult object so its field keys match METADATA_FIELDS keys.
 *
 * The SearchResult type uses different names than what METADATA_FIELDS expects
 * (e.g. coverImage vs coverUrl). This function maps them so the FieldSelectionTab
 * can find values for every configured metadata field.
 */
// eslint-disable-next-line complexity -- Field normalizer requires many null-checks across providers
export function normalizeProviderResult(data: Record<string, unknown>): Record<string, unknown> {
  const n = { ...data };

  // Apply alias mappings
  for (const [target, sources] of FIELD_ALIASES) {
    if (n[target] !== undefined && n[target] !== null) continue;
    for (const src of sources) {
      if (n[src] !== undefined && n[src] !== null) {
        n[target] = n[src];
        break;
      }
    }
  }

  // Promote fields from nested metadata sub-object
  const meta = n['metadata'];
  if (meta !== null && meta !== undefined && typeof meta === 'object' && !Array.isArray(meta)) {
    const metaRecord = meta as Record<string, unknown>;
    for (const field of NESTED_SCALAR_FIELDS) {
      if ((n[field] === undefined || n[field] === null) && metaRecord[field] !== undefined && metaRecord[field] !== null) {
        n[field] = metaRecord[field];
      }
    }
    // Promote authors/artists arrays
    for (const arrField of ['authors', 'artists'] as const) {
      const current = n[arrField];
      const nested = metaRecord[arrField];
      if ((!current || (Array.isArray(current) && current.length === 0)) && Array.isArray(nested) && nested.length > 0) {
        n[arrField] = nested;
      }
    }
  }

  // Flatten authors/artists arrays → singular author/artist
  if ((n['author'] === undefined || n['author'] === null) && Array.isArray(n['authors']) && n['authors'].length > 0) {
    n['author'] = n['authors'][0];
  }
  if ((n['artist'] === undefined || n['artist'] === null) && Array.isArray(n['artists']) && n['artists'].length > 0) {
    n['artist'] = n['artists'][0];
  }

  return n;
}

export function formatProviderLabel(provider: string): string {
  return provider === 'current'
    ? 'Current'
    : provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Calculate provider score for a field based on provider strengths
 */
export function calculateProviderScore(
  provider: string,
  fieldKey: string,
  value: unknown
): number {
  let score = 1;

  // Provider-specific field preferences (mirrors DEFAULT_FIELD_PRIORITIES from configuration.types)
  const providerStrengths: Record<string, string[]> = {
    anilist: ['score', 'popularity', 'status', 'format', 'countryOfOrigin', 'bannerImage', 'startDate', 'endDate'],
    mangadex: ['alternativeTitles', 'language', 'demographic', 'genres', 'tags', 'themes', 'chapters', 'volumes',
      'volumeCover', 'chapterCover', 'chapterTitle', 'chapterSummary'],
    comicvine: ['publisher', 'englishPublisher', 'volumes', 'volumeSummary', 'volumeTitle', 'externalLinks'],
    wikipedia: ['description', 'originalRun', 'magazine', 'englishPublisher'],
    fandom: ['chapters', 'tags', 'themes', 'format', 'publisher']
  };

  const strengths = providerStrengths[provider];
  if (strengths?.includes(fieldKey)) {
    score = 3;
  } else if (provider === 'wikipedia' && ['description', 'startDate'].includes(fieldKey)) {
    score = 2;
  } else if (provider === 'fandom' && ['chapters', 'tags'].includes(fieldKey)) {
    score = 2;
  }

  // Prefer longer descriptions
  if (fieldKey === 'description' && typeof value === 'string') {
    score += value.length / 1000;
  }

  // Prefer arrays with more items
  if (Array.isArray(value)) {
    score += value.length / 10;
  }

  return score;
}

/**
 * Default priority ordering for source preference fields.
 * Mirrors DEFAULT_FIELD_PRIORITIES from configuration.types.ts.
 */
const SOURCE_PREFERENCE_PRIORITIES: Record<string, readonly string[]> = {
  volumeCover: ['mangadex', 'comicvine', 'fandom', 'anilist', 'wikipedia'],
  volumeSummary: ['comicvine', 'fandom', 'mangadex', 'wikipedia', 'anilist'],
  volumeTitle: ['comicvine', 'mangadex', 'fandom', 'anilist', 'wikipedia'],
  chapterCover: ['mangadex', 'fandom', 'comicvine', 'anilist', 'wikipedia'],
  chapterSummary: ['mangadex', 'fandom', 'comicvine', 'wikipedia', 'anilist'],
  chapterTitle: ['mangadex', 'fandom', 'comicvine', 'anilist', 'wikipedia'],
};

/** Set of field keys that represent source preferences (provider name as value). */
export const SOURCE_PREFERENCE_KEYS = new Set(Object.keys(SOURCE_PREFERENCE_PRIORITIES));

/** Extract a single URL string from a provider's external links data. */
function extractProviderUrl(data: Record<string, unknown>): string | null {
  const urlValue = data['externalLinks'] ?? data['providerUrl'] ?? data['siteDetailUrl'] ?? data['wikiUrl'] ?? data['url'];

  if (typeof urlValue === 'string' && urlValue.length > 0) return urlValue;

  if (Array.isArray(urlValue) && urlValue.length > 0) {
    const first: unknown = urlValue[0];
    if (typeof first === 'string') return first;
    if (isRecord(first) && typeof first['url'] === 'string') return first['url'];
  }

  return null;
}

/** Collect external links from ALL providers that returned data. */
export function collectAllExternalLinks(
  providerData: Record<string, unknown>
): Array<{ provider: string; url: string }> {
  const links: Array<{ provider: string; url: string }> = [];

  for (const [provider, data] of Object.entries(providerData)) {
    if (provider === 'current' || !isRecord(data)) continue;
    const url = extractProviderUrl(data);
    if (url) links.push({ provider, url });
  }

  return links;
}

/**
 * Find the best provider for a single metadata field across all providers.
 * Bound providers are used directly — their data takes priority over scoring.
 * Only falls back to score-based selection for unbound providers.
 */
function selectBestProviderForField(
  fieldKey: string,
  providerData: Record<string, unknown>,
  providerBindings?: Record<string, string>
): FieldSelection | null {
  // Bound providers take absolute priority — use their data directly
  if (providerBindings) {
    for (const boundProvider of Object.keys(providerBindings)) {
      const data = providerData[boundProvider];
      if (!isRecord(data)) continue;
      const value = data[fieldKey];
      if (value !== null && value !== undefined && value !== '') {
        return { field: fieldKey, provider: boundProvider, value };
      }
    }
  }

  // Fallback: score-based selection for unbound providers
  let bestProvider: string | null = null;
  let bestValue: unknown = null;
  let bestScore = 0;

  for (const [provider, data] of Object.entries(providerData)) {
    if (!isRecord(data)) continue;

    const value = data[fieldKey];
    if (value === null || value === undefined || value === '') continue;

    const score = calculateProviderScore(provider, fieldKey, value);
    if (score > bestScore) {
      bestScore = score;
      bestProvider = provider;
      bestValue = value;
    }
  }

  if (!bestProvider || bestValue === null) return null;
  return { field: fieldKey, provider: bestProvider, value: bestValue };
}

/**
 * Auto-select source preference fields (volume/chapter sources).
 * Prefers bound providers, then falls back to priority ordering.
 */
function selectSourcePreferences(
  availableProviders: Set<string>,
  providerBindings?: Record<string, string>
): Record<string, FieldSelection> {
  const selections: Record<string, FieldSelection> = {};

  const allSourceFields = [...VOLUME_SOURCE_FIELDS, ...CHAPTER_SOURCE_FIELDS];
  for (const field of allSourceFields) {
    // Check bound providers first
    const boundProvider = providerBindings
      ? Object.keys(providerBindings).find((p) => availableProviders.has(p))
      : undefined;

    if (boundProvider) {
      selections[field.key] = { field: field.key, provider: boundProvider, value: boundProvider };
      continue;
    }

    const priorities = SOURCE_PREFERENCE_PRIORITIES[field.key];
    if (!priorities) continue;

    const bestProvider = priorities.find((p) => availableProviders.has(p));
    if (bestProvider) {
      selections[field.key] = { field: field.key, provider: bestProvider, value: bestProvider };
    }
  }

  return selections;
}

/**
 * Auto-select best values from provider data.
 *
 * When `providerBindings` is supplied, bound providers are used directly —
 * their data takes absolute priority over score-based selection.
 */
export function autoSelectBestValues(
  providerData: Record<string, unknown>,
  providerBindings?: Record<string, string>
): Record<string, FieldSelection> {
  const selections: Record<string, FieldSelection> = {};

  // Auto-select manga-level metadata fields based on provider scores
  for (const field of METADATA_FIELDS) {
    const best = selectBestProviderForField(field.key, providerData, providerBindings);
    if (best) {
      selections[field.key] = best;
    }
  }

  // Auto-aggregate external links from all providers
  const allLinks = collectAllExternalLinks(providerData);
  if (allLinks.length > 0) {
    selections['externalLinks'] = {
      field: 'externalLinks',
      provider: 'multiple',
      value: allLinks.map((l) => l.url)
    };
  }

  // Source preference fields (volume/chapter sources)
  const availableProviders = new Set(
    Object.keys(providerData).filter((p) => p !== 'current')
  );
  Object.assign(selections, selectSourcePreferences(availableProviders, providerBindings));

  return selections;
}
