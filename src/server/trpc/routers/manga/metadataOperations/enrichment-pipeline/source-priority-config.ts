/**
 * Source Priority Configuration
 *
 * Defines per-field source priority for the enrichment pipeline merge.
 *
 * Phase 0: ordered-list priority per field (highest priority first).
 *   Selector reads the list in order; first source with a non-null value wins.
 *   Used as a tiebreaker when multiple providers contribute.
 * Phase 1.5: will add per-(field × source) authority weights for the
 *   cross-source consensus selector; ordered lists collapse to flat weights.
 *
 * Cross-source consensus (Phase 1.5) is the decision rule for comparable
 * fields. Priority here is the tiebreaker, not the primary signal.
 */


/** Source identifiers used in the priority config. All 8 currently-wired providers. */
export type SourceName =
  | 'anilist' | 'mangadex' | 'mal' | 'kitsu' | 'mangaupdates'
  | 'comicvine' | 'fandom' | 'wikipedia';

/** Chapter-level fields that support per-field priority */
export type ChapterField = 'title' | 'cover' | 'description' | 'pages' | 'releaseDate' | 'volume';

/** Volume-level fields that support per-field priority */
export type VolumeField = 'coverImage' | 'title' | 'description' | 'releaseDate' | 'releaseDateEn';

/**
 * Metadata-level fields that support per-field priority.
 *
 * Mirrors the live `Metadata` model columns the enrichment pipeline writes to.
 * Excludes system fields (id, createdAt, updatedAt, lastFetch).
 *
 * Phase 1 additions: `contentRating`, `publicationDemographic`, `publishers`
 * (replaces dropped `publisher`); `rating` widened to JSON (still listed as
 * a single MetadataField — JSON-shape merge is the selector's concern).
 * Phase 1 removals: `characters` (out of app scope) — dropped from the union.
 */
export type MetadataField =
  // strings
  | 'summary' | 'cover' | 'coverExtraLarge' | 'coverLarge' | 'coverMedium' | 'coverSmall'
  | 'bannerImage' | 'format' | 'countryOfOrigin' | 'status'
  | 'contentRating' | 'publicationDemographic'
  // numeric
  | 'chapters' | 'volumes' | 'averageScore' | 'popularity' | 'idMal' | 'rating'
  // lists
  | 'genres' | 'authors' | 'artists' | 'tags' | 'themes' | 'synonyms' | 'urls' | 'publishers'
  // dates / structured
  | 'startDate' | 'endDate' | 'externalLinks' | 'galleryImages'
  // identity
  | 'source' | 'sourceId';

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

/**
 * Metadata-level field priority across all 8 providers.
 *
 * Ordering rationale per field group:
 *
 * - **Numeric counts (chapters/volumes)** — AL/MAL anchor (matches existing
 *   `applyProvenanceGuards` semantics in metadata-persister.ts). MD aggregate
 *   often catches stale AL scalars; MU/Kitsu round out.
 * - **Rankings/scores (averageScore/popularity/rating)** — AL primary, MAL/MU
 *   for second opinions.
 * - **Strings (summary/cover/banner/format/etc.)** — AL primary; MD long-
 *   description override is already in `enrichment-result-builder.ts` (<80-char
 *   threshold). Documenting precedence explicitly here makes it grep-able.
 * - **Lists (genres/tags/themes/characters/etc.)** — AL/MAL/Kitsu dominate
 *   taxonomies; MU contributes votes; Fandom/CV fill characters where the
 *   primary sources are sparse. Phase 1 plugs Fandom + CV characters.
 * - **Publisher** — MU primary (multi-publisher data is the actual shape;
 *   AL `staff[]` has publisher entries; Kitsu's `serialization`-as-publisher
 *   is wrong and deprecated in Phase 1).
 * - **Identity (source/sourceId)** — written from the matcher; AL/MD/MAL only.
 *
 * NOT every field lists all 8 providers — only those that actually emit the
 * field today (or will after Phase 1).
 */
export const METADATA_FIELD_PRIORITY: Record<MetadataField, SourceName[]> = {
  // numeric: anilist/mal anchored
  chapters:        ['anilist', 'mal', 'mangadex', 'mangaupdates', 'kitsu', 'fandom', 'wikipedia', 'comicvine'],
  volumes:         ['anilist', 'mal', 'mangaupdates', 'kitsu', 'mangadex', 'wikipedia', 'comicvine', 'fandom'],
  averageScore:    ['anilist', 'mal', 'mangaupdates', 'kitsu'],
  popularity:      ['anilist', 'mal', 'mangaupdates'],
  idMal:           ['anilist', 'mal'],
  rating:          ['anilist', 'mal', 'kitsu', 'mangaupdates'],

  // strings: AL first, with MD long-description override applied for `summary` (see enrichment-result-builder.ts)
  summary:                ['anilist', 'mangadex', 'mal', 'mangaupdates', 'kitsu', 'comicvine', 'fandom', 'wikipedia'],
  cover:                  ['anilist', 'mangadex', 'kitsu', 'mal', 'mangaupdates', 'fandom', 'comicvine'],
  coverExtraLarge:        ['anilist', 'mangadex', 'kitsu'],
  coverLarge:             ['anilist', 'mangadex', 'kitsu'],
  coverMedium:            ['anilist', 'mangadex', 'kitsu'],
  coverSmall:             ['anilist', 'kitsu'],
  bannerImage:            ['anilist'],
  format:                 ['anilist', 'mangadex', 'mal', 'kitsu'],
  countryOfOrigin:        ['anilist'],
  status:                 ['anilist', 'mangadex', 'mal', 'mangaupdates', 'kitsu'],
  // Phase 1: MangaDex is the only structured source for these.
  contentRating:          ['mangadex'],
  publicationDemographic: ['mangadex', 'mal'],

  // lists
  genres:          ['anilist', 'mal', 'kitsu', 'mangaupdates', 'mangadex', 'fandom', 'comicvine'],
  authors:         ['anilist', 'mangaupdates', 'mal', 'kitsu', 'mangadex'],
  artists:         ['anilist', 'mangaupdates', 'mal', 'kitsu', 'mangadex'],
  tags:            ['anilist', 'mangaupdates', 'mangadex', 'mal'],
  themes:          ['mangadex', 'anilist', 'mal'],
  synonyms:        ['anilist', 'mangadex', 'mangaupdates', 'mal', 'kitsu'],
  urls:            ['anilist', 'mangadex', 'mal', 'mangaupdates', 'kitsu', 'fandom', 'wikipedia', 'comicvine'],
  // Phase 1: publishers[] replaces the dropped `publisher` string. MU's
  // multi-publisher shape is the canonical source.
  publishers:      ['mangaupdates', 'anilist', 'mangadex', 'kitsu'],

  // dates / structured
  startDate:       ['anilist', 'mal', 'mangadex', 'mangaupdates', 'kitsu'],
  endDate:         ['anilist', 'mal', 'mangadex', 'mangaupdates', 'kitsu'],
  externalLinks:   ['anilist', 'mangadex', 'mal', 'mangaupdates', 'kitsu', 'fandom', 'wikipedia', 'comicvine'],
  galleryImages:   ['comicvine', 'fandom', 'mangadex'],

  // identity
  source:          ['anilist', 'mangadex', 'mal'],
  sourceId:        ['anilist', 'mangadex', 'mal'],
} as const;
