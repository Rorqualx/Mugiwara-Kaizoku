/**
 * Agent Ground Truth Extractor
 *
 * Uses Claude agents to analyze wiki pages and extract ground truth
 * for all entity types visible on the page. This provides more comprehensive
 * ground truth than AniList (which only covers ~10 entity types).
 *
 * @module auto-labeling/agent-ground-truth
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { BIO_LABELS, type EntityType, isEntityType } from '@/server/ml/features/bio-types';
import { createLogger } from '@/utils/logger';

import { normalizeForComparison } from './ground-truth';

import type {
  AgentGroundTruth,
  AgentGroundTruthConfig,
  DiscoveredUrlType,
  ExpectedEntity,
  GroundTruthCacheEntry,
  SampledPage,
} from './types';

const logger = createLogger('auto-labeling:agent-ground-truth');

// ============================================================================
// Constants
// ============================================================================

/**
 * All entity types we want to extract from wiki pages.
 * These are all the BIO labels the system can recognize.
 */
export const ALL_ENTITY_TYPES: EntityType[] = Object.values(BIO_LABELS) as EntityType[];

/**
 * Default configuration for agent ground truth extraction.
 */
export const DEFAULT_AGENT_CONFIG: AgentGroundTruthConfig = {
  concurrency: 3,
  timeoutMs: 60000,
  model: 'sonnet',
  useCache: true,
  cacheDir: 'data/auto-labeling/ground-truth-cache',
  maxHtmlSize: 50000,
};

/**
 * Cache version for invalidation.
 * Increment when prompt or parsing logic changes.
 */
const CACHE_VERSION = 1;

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build a prompt for the agent to extract ground truth from a wiki page.
 *
 * @param page - The sampled page metadata
 * @param html - The HTML content of the page
 * @param config - Configuration options
 * @returns The prompt string for the agent
 */
export function buildGroundTruthPrompt(
  page: SampledPage,
  html: string,
  config: AgentGroundTruthConfig = DEFAULT_AGENT_CONFIG
): string {
  const truncatedHtml = html.substring(0, config.maxHtmlSize);

  return `You are extracting ground truth entities from a wiki page for ML training data.

PAGE INFO:
- Title: ${page.title}
- URL: ${page.url}
- Source: ${page.source}
- Page Type: ${page.urlType}

TASK: Analyze this wiki page and extract ALL visible entities. Be thorough and accurate.

ENTITY TYPES TO EXTRACT:
${ALL_ENTITY_TYPES.map(t => `- ${t}`).join('\n')}

For each entity found, provide:
1. type: The entity type from the list above
2. value: The exact text value as it appears on the page
3. confidence: How confident you are (0.0-1.0)

RULES:
- Only extract entities that are ACTUALLY VISIBLE on the page
- Use exact text as it appears (don't paraphrase or add information)
- For COVER_IMAGE, note "present" if there's a main cover image visible
- For counts (VOLUME_COUNT, CHAPTER_COUNT), extract the number or count if visible
- For PAGE_TYPE, use: ${page.urlType}
- For tables (VOLUME_TABLE, CHAPTER_TABLE), note "present" if such tables exist
- For URLs (VOLUMES_LIST_URL, CHAPTERS_LIST_URL, GALLERY_URL), extract the actual href if visible
- Be conservative - only include entities you're confident about (0.7+)
- If the same entity type appears multiple times (e.g., multiple genres), include each one

EXAMPLES:
- TITLE: The main title of the manga (not subtitles or alternative names)
- ALT_TITLE: Alternative names, Japanese titles, romanized versions
- AUTHOR: The writer/story creator
- ARTIST: The illustrator (if different from author)
- PUBLISHER: The publishing company (e.g., "Shueisha", "Viz Media")
- MAGAZINE: The serialization magazine (e.g., "Weekly Shonen Jump")
- STATUS: The publication status (e.g., "Ongoing", "Completed", "Hiatus")
- GENRE: Each genre listed (e.g., "Action", "Adventure", "Fantasy")
- DEMOGRAPHIC: Target demographic (e.g., "Shonen", "Seinen", "Shoujo")
- VOLUME_TABLE: "present" if there's a table listing volumes
- CHAPTER_TABLE: "present" if there's a table listing chapters

HTML CONTENT (first ${config.maxHtmlSize} chars):
${truncatedHtml}

Respond with ONLY a JSON array of entities, no other text:
[
  {"type": "TITLE", "value": "...", "confidence": 0.95},
  {"type": "AUTHOR", "value": "...", "confidence": 0.9},
  ...
]`;
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse an agent's response into expected entities.
 *
 * @param response - The raw text response from the agent
 * @returns Array of expected entities
 */
export function parseAgentResponse(response: string): ExpectedEntity[] {
  try {
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      logger.warn('No JSON array found in agent response');
      return [];
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      logger.warn('Parsed response is not an array');
      return [];
    }

    const entities: ExpectedEntity[] = [];

    for (const item of parsed) {
      if (!isValidEntityItem(item)) {
        continue;
      }

      const { type, value, confidence } = item;

      // Validate entity type
      if (!isEntityType(type)) {
        logger.warn('Invalid entity type in response', { type });
        continue;
      }

      // Skip low confidence entities
      if (confidence < 0.5) {
        continue;
      }

      entities.push({
        type,
        value: String(value),
        normalizedValue: normalizeForComparison(String(value)),
        required: confidence >= 0.8,
      });
    }

    return entities;
  } catch (error) {
    logger.error('Failed to parse agent response', error as Error);
    return [];
  }
}

/**
 * Validated entity item from agent response.
 */
interface ValidatedEntityItem {
  type: string;
  value: string | number;
  confidence: number;
}

/**
 * Type guard for entity items in agent response.
 */
function isValidEntityItem(item: unknown): item is ValidatedEntityItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj['type'] === 'string' &&
    (typeof obj['value'] === 'string' || typeof obj['value'] === 'number') &&
    typeof obj['confidence'] === 'number'
  );
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Get the cache file path for a URL.
 */
function getCacheFilePath(url: string, config: AgentGroundTruthConfig): string {
  // Create a safe filename from the URL
  const urlHash = Buffer.from(url).toString('base64').replace(/[/+=]/g, '_').substring(0, 50);
  return join(config.cacheDir, `${urlHash}.json`);
}

/**
 * Load cached ground truth if available.
 *
 * @param url - The page URL
 * @param config - Configuration options
 * @returns Cached ground truth or null if not found/expired
 */
export function loadCachedGroundTruth(
  url: string,
  config: AgentGroundTruthConfig = DEFAULT_AGENT_CONFIG
): AgentGroundTruth | null {
  if (!config.useCache) return null;

  try {
    const filePath = getCacheFilePath(url, config);
    if (!existsSync(filePath)) return null;

    const content = readFileSync(filePath, 'utf-8');
    const entry = JSON.parse(content) as GroundTruthCacheEntry;

    // Check version for invalidation
    if (entry.version !== CACHE_VERSION) {
      logger.debug('Cache entry outdated', { url, version: entry.version });
      return null;
    }

    // Restore Date objects
    return {
      ...entry.groundTruth,
      extractedAt: new Date(entry.groundTruth.extractedAt),
    };
  } catch (error) {
    logger.warn('Failed to load cached ground truth', { url, error });
    return null;
  }
}

/**
 * Save ground truth to cache.
 *
 * @param groundTruth - The ground truth to cache
 * @param config - Configuration options
 */
export function saveGroundTruthToCache(
  groundTruth: AgentGroundTruth,
  config: AgentGroundTruthConfig = DEFAULT_AGENT_CONFIG
): void {
  if (!config.useCache) return;

  try {
    // Ensure cache directory exists
    if (!existsSync(config.cacheDir)) {
      mkdirSync(config.cacheDir, { recursive: true });
    }

    const entry: GroundTruthCacheEntry = {
      url: groundTruth.pageUrl,
      groundTruth,
      cachedAt: new Date(),
      version: CACHE_VERSION,
    };

    const filePath = getCacheFilePath(groundTruth.pageUrl, config);
    writeFileSync(filePath, JSON.stringify(entry, null, 2));
    logger.debug('Saved ground truth to cache', { url: groundTruth.pageUrl });
  } catch (error) {
    logger.warn('Failed to save ground truth to cache', { url: groundTruth.pageUrl, error });
  }
}

// ============================================================================
// Ground Truth Creation
// ============================================================================

/**
 * Create an AgentGroundTruth object from parsed entities.
 *
 * @param page - The sampled page
 * @param entities - The parsed entities
 * @param model - The model used for extraction
 * @param rawResponse - Optional raw agent response
 * @returns The AgentGroundTruth object
 */
export function createAgentGroundTruth(
  page: SampledPage,
  entities: ExpectedEntity[],
  model: string,
  rawResponse?: string
): AgentGroundTruth {
  // Calculate overall confidence as average of entity confidences
  const totalConfidence = entities.reduce((sum, e) => sum + (e.required ? 0.9 : 0.7), 0);
  const avgConfidence = entities.length > 0 ? totalConfidence / entities.length : 0;

  return {
    pageUrl: page.url,
    pageType: page.urlType,
    source: page.source,
    entities,
    extractedAt: new Date(),
    agentModel: model,
    confidence: avgConfidence,
    ...(rawResponse !== undefined && { rawResponse }),
  };
}

// ============================================================================
// Entity Type Helpers
// ============================================================================

/**
 * Get entity types relevant for a specific page type.
 * Different page types have different expected entity coverage.
 */
export function getRelevantEntityTypes(pageType: DiscoveredUrlType): EntityType[] {
  switch (pageType) {
    case 'MANGA_PAGE':
      return [
        'TITLE',
        'ALT_TITLE',
        'AUTHOR',
        'ARTIST',
        'STATUS',
        'GENRE',
        'DEMOGRAPHIC',
        'PUBLISHER',
        'MAGAZINE',
        'RELEASE_DATE',
        'VOLUME_COUNT',
        'CHAPTER_COUNT',
        'SERIES_SUMMARY',
        'COVER_IMAGE',
        'THEMES',
        'TAGS',
        'FORMAT',
        'VOLUMES_LIST_URL',
        'CHAPTERS_LIST_URL',
        'GALLERY_URL',
        'PAGE_TYPE',
      ];
    case 'VOLUMES':
      return [
        'TITLE',
        'VOLUME_COUNT',
        'VOLUME_TABLE',
        'VOLUME_TITLE',
        'VOLUME_COVER',
        'VOLUME_SUMMARY',
        'VOLUME_RELEASE_DATE',
        'PAGE_TYPE',
      ];
    case 'CHAPTERS':
      return [
        'TITLE',
        'CHAPTER_COUNT',
        'CHAPTER_TABLE',
        'CHAPTER_TITLE',
        'CHAPTER_COVER',
        'CHAPTER_SUMMARY',
        'CHAPTER_RELEASE_DATE',
        'PAGE_TYPE',
      ];
    case 'CHAPTERS_VOLUMES':
      return [
        'TITLE',
        'VOLUME_COUNT',
        'CHAPTER_COUNT',
        'VOLUME_TABLE',
        'CHAPTER_TABLE',
        'VOLUME_TITLE',
        'CHAPTER_TITLE',
        'PAGE_TYPE',
      ];
    case 'GALLERY_SECTION':
      return ['TITLE', 'GALLERY_SECTION', 'COVER_IMAGE', 'PAGE_TYPE'];
    case 'ARCS':
      return ['TITLE', 'PAGE_TYPE'];
    default:
      return ['TITLE', 'PAGE_TYPE'];
  }
}

/**
 * Check if an entity type is high-priority for evaluation.
 * These types are critical for the overall quality of metadata extraction.
 */
export function isHighPriorityEntityType(entityType: EntityType): boolean {
  const highPriority: EntityType[] = [
    'TITLE',
    'AUTHOR',
    'STATUS',
    'VOLUME_COUNT',
    'CHAPTER_COUNT',
    'PUBLISHER',
    'VOLUME_TABLE',
    'CHAPTER_TABLE',
  ];
  return highPriority.includes(entityType);
}
