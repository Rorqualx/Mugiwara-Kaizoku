/**
 * AniList tag and staff extraction, shared by the legacy result builder and
 * the selector's AniList claim.
 *
 * These lived inside `enrichment-result-builder.ts`, so the selector never saw
 * them: on a MangaUpdates-bound title its tags/authors/artists candidates came
 * from MangaUpdates alone and replaced the AniList values the legacy chain had
 * produced.
 *
 * Pure functions — no DB, no I/O.
 */

import type { AniListMangaDetails } from '@/server/services/anilist/service';

export interface AniListTagSplit {
  tags: string[];
  themes: string[];
}

/**
 * Split AniList tags into tags and themes.
 *
 * AniList tags have a `category` field (at runtime — the narrower
 * AniListMangaDetails type hides it). Anything under a "Theme-*" category
 * (e.g. Theme-Action, Theme-Drama, Theme-Other) is a theme, not a tag.
 */
export function splitAniListTags(details: AniListMangaDetails): AniListTagSplit {
  const themes: string[] = [];
  const tags: string[] = [];
  for (const t of details.tags ?? []) {
    if (!t.name) continue;
    const category = (t as { category?: unknown }).category;
    if (typeof category === 'string' && /^theme/i.test(category)) themes.push(t.name);
    else tags.push(t.name);
  }
  return { tags, themes };
}

export interface AniListStaffCredits {
  authors: string[];
  artists: string[];
  /** Every credit with its role — editors, translators, letterers and so on. */
  staff: Array<{ name: string; role: string }>;
}

const AUTHOR_ROLE = /\b(story|original\s*creator|original\s*story|writer|author)\b/i;
const ARTIST_ROLE = /\b(art|illustrat(?:or|ion)|artist|comic)\b/i;

/**
 * Credits that match the role patterns above without being the series'
 * creators: a licensed edition's letterer ("Touch-up Art & Lettering
 * (English: vol 34)") and a guest credit for one chapter ("Illustration
 * (ch 1145)"). One Piece listed both as artists beside Eiichiro Oda.
 */
const INCIDENTAL_ROLE = /\btouch[-\s]?up\b|\bletter(?:ing|er)\b|\(ch(?:apter)?\.?\s*\d+(?:\.\d+)?\)/i;

/** Authors, artists and the full credit list from AniList staff edges. */
export function extractAniListStaffCredits(details: AniListMangaDetails): AniListStaffCredits {
  const staff: Array<{ name: string; role: string }> = [];
  for (const edge of details.staff?.edges ?? []) {
    const name = edge.node?.name?.full;
    const role = edge.role;
    if (typeof name === 'string' && typeof role === 'string') staff.push({ name, role });
  }
  const creators = staff.filter(s => !INCIDENTAL_ROLE.test(s.role));
  return {
    authors: [...new Set(creators.filter(s => AUTHOR_ROLE.test(s.role)).map(s => s.name))],
    artists: [...new Set(creators.filter(s => ARTIST_ROLE.test(s.role)).map(s => s.name))],
    staff,
  };
}
