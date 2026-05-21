/**
 * Provider Bind Configuration
 *
 * Configuration and helper functions for provider binding modals.
 *
 * @module components/manga/provider-bind-config
 */

/**
 * Provider type union for bind/unbind operations
 */
export type BindableProvider = 'comicvine' | 'fandom' | 'wikipedia' | 'mangadex' | 'mangaupdates' | 'mal' | 'kitsu';

/**
 * Configuration for each provider binding UI
 */
export interface ProviderBindConfig {
  name: string;
  color: string;
  idLabel: string;
  idPlaceholder: string;
  idPattern: RegExp;
  idHelp: string;
}

/**
 * Builds the external URL for a given provider and ID
 */
export function getProviderExternalUrl(provider: string, id: string): string | null {
  if (!id) return null;
  switch (provider) {
    case 'anilist':
      return `https://anilist.co/manga/${id}`;
    case 'comicvine': {
      const cvId = /^\d+-\d+$/.test(id) ? id : `4050-${id}`;
      return `https://comicvine.gamespot.com/volume/${cvId}/`;
    }
    case 'fandom': {
      // Defensively strip "wikiKey:pageId" format to just wiki key
      const wikiKey = id.includes(':') ? id.split(':')[0] : id;
      return wikiKey ? `https://${wikiKey}.fandom.com/` : null;
    }
    case 'wikipedia':
      return `https://en.wikipedia.org/wiki/${encodeURIComponent(id)}`;
    case 'mangadex':
      return `https://mangadex.org/title/${id}`;
    case 'mal':
      return `https://myanimelist.net/manga/${id}`;
    case 'kitsu':
      return `https://kitsu.io/manga/${id}`;
    case 'mangaupdates': {
      // MangaUpdates switched series IDs from the legacy numeric scheme
      // (e.g. "52840794953") to base36 slugs (e.g. "o9w1mbt"). The new
      // /series/{slug} URL 404s for numeric IDs, but the legacy
      // /series.html?id=N format still works and redirects to the slug
      // page. Detect a purely-numeric id and fall back to the legacy
      // path so old providerMetadata entries keep their View link
      // working until the sweep script swaps them.
      const isLegacyNumeric = /^\d+$/.test(id);
      return isLegacyNumeric
        ? `https://www.mangaupdates.com/series.html?id=${id}`
        : `https://www.mangaupdates.com/series/${id}`;
    }
    default:
      return null;
  }
}

/**
 * Provider configuration map
 */
export const providerConfig: Record<BindableProvider, ProviderBindConfig> = {
  comicvine: {
    name: 'ComicVine',
    color: 'green',
    idLabel: 'ComicVine Volume ID',
    idPlaceholder: 'e.g., 4050-12345 or https://comicvine.gamespot.com/...',
    idPattern: /^\d+(-\d+)?$/,
    idHelp: 'Enter the ComicVine volume ID (e.g., 12345 or 4050-12345) or paste a full ComicVine URL'
  },
  fandom: {
    name: 'Fandom',
    color: 'purple',
    idLabel: 'Fandom Wiki URL or Page Name',
    idPlaceholder: 'e.g., fire-force or https://fire-force.fandom.com/wiki/...',
    idPattern: /^[a-zA-Z0-9-_:/.\s]+$/,
    idHelp: 'Enter the Fandom wiki name or paste a full Fandom URL'
  },
  wikipedia: {
    name: 'Wikipedia',
    color: 'orange',
    idLabel: 'Wikipedia Article Name',
    idPlaceholder: 'e.g., Fire_Force or https://en.wikipedia.org/wiki/...',
    idPattern: /^[a-zA-Z0-9-_:\s()]+$/,
    idHelp: 'Enter the Wikipedia article name or paste a full Wikipedia URL'
  },
  mangadex: {
    name: 'MangaDex',
    color: 'red',
    idLabel: 'MangaDex Title ID',
    idPlaceholder: 'e.g., UUID or https://mangadex.org/title/...',
    idPattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    idHelp: 'Enter the MangaDex title UUID or paste a MangaDex URL'
  },
  mangaupdates: {
    name: 'MangaUpdates',
    color: 'cyan',
    idLabel: 'MangaUpdates Series ID',
    idPlaceholder: 'e.g., 12345 or https://www.mangaupdates.com/series/...',
    idPattern: /^[a-zA-Z0-9]+$/,
    idHelp: 'Enter the MangaUpdates series ID or paste a MangaUpdates URL'
  },
  mal: {
    name: 'MyAnimeList',
    color: 'blue',
    idLabel: 'MyAnimeList Manga ID',
    idPlaceholder: 'e.g., 117840 or https://myanimelist.net/manga/...',
    idPattern: /^\d+$/,
    idHelp: 'Enter the MyAnimeList numeric manga ID or paste a MyAnimeList URL'
  },
  kitsu: {
    name: 'Kitsu',
    color: 'grape',
    idLabel: 'Kitsu Manga ID or Slug',
    idPlaceholder: 'e.g., 54297 or https://kitsu.io/manga/sweat-and-soap',
    idPattern: /^[a-zA-Z0-9-]+$/,
    idHelp: 'Enter the Kitsu numeric ID or slug, or paste a Kitsu URL'
  }
};

/**
 * Extract provider ID from a pasted URL
 *
 * @returns The resolved ID and whether it was extracted from a URL
 */
export function extractProviderIdFromUrl(provider: BindableProvider, rawId: string): string {
  let resolvedId = rawId;

  if (provider === 'comicvine' && resolvedId.includes('comicvine.gamespot.com')) {
    const urlMatch = resolvedId.match(/\/(\d+-\d+)\/?/);
    if (urlMatch?.[1]) {
      resolvedId = urlMatch[1];
    }
  } else if (provider === 'fandom' && resolvedId.includes('.fandom.com')) {
    const urlMatch = resolvedId.match(/https?:\/\/([^.]+)\.fandom\.com/);
    if (urlMatch?.[1]) {
      resolvedId = urlMatch[1];
    }
  } else if (provider === 'wikipedia' && resolvedId.includes('wikipedia.org')) {
    const urlMatch = resolvedId.match(/\/wiki\/([^#?]+)/);
    if (urlMatch?.[1]) {
      resolvedId = decodeURIComponent(urlMatch[1]);
    }
  } else if (provider === 'mangadex' && resolvedId.includes('mangadex.org')) {
    const urlMatch = resolvedId.match(/mangadex\.org\/title\/([a-f0-9-]+)/i);
    if (urlMatch?.[1]) {
      resolvedId = urlMatch[1];
    }
  } else if (provider === 'mal' && resolvedId.includes('myanimelist.net')) {
    const urlMatch = resolvedId.match(/myanimelist\.net\/manga\/(\d+)/);
    if (urlMatch?.[1]) {
      resolvedId = urlMatch[1];
    }
  } else if (provider === 'kitsu' && resolvedId.includes('kitsu.io')) {
    const urlMatch = resolvedId.match(/kitsu\.io\/manga\/([a-zA-Z0-9-]+)/);
    if (urlMatch?.[1]) {
      resolvedId = urlMatch[1];
    }
  }

  // MangaDex UUIDs must be lowercase (API rejects uppercase)
  if (provider === 'mangadex') {
    resolvedId = resolvedId.toLowerCase();
  }

  return resolvedId;
}

/**
 * Extract Fandom wiki key from a search result URL or combined ID
 */
function extractFandomWikiKey(resultUrl: unknown, rawId: unknown): unknown {
  if (typeof resultUrl === 'string' && resultUrl.includes('.fandom.com')) {
    const fandomMatch = resultUrl.match(/https?:\/\/([^.]+)\.fandom\.com/);
    if (fandomMatch?.[1]) {
      return fandomMatch[1];
    }
  }
  // Fallback: extract wiki key from "wikiKey:pageId" format
  if (typeof rawId === 'string' && rawId.includes(':')) {
    return rawId.split(':')[0];
  }
  return rawId;
}

/**
 * Extract provider ID from a search result
 */
export function extractIdFromSearchResult(provider: BindableProvider, result: Record<string, unknown>): string {
  let id: unknown = result["id"] || result['url'] || result["title"];

  const resultUrl = result['url'];
  if (provider === 'comicvine' && typeof resultUrl === 'string') {
    const match = resultUrl.match(/\/(\d+-\d+)\//);
    if (match?.[1] !== undefined) {
      id = match[1];
    }
  } else if (provider === 'wikipedia' && typeof resultUrl === 'string') {
    const match = resultUrl.match(/\/wiki\/(.+)$/);
    if (match?.[1] !== undefined) {
      id = decodeURIComponent(match[1]);
    }
  } else if (provider === 'fandom') {
    id = extractFandomWikiKey(resultUrl, id);
  } else if (provider === 'mangadex' && typeof resultUrl === 'string') {
    const match = resultUrl.match(/mangadex\.org\/title\/([a-f0-9-]+)/i);
    if (match?.[1] !== undefined) {
      id = match[1];
    }
  }

  return typeof id === 'string' ? id : String(id);
}
