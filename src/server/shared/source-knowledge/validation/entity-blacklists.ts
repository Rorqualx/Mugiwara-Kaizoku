/**
 * Entity Blacklists
 *
 * Content blacklists for filtering noise from entity extraction.
 * Used by both ML bootstrap-labeler and app parser bridge.
 *
 * @module shared/source-knowledge/validation/entity-blacklists
 */

import type { EntityType } from '@/server/ml/features/dom-linearizer';

/**
 * Universal blacklist - values that should never be extracted as any entity.
 */
export const UNIVERSAL_BLACKLIST = new Set([
  // Wiki navigation terms
  'categories', 'category', 'media', 'wiki', 'fandom',
  'edit', 'view', 'history', 'talk', 'source', 'help',
  'community', 'explore', 'main page', 'random', 'search',
  'navigation', 'menu', 'sidebar', 'contents', 'content',
  // Section headers
  'characters', 'character', 'volumes', 'chapters', 'plot',
  'story', 'synopsis', 'reception', 'references', 'external links',
  'see also', 'notes', 'gallery', 'trivia', 'behind the scenes',
  // Placeholder text
  'month dd, yyyy', 'n/a', 'unknown', 'tba', 'tbd',
  'coming soon', 'not available', 'none',
  // Language/region
  'english', 'japanese', 'chinese', 'korean',
  // Wiki footer text
  'community content is available under cc-by-sa unless otherwise noted',
]);

/**
 * Type-specific blacklists for entities that need extra filtering.
 */
export const TYPE_SPECIFIC_BLACKLISTS: Partial<Record<EntityType, Set<string>>> = {
  TAGS: new Set([
    // Wiki navigation
    'categories', 'media', 'category', 'wiki', 'fandom',
    'content', 'article', 'page', 'add category',
    // ComicVine forum sections (commonly misextracted as tags)
    'gen. discussion', 'gen discussion', 'general discussion',
    'bug reporting', 'bug report', 'bugs',
    'delete/combine pages', 'delete pages', 'combine pages',
    'artist show-off', 'artist showoff', 'artist show off',
    'off-topic', 'off topic', 'offtopic',
    'contests', 'contest',
    'battles', 'battle', 'vs',
    'fan-fic', 'fanfic', 'fan fic', 'fan fiction',
    'rpg', 'role playing', 'roleplay',
    'quests', 'quest',
    'api', 'developers', 'developer',
    'podcast', 'podcasts',
    // ComicVine metadata labels
    'cover date', 'in cover date', 'store date',
    'issues', 'issue', 'volumes', 'volume',
  ]),
  VOLUME_TITLE: new Set([
    'volume 1', 'volume 2', 'volume 3', 'volume 4', 'volume 5',
    'vol. 1', 'vol. 2', 'vol. 3', 'vol. 4', 'vol. 5',
    'volumes', 'volume list', 'list of volumes',
  ]),
  SERIES_SUMMARY: new Set([
    'community content is available under cc-by-sa unless otherwise noted',
    'this article is a stub',
    'you can help by expanding it',
    'please help improve this article',
  ]),
  RELEASE_DATE: new Set([
    // Placeholder formats
    'month dd, yyyy', 'mm/dd/yyyy', 'dd/mm/yyyy', 'yyyy/mm/dd',
    'yyyy-mm-dd', 'dd-mm-yyyy', 'mm-dd-yyyy',
    'date', 'release date', 'publication date',
    // Unavailable
    'tba', 'tbd', 'n/a', 'unknown', 'coming soon',
    // Citation noise
    'retrieved', 'accessed', 'archived',
  ]),
  PUBLISHER: new Set([
    'publisher', 'label', 'imprint', 'company', 'corporation',
    'inc', 'llc', 'ltd', 'publishing', 'publications',
    'original publisher', 'english publisher', 'jp publisher',
  ]),
  AUTHOR: new Set([
    'author', 'writer', 'creator', 'created by', 'written by',
    'story by', 'original creator', 'original author',
    'script', 'scenario', 'mangaka', 'story',
  ]),
  ARTIST: new Set([
    'artist', 'illustrator', 'art by', 'illustrated by',
    'character designer', 'art', 'illustration', 'artwork',
    'pencils', 'inks', 'drawn by',
  ]),
  MAGAZINE: new Set([
    'magazine', 'serialization', 'publication', 'journal',
    'weekly', 'monthly', 'biweekly', 'serialized in', 'serialised in',
    'run', 'published in',
  ]),
  GENRE: new Set([
    'genre', 'genres', 'category', 'categories', 'type',
    'classification', 'demographic', 'themes', 'theme',
    'target audience', 'audience',
  ]),
  FORMAT: new Set([
    'format', 'type', 'media type', 'media',
  ]),
};
