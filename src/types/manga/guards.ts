/**
 * Type Guards for Manga Types
 * 
 * Runtime type checking functions to ensure type safety
 * when working with manga data from various sources.
 */

import type {
  ExternalAnilistManga,
  ExternalSuwayomiManga,
  ExternalMALManga,
  ExternalKitsuManga
} from './external';
import type {
  MangaEntity,
  MangaWithChapters,
  MangaWithMetadata,
  MangaComplete,
  PartialManga
} from './index';


/**
 * Check if value is a valid MangaEntity
 */
export function isMangaEntity(value: unknown): value is MangaEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Record<string, unknown>)['id'] === 'number' &&
    'title' in value &&
    typeof (value as Record<string, unknown>)['title'] === 'string' &&
    'libraryId' in value &&
    typeof (value as Record<string, unknown>)['libraryId'] === 'number' &&
    'source' in value &&
    typeof (value as Record<string, unknown>)['source'] === 'string'
  );
}

/**
 * Check if value is a MangaEntity with chapters
 */
export function isMangaWithChapters(value: unknown): value is MangaWithChapters {
  return (
    isMangaEntity(value) &&
    'chapters' in value &&
    Array.isArray((value as Record<string, unknown>)['chapters'])
  );
}

/**
 * Check if value is a MangaEntity with metadata
 */
export function isMangaWithMetadata(value: unknown): value is MangaWithMetadata {
  return (
    isMangaEntity(value) &&
    'metadata' in value &&
    (value as Record<string, unknown>)['metadata'] !== undefined
  );
}

/**
 * Check if value is a complete MangaEntity with all relations
 */
export function isMangaComplete(value: unknown): value is MangaComplete {
  return (
    isMangaEntity(value) &&
    'chapters' in value &&
    Array.isArray((value as Record<string, unknown>)['chapters']) &&
    'metadata' in value &&
    'library' in value &&
    'tasks' in value &&
    Array.isArray((value as Record<string, unknown>)['tasks'])
  );
}

/**
 * Check if value is a partial MangaEntity
 */
export function isPartialManga(value: unknown): value is PartialManga {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const manga = value;
  
  // At least one of the key fields should be present
  return (
    ('id' in manga && typeof manga["id"] === 'number') ||
    ('title' in manga && typeof manga["title"] === 'string') ||
    ('source' in manga && typeof manga["source"] === 'string')
  );
}

/**
 * Check if value is an Anilist manga response
 */
export function isAnilistManga(value: unknown): value is ExternalAnilistManga {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const manga = value;
  
  return (
    'id' in manga &&
    typeof manga['id'] === 'number' &&
    'title' in manga &&
    typeof manga['title'] === 'object' &&
    manga['title'] !== null &&
    'romaji' in manga['title'] &&
    typeof (manga['title'] as Record<string, unknown>)['romaji'] === 'string'
  );
}

/**
 * Check if value is a Suwayomi manga response
 */
export function isSuwayomiManga(value: unknown): value is ExternalSuwayomiManga {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const manga = value;
  
  return (
    'id' in manga &&
    typeof manga['id'] === 'string' &&
    'sourceId' in manga &&
    typeof manga['sourceId'] === 'string' &&
    'title' in manga &&
    typeof manga['title'] === 'string' &&
    'url' in manga &&
    typeof manga['url'] === 'string'
  );
}

/**
 * Check if value is a MyAnimeList manga response
 */
export function isMALManga(value: unknown): value is ExternalMALManga {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const manga = value;
  
  return (
    'id' in manga &&
    typeof manga['id'] === 'number' &&
    'title' in manga &&
    typeof manga['title'] === 'string' &&
    ('main_picture' in manga || 'synopsis' in manga || 'mean' in manga)
  );
}

/**
 * Check if value is a Kitsu manga response
 */
export function isKitsuManga(value: unknown): value is ExternalKitsuManga {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const manga = value;
  
  return (
    'id' in manga &&
    typeof manga['id'] === 'string' &&
    'type' in manga &&
    manga['type'] === 'manga' &&
    'attributes' in manga &&
    typeof manga['attributes'] === 'object'
  );
}

/**
 * Check if value has manga-like properties (loose check)
 */
export function hasMangaProperties(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const obj = value;
  
  // Check for common manga properties
  return (
    ('title' in obj && typeof obj['title'] === 'string') ||
    ('name' in obj && typeof obj['name'] === 'string')
  ) && (
    ('chapters' in obj) ||
    ('chapter' in obj) ||
    ('volumes' in obj) ||
    ('status' in obj) ||
    ('author' in obj) ||
    ('artist' in obj) ||
    ('genre' in obj) ||
    ('genres' in obj)
  );
}

/**
 * Determine the external API type of a manga object
 */
export function detectExternalMangaType(value: unknown):
  'anilist' | 'suwayomi' | 'mal' | 'kitsu' | 'unknown' {

  if (isAnilistManga(value)) return 'anilist';
  if (isSuwayomiManga(value)) return 'suwayomi';
  if (isMALManga(value)) return 'mal';
  if (isKitsuManga(value)) return 'kitsu';

  return 'unknown';
}

/**
 * Safely extract ID from various manga types
 */
export function extractMangaId(value: unknown): string | number | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  
  const obj = value;
  
  // Try common ID fields
  if ('id' in obj) {
    const id = obj['id'];
    if (typeof id === 'string' || typeof id === 'number') {
      return id;
    }
  }

  if ('mangaId' in obj) {
    const mangaId = obj['mangaId'];
    if (typeof mangaId === 'string' || typeof mangaId === 'number') {
      return mangaId;
    }
  }

  if ('sourceId' in obj) {
    const sourceId = obj['sourceId'];
    if (typeof sourceId === 'string' || typeof sourceId === 'number') {
      return sourceId;
    }
  }

  return null;
}

/**
 * Safely extract title from various manga types
 */
export function extractMangaTitle(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  
  const obj = value;
  
  // Direct title field
  if ('title' in obj) {
    const title = obj['title'];
    if (typeof title === 'string') {
      return title;
    }
    // Anilist style
    if (typeof title === 'object' && title !== null) {
      const titleObj = title as Record<string, unknown>;
      const english = titleObj['english'];
      const romaji = titleObj['romaji'];
      const native = titleObj['native'];
      if (typeof english === 'string') return english;
      if (typeof romaji === 'string') return romaji;
      if (typeof native === 'string') return native;
    }
  }

  // Display title override
  if ('displayTitle' in obj) {
    const displayTitle = obj['displayTitle'];
    if (typeof displayTitle === 'string') {
      return displayTitle;
    }
  }

  // Alternative field names
  if ('name' in obj) {
    const name = obj['name'];
    if (typeof name === 'string') {
      return name;
    }
  }

  if ('mangaTitle' in obj) {
    const mangaTitle = obj['mangaTitle'];
    if (typeof mangaTitle === 'string') {
      return mangaTitle;
    }
  }

  return null;
}