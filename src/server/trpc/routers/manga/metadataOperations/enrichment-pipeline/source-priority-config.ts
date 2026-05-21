/**
 * Source Priority Configuration
 *
 * Defines per-field source priority for the enrichment pipeline merge.
 * Different sources have different strengths per field type:
 * - AniList: series metadata (genres, authors, status, score)
 * - Fandom: chapter titles, covers, summaries, page counts
 * - Wikipedia: chapter-to-volume mapping, chapter release dates
 * - ComicVine: volume covers, titles, summaries, release dates
 *
 * Each field maps to an ordered list of sources (highest priority first).
 * The merge picks the first source that has non-empty data for each field.
 */


/** Source identifiers used in the priority config */
export type SourceName = 'comicvine' | 'fandom' | 'wikipedia';

/** Chapter-level fields that support per-field priority */
export type ChapterField = 'title' | 'cover' | 'description' | 'pages' | 'releaseDate' | 'volume';

/** Volume-level fields that support per-field priority */
export type VolumeField = 'coverImage' | 'title' | 'description' | 'releaseDate' | 'releaseDateEn';

/** Per-field source priority: ordered list of sources (highest priority first) */
export const CHAPTER_FIELD_PRIORITY: Record<ChapterField, SourceName[]> = {
  title:       ['fandom', 'wikipedia', 'comicvine'],
  cover:       ['fandom', 'comicvine', 'wikipedia'],
  description: ['fandom', 'wikipedia', 'comicvine'],
  pages:       ['fandom', 'wikipedia'],
  releaseDate: ['wikipedia', 'fandom'],
  volume:      ['wikipedia', 'fandom', 'comicvine'],
} as const;

export const VOLUME_FIELD_PRIORITY: Record<VolumeField, SourceName[]> = {
  coverImage:    ['comicvine', 'fandom', 'wikipedia'],
  title:         ['comicvine', 'fandom', 'wikipedia'],
  description:   ['comicvine', 'fandom', 'wikipedia'],
  releaseDate:   ['comicvine', 'fandom', 'wikipedia'],
  releaseDateEn: ['fandom', 'wikipedia'],
} as const;

