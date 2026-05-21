/**
 * Shared metadata provider definitions.
 * Single source of truth for all provider-related UI components.
 */

export interface MetadataProviderDef {
  id: string;
  name: string;
}

/** All available metadata providers in display order */
export const METADATA_PROVIDERS: MetadataProviderDef[] = [
  { id: 'anilist', name: 'AniList' },
  { id: 'mangadex', name: 'MangaDex' },
  { id: 'comicvine', name: 'ComicVine' },
  { id: 'mal', name: 'MyAnimeList' },
  { id: 'mangaupdates', name: 'MangaUpdates' },
  { id: 'kitsu', name: 'Kitsu' },
  { id: 'fandom', name: 'Fandom' },
  { id: 'wikipedia', name: 'Wikipedia' },
];
