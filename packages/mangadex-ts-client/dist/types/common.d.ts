/**
 * Common type definitions shared across all providers
 */
/** UUID string type for all IDs */
export type UUID = string;
/** ISO 639-1 language code */
export type LanguageCode = string;
/** Data source identifier */
export type DataSource = 'mangadex' | 'comicvine' | 'anilist';
/** Unified publication status across all providers */
export type PublicationStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'upcoming';
/** Content rating categories */
export type ContentRating = 'safe' | 'suggestive' | 'erotica' | 'pornographic';
/** Publication demographic */
export type PublicationDemographic = 'shounen' | 'shoujo' | 'josei' | 'seinen' | 'none';
/** Manga format (primarily from AniList) */
export type MangaFormat = 'MANGA' | 'MANHWA' | 'MANHUA' | 'NOVEL' | 'LIGHT_NOVEL' | 'ONE_SHOT';
/** Creator roles */
export type CreatorRole = 'AUTHOR' | 'ARTIST' | 'AUTHOR_ARTIST' | 'LETTERER' | 'INKER' | 'COLORIST' | 'EDITOR' | 'COVER_ARTIST' | 'TRANSLATOR' | 'OTHER';
/** Enrichment tier describing how much data was gathered */
export type EnrichmentTier = 'basic' | 'standard' | 'full';
/** Character role in a manga */
export type CharacterRole = 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
/** Relation type between manga */
export type RelationType = 'PREQUEL' | 'SEQUEL' | 'SIDE_STORY' | 'PARENT' | 'SPIN_OFF' | 'ADAPTATION' | 'ALTERNATIVE' | 'CHARACTER' | 'SUMMARY' | 'CONTAINS' | 'OTHER';
/** Tag grouping categories */
export type TagGroup = 'genre' | 'theme' | 'format' | 'content' | 'demographic';
/** Sort order */
export type SortOrder = 'asc' | 'desc';
/** Tag inclusion/exclusion modes */
export type TagMode = 'AND' | 'OR';
//# sourceMappingURL=common.d.ts.map