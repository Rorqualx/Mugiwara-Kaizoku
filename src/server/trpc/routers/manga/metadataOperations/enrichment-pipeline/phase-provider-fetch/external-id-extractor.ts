/**
 * External ID Extraction Helpers
 *
 * Collects provider-specific cross-reference IDs from raw provider responses
 * so they can be persisted to `Metadata.externalLinks` and surfaced in the UI.
 *
 * Used by phase-finalize.ts to build a complete externalLinks JSON blob after
 * all providers have been fetched.
 */

/**
 * MangaDex `attributes.links` can contain any of:
 *   al, mal, mu, nu, ap, kt, amz, ebj, cdj, raw, engtl, bw
 * Values are provider-specific string IDs. Extract all non-empty keys.
 */
export function extractMangaDexLinks(
  links: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!links || typeof links !== 'object') return out;
  for (const [key, value] of Object.entries(links)) {
    if (typeof value === 'string' && value.trim().length > 0) out[key] = value.trim();
  }
  return out;
}

/** Site label used for each MangaDex link key in the externalLinks JSON */
const SITE_LABELS: Record<string, string> = {
  al: 'AniList',
  mal: 'MyAnimeList',
  mu: 'MangaUpdates',
  nu: 'NovelUpdates',
  ap: 'Anime-Planet',
  kt: 'Kitsu',
  amz: 'Amazon',
  ebj: 'eBookJapan',
  cdj: 'CDJapan',
  bw: 'BookWalker',
  raw: 'Raw',
  engtl: 'English Official',
};

/** Convert MangaDex links.X keys + URLs into `{url, site}` entries */
export function buildMangaDexExternalLinks(
  links: Record<string, string>,
): Array<{ url: string; site: string }> {
  const entries: Array<{ url: string; site: string }> = [];
  for (const [key, value] of Object.entries(links)) {
    const site = SITE_LABELS[key] ?? key;
    const url = resolveLinkUrl(key, value);
    if (url) entries.push({ url, site });
  }
  return entries;
}

/** Some MangaDex link values are bare IDs, others full URLs — resolve to absolute URL */
function resolveLinkUrl(key: string, value: string): string | null {
  if (/^https?:\/\//i.test(value)) return value;
  switch (key) {
    case 'al': return `https://anilist.co/manga/${value}`;
    case 'mal': return `https://myanimelist.net/manga/${value}`;
    case 'mu': return /^\d+$/.test(value) ? `https://www.mangaupdates.com/series/${value}` : `https://www.mangaupdates.com/series.html?id=${value}`;
    case 'ap': return `https://www.anime-planet.com/manga/${value}`;
    case 'kt': return `https://kitsu.io/manga/${value}`;
    case 'bw': return `https://bookwalker.jp/${value}`;
    default: return null;
  }
}
