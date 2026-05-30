/**
 * Enrichment Result Builder
 *
 * Builds the EnrichmentResult from direct provider data (AniList, MangaDex,
 * ComicVine, MangaUpdates). Constructs the metadata record and enrichedData
 * shape consumed by downstream DB persistence and agent phases.
 */

import type { AniListMangaDetails } from '@/server/services/anilist/service';
import type { ComicVineIssue, ComicVineVolume } from '@/server/services/comicvine/service';
import type { EnrichmentResult } from '@/types/domain/enrichment-result-types';
import { parseChaptersFromDescription } from '@/utils/comicvine-chapter-parser';
import { mapToMangaStatus } from '@/utils/status-mapper';

import { mapComicVineIssuesToVolumes } from './comicvine-volume-mapper';
import { buildMALMetadataSupplements, type MALDirectResult } from './mal-fetch';
import { buildMangaUpdatesMetadataSupplements, type MangaUpdatesDirectResult } from './mangaupdates-fetch';

import type { KitsuDirectResult } from './kitsu-fetch';
import type { ChapterDataItem } from '../types';

// ============================================================================
// Types (re-used from parent module)
// ============================================================================

interface AniListDirectResult {
  id: number;
  details: AniListMangaDetails;
}

interface MangaDexDirectResult {
  mangaId: string;
  status: string;
  lastVolume: string | undefined;
  lastChapter: string | undefined;
  /** All non-empty entries from MangaDex attributes.links (plumbed through for externalLinks persistence) */
  externalIds?: Record<string, string>;
  chapterList?: ChapterDataItem[];
  /** Manga-level description (MangaDex attributes.description, best-localized). Matches the phase-provider-fetch version's `string | undefined`. */
  description: string | undefined;
  /** Phase 1: surfaced for persistence to Metadata.contentRating. */
  contentRating?: string | undefined;
  /** Phase 1: surfaced for persistence to Metadata.publicationDemographic. */
  publicationDemographic?: string | undefined;
}

interface ComicVineDirectResult {
  volumeId: number;
  publisherName: string | undefined;
  issues: ComicVineIssue[];
  seriesVolume: ComicVineVolume;
}

// ============================================================================
// Main Builder
// ============================================================================

export interface BuildEnrichmentParams {
  mangaId: number;
  title: string;
  anilist: AniListDirectResult | null;
  mangadex: MangaDexDirectResult | null;
  comicvine: ComicVineDirectResult | null;
  mangaupdates: MangaUpdatesDirectResult | null;
  mal: MALDirectResult | null;
  kitsu: KitsuDirectResult | null;
}

/**
 * Build an EnrichmentResult compatible with downstream consumers.
 * MangaUpdates supplements AniList metadata (publisher, genres, tags).
 *
 * Phase 0: per-field provenance is tracked alongside `metadata` as each
 * provider's value lands. Returned on `appliedMatch.perFieldProvenance` so
 * `phase-db-persistence` can stamp real per-field provenance instead of
 * uniformly stamping every key with the match-level provider.
 */
// eslint-disable-next-line complexity -- complexity 34: bridge between 7 provider results (AniList/MangaDex/ComicVine/MangaUpdates/MAL/Kitsu/Fandom) and the unified EnrichmentResult shape; each branch conditionally appends to sources/ids/metadata. Splitting would scatter the orchestration across multiple files for marginal gain.
export function buildEnrichmentResult(params: BuildEnrichmentParams): EnrichmentResult {
  const { mangaId, title, anilist, mangadex, comicvine, mangaupdates, mal, kitsu } = params;
  const details = anilist?.details;
  const perFieldProvenance: Record<string, string> = {};
  const metadata = buildMetadataFromAniList(title, details, perFieldProvenance);

  // Iter-27: prefer MangaDex description when AniList has none OR a filler-short
  // one. Threshold matches the audit tier boundary (80 chars = C_GENERIC line),
  // and we require MangaDex to carry real content (>=80 chars) before swapping —
  // avoids replacing a "40-char but accurate" AL line with a shorter MD one.
  const existingDesc = metadata['description'];
  const alLen = typeof existingDesc === 'string' ? existingDesc.trim().length : 0;
  const mdLen = mangadex?.description ? mangadex.description.trim().length : 0;
  if (alLen < 80 && mdLen >= 80 && mangadex?.description) {
    metadata['description'] = mangadex.description;
    perFieldProvenance['description'] = 'mangadex';
  }

  // Phase 1: MangaDex content classification (always when MD matched).
  if (mangadex?.contentRating) {
    metadata['contentRating'] = mangadex.contentRating;
    perFieldProvenance['contentRating'] = 'mangadex';
  }
  if (mangadex?.publicationDemographic) {
    metadata['publicationDemographic'] = mangadex.publicationDemographic;
    perFieldProvenance['publicationDemographic'] = 'mangadex';
  }

  // Phase 1: ComicVine volume.description as final summary fallback for
  // titles where AL + MD both come up empty. Threshold mirrors the MD/Kitsu
  // override semantics — only fill when current description is <80 chars
  // and ComicVine has substantive content.
  const cvDesc = comicvine?.seriesVolume.description;
  const currentDesc = metadata['description'];
  const currentLen = typeof currentDesc === 'string' ? currentDesc.trim().length : 0;
  if (currentLen < 80 && typeof cvDesc === 'string' && cvDesc.trim().length >= 80) {
    metadata['description'] = cvDesc.trim();
    perFieldProvenance['description'] = 'comicvine';
  }

  // Merge MangaUpdates data into metadata (AniList takes priority, MU fills gaps)
  const muSupplements = buildMangaUpdatesMetadataSupplements(metadata, mangaupdates, comicvine?.publisherName);
  assignWithProvenance(metadata, perFieldProvenance, 'mangaupdates', muSupplements);

  // Merge MAL data into metadata (fills chapter/volume/score gaps)
  const malSupplements = buildMALMetadataSupplements(metadata, mal);
  assignWithProvenance(metadata, perFieldProvenance, 'mal', malSupplements);

  // Merge Kitsu supplements (age rating, alt titles, fallback synopsis)
  const kitsuSupplements = buildKitsuMetadataSupplements(metadata, kitsu);
  assignWithProvenance(metadata, perFieldProvenance, 'kitsu', kitsuSupplements);

  const sources = buildSourcesList(mangadex, anilist, comicvine);
  if (mangaupdates) sources.push('mangaupdates');
  if (mal) sources.push('mal');
  if (kitsu) sources.push('kitsu');
  const ids = buildIdsMap(mangadex, anilist, comicvine);
  if (mangaupdates) ids['mangaupdates'] = String(mangaupdates.seriesId);
  if (mal) ids['mal'] = String(mal.malId);
  if (kitsu) ids['kitsu'] = kitsu.kitsuId;

  const enrichedData = {
    manga: {
      chapters: mergeChapterSources(extractComicVineChapters(comicvine), mangadex?.chapterList ?? []),
      volumes: mapComicVineToVolumes(comicvine),
      totalChapters: details?.chapters ?? 0,
      sources,
      ids,
      mangadexMeta: mangadex ? {
        status: mangadex.status,
        lastVolume: mangadex.lastVolume,
        lastChapter: mangadex.lastChapter,
      } : undefined,
      mangadexExternalIds: mangadex?.externalIds ?? undefined,
      anilistExternalLinks: extractAniListExternalLinks(anilist),
      anilistRecommendations: extractAniListRecommendations(anilist),
      // Phase 1: AL relations.edges[] passed through for phase-finalize/manga-relation-resolver.
      anilistRelations: extractAniListRelations(anilist),
    },
  };

  const matchTitle = details
    ? (details.title.english ?? details.title.romaji ?? title)
    : title;

  return {
    status: (anilist ?? mangadex ?? mangaupdates ?? kitsu) ? 'enriched' : 'no_matches',
    manga: { id: mangaId, title },
    appliedMatch: {
      id: `anilist-${anilist?.id ?? 'unknown'}`,
      provider: 'anilist',
      providerId: String(anilist?.id ?? ''),
      title: matchTitle,
      confidence: 0.9,
      metadata,
      perFieldProvenance,
    },
    enrichedData,
  };
}

/**
 * Object.assign + record provenance per key. Each key in `fields` gets stamped
 * with `source` in the provenance map. Keys already in `perFieldProvenance`
 * are overwritten — call order encodes priority (later supplements take
 * precedence over earlier ones, mirroring Object.assign semantics).
 */
function assignWithProvenance(
  target: Record<string, unknown>,
  perFieldProvenance: Record<string, string>,
  source: string,
  fields: Record<string, unknown>,
): void {
  Object.assign(target, fields);
  for (const key of Object.keys(fields)) {
    // eslint-disable-next-line no-param-reassign -- documented: helper records provenance into caller's map by design
    perFieldProvenance[key] = source;
  }
}

// ============================================================================
// AniList Metadata Builders
// ============================================================================

/** Build metadata Record from AniList details for persistence downstream.
 *  Mutates `perFieldProvenance` to stamp every produced key with 'anilist'. */
function buildMetadataFromAniList(
  fallbackTitle: string,
  details: AniListMangaDetails | undefined,
  perFieldProvenance: Record<string, string>,
): Record<string, unknown> {
  if (!details) {
    // eslint-disable-next-line no-param-reassign -- documented: builder writes perFieldProvenance map for caller (parallel to metadata)
    perFieldProvenance['title'] = 'anilist';
    return { title: fallbackTitle };
  }

  const metadata: Record<string, unknown> = {
    ...buildAniListCoreFields(details, fallbackTitle),
    ...extractAniListStaff(details),
    alternativeTitles: [
      details.title.english, details.title.romaji, details.title.native,
      ...(details.synonyms ?? []),
    ].filter((t): t is string => typeof t === 'string'),
    title: {
      english: details.title.english,
      romaji: details.title.romaji,
      native: details.title.native,
    },
  };
  for (const key of Object.keys(metadata)) {
    // eslint-disable-next-line no-param-reassign -- documented: builder writes perFieldProvenance map for caller
    perFieldProvenance[key] = 'anilist';
  }
  return metadata;
}

/** Build core metadata fields from AniList details */
// eslint-disable-next-line complexity -- complexity 34: AniList exposes ~20 optional fields each requiring a presence/type guard before mapping into the unified Metadata shape; flattening conditional spreads into an array still leaves each guard counted toward complexity
function buildAniListCoreFields(
  details: AniListMangaDetails,
  fallbackTitle: string,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    title: details.title.english ?? details.title.romaji ?? fallbackTitle,
  };
  if (details.description) fields['description'] = details.description;
  // Emit full cover variants (extraLarge/large/medium) — metadata-persister's
  // buildCoverVariants reads `metadata.covers.{extraLarge,large,medium,small}`,
  // not `metadata.coverImage`. Fixes coverLarge missing in 20/20 baseline mangas.
  const cv = details.coverImage;
  if (cv && (cv.extraLarge || cv.large || cv.medium)) {
    const covers: Record<string, string> = {};
    if (cv.extraLarge) covers['extraLarge'] = cv.extraLarge;
    if (cv.large) covers['large'] = cv.large;
    if (cv.medium) covers['medium'] = cv.medium;
    fields['covers'] = covers;
    // Keep coverImage for backward compatibility with callers that read the single-URL form
    fields['coverImage'] = cv.extraLarge ?? cv.large ?? cv.medium;
  }
  if (details.bannerImage) fields['bannerImage'] = details.bannerImage;
  if (details.chapters) fields['chapters'] = details.chapters;
  if (details.volumes) fields['volumes'] = details.volumes;
  if (details.idMal) fields['externalIds'] = { malId: details.idMal };
  if (details.genres) fields['genres'] = details.genres;
  if (details.status) fields['status'] = mapToMangaStatus(mapAniListStatus(details.status));
  if (details.averageScore) fields['averageScore'] = details.averageScore;
  if (details.popularity) fields['popularity'] = details.popularity;
  // Phase 1: rating JSON. AL contributes value (averageScore) — scoredBy/rank
  // not in the local AL surface; selector merges with MAL/MU contributions.
  if (details.averageScore) {
    fields['rating'] = {
      value: details.averageScore,
      source: 'anilist' as const,
    };
  }
  if (details.startDate?.year) fields['startDate'] = formatAniListDate(details.startDate);
  if (details.endDate?.year) fields['endDate'] = formatAniListDate(details.endDate);
  if (details.tags) {
    // AniList tags have a `category` field (at runtime — the narrower
    // AniListMangaDetails type hides it). Anything under a "Theme-*" category
    // (e.g. Theme-Action, Theme-Drama, Theme-Other) is a theme, not a tag.
    // This unblocks Metadata.themes which was universally empty in v2 baseline.
    const themes: string[] = [];
    const tags: string[] = [];
    for (const t of details.tags) {
      if (!t.name) continue;
      const name = t.name;
      const tAny = t as { category?: string };
      if (typeof tAny.category === 'string' && /^theme/i.test(tAny.category)) themes.push(name);
      else tags.push(name);
    }
    if (tags.length > 0) fields['tags'] = tags;
    if (themes.length > 0) fields['themes'] = themes;
  }
  // Fields the persister reads but the previous builder never set:
  if (details.format) fields['format'] = details.format;
  if (details.countryOfOrigin) fields['countryOfOrigin'] = details.countryOfOrigin;
  // sourceId + source so Metadata.sourceId can be persisted (ties row back to AniList)
  fields['source'] = 'anilist';
  fields['sourceId'] = String(details.id);
  return fields;
}

/** Extract authors, artists, and all staff credits from AniList staff edges */
function extractAniListStaff(details: AniListMangaDetails): Record<string, unknown> {
  if (!details.staff?.edges) return {};
  const result: Record<string, unknown> = {};
  const authorRole = /\b(story|original\s*creator|original\s*story|writer|author)\b/i;
  const artistRole = /\b(art|illustrat(?:or|ion)|artist|comic)\b/i;
  const authors = details.staff.edges
    .filter(e => typeof e.role === 'string' && authorRole.test(e.role))
    .map(e => e.node?.name?.full)
    .filter((n): n is string => typeof n === 'string');
  if (authors.length > 0) result['authors'] = [...new Set(authors)];

  const artists = details.staff.edges
    .filter(e => typeof e.role === 'string' && artistRole.test(e.role))
    .map(e => e.node?.name?.full)
    .filter((n): n is string => typeof n === 'string');
  if (artists.length > 0) result['artists'] = [...new Set(artists)];

  // Full staff credits by role — fall-through to a JSON blob for the UI.
  // Covers editors, translators, letterers, producers, etc., which don't
  // fit into author/artist buckets but are still worth surfacing.
  const allStaff = details.staff.edges
    .map(e => {
      const name = e.node?.name?.full;
      const role = e.role;
      if (typeof name !== 'string' || typeof role !== 'string') return null;
      return { name, role };
    })
    .filter((s): s is { name: string; role: string } => s !== null);
  if (allStaff.length > 0) result['staff'] = allStaff;
  return result;
}

/** Map AniList status string to Kaizoku status string */
function mapAniListStatus(status: string): string {
  const map: Record<string, string> = {
    FINISHED: 'COMPLETED', RELEASING: 'ONGOING', NOT_YET_RELEASED: 'UPCOMING',
    CANCELLED: 'CANCELLED', HIATUS: 'HIATUS',
  };
  return map[status.toUpperCase()] ?? 'UNKNOWN';
}

/** Format AniList date object to ISO string */
function formatAniListDate(date: { year?: number; month?: number; day?: number }): string {
  const y = date.year ?? 0;
  const m = String(date.month ?? 1).padStart(2, '0');
  const d = String(date.day ?? 1).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================================
// Helpers
// ============================================================================

function mapComicVineToVolumes(
  comicvine: ComicVineDirectResult | null,
): Array<Record<string, unknown>> {
  if (!comicvine) return [];
  return mapComicVineIssuesToVolumes(comicvine.issues);
}

/**
 * Extract AniList externalLinks (al, mal, kt, ap, mu, BookWalker, ComicWalker, etc.)
 * for downstream persistence to Metadata.externalLinks. Already typed on the details.
 */
function extractAniListExternalLinks(
  anilist: AniListDirectResult | null,
): Array<{ url: string; site: string }> | undefined {
  const links = anilist?.details.externalLinks;
  if (!Array.isArray(links) || links.length === 0) return undefined;
  const out = links
    .filter((l): l is { url: string; site: string } =>
      typeof l.url === 'string' && typeof l.site === 'string',
    );
  return out.length > 0 ? out : undefined;
}

/**
 * Extract AniList recommendations (related manga) — capped at 20.
 * AniList types don't expose recommendations, so cast safely.
 */
// eslint-disable-next-line complexity -- complexity 22: defensive type-narrowing across an unknown nested AniList recommendations shape; each ?. guards a different optional field
function extractAniListRecommendations(
  anilist: AniListDirectResult | null,
): Array<{ anilistId: number; title: string; format: string | null; coverUrl: string | null }> | undefined {
  if (!anilist) return undefined;
  const details = anilist.details as unknown as Record<string, unknown>;
  const rec = details['recommendations'] as
    | { edges?: Array<{ node?: { mediaRecommendation?: Record<string, unknown> } }> }
    | undefined;
  const edges = rec?.edges ?? [];
  const out: Array<{ anilistId: number; title: string; format: string | null; coverUrl: string | null }> = [];
  for (const edge of edges.slice(0, 20)) {
    const m = edge.node?.mediaRecommendation;
    if (!m) continue;
    const id = typeof m['id'] === 'number' ? m['id'] : null;
    const titleObj = m['title'] as Record<string, unknown> | undefined;
    const title = typeof titleObj?.['english'] === 'string' ? titleObj['english']
      : typeof titleObj?.['romaji'] === 'string' ? titleObj['romaji']
      : typeof titleObj?.['native'] === 'string' ? titleObj['native']
      : null;
    if (id === null || title === null) continue;
    const cover = m['coverImage'] as Record<string, unknown> | undefined;
    const coverUrl = typeof cover?.['large'] === 'string' ? cover['large']
      : typeof cover?.['medium'] === 'string' ? cover['medium']
      : null;
    out.push({
      anilistId: id,
      title: title as string,
      format: typeof m['format'] === 'string' ? m['format'] as string : null,
      coverUrl,
    });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Phase 1: extract AniList relations.edges[] in the shape the
 * phase-finalize MangaRelation resolver expects. Returns undefined when
 * AniList didn't match or returned no relations.
 */
function extractAniListRelations(
  anilist: AniListDirectResult | null,
): Array<{
  externalToId: string;
  relationType: string;
  targetTitle: string;
  targetMedium: 'MANGA' | 'ANIME' | 'NOVEL' | 'OTHER';
}> | undefined {
  const edges = anilist?.details.relations?.edges;
  if (!Array.isArray(edges) || edges.length === 0) return undefined;
  const out: Array<{ externalToId: string; relationType: string; targetTitle: string; targetMedium: 'MANGA' | 'ANIME' | 'NOVEL' | 'OTHER' }> = [];
  for (const edge of edges) {
    const node = edge.node;
    if (!node || typeof node.id !== 'number') continue;
    const title = node.title?.english ?? node.title?.romaji;
    if (typeof title !== 'string' || title.length === 0) continue;
    const rt = edge.relationType;
    if (typeof rt !== 'string') continue;
    const mediumRaw = node.type;
    const targetMedium: 'MANGA' | 'ANIME' | 'NOVEL' | 'OTHER' =
      mediumRaw === 'MANGA' ? 'MANGA'
      : mediumRaw === 'ANIME' ? 'ANIME'
      : mediumRaw === 'NOVEL' ? 'NOVEL'
      : 'OTHER';
    out.push({
      externalToId: String(node.id),
      relationType: rt,
      targetTitle: title,
      targetMedium,
    });
  }
  return out.length > 0 ? out : undefined;
}

function buildSourcesList(
  md: MangaDexDirectResult | null, al: AniListDirectResult | null, cv: ComicVineDirectResult | null,
): string[] {
  const s: string[] = [];
  if (md) s.push('mangadex');
  if (al) s.push('anilist');
  if (cv) s.push('comicvine');
  return s;
}

function buildIdsMap(
  md: MangaDexDirectResult | null, al: AniListDirectResult | null, cv: ComicVineDirectResult | null,
): Record<string, string> {
  const ids: Record<string, string> = {};
  if (md) ids['mangadex'] = md.mangaId;
  if (al) ids['anilist'] = String(al.id);
  if (cv) ids['comicvine'] = String(cv.volumeId);
  return ids;
}

/**
 * Extract individual chapters with titles and volume assignments from ComicVine
 * issue descriptions. Each issue is a tankobon volume; its description lists
 * chapter titles. We parse those and assign cumulative chapter numbers + volume.
 */
/**
 * Merge ComicVine chapters with MangaDex chapter data.
 * ComicVine wins on conflict for titles; MangaDex fills `pages` gaps.
 */
function mergeChapterSources(
  comicvineChapters: Array<Record<string, unknown>>,
  mangadexChapters: ChapterDataItem[],
): Array<Record<string, unknown>> {
  if (mangadexChapters.length === 0) return comicvineChapters;

  const byNumber = new Map<number, Record<string, unknown>>();
  // Seed with MangaDex (lower priority)
  for (const ch of mangadexChapters) {
    const rec: Record<string, unknown> = { chapterNumber: String(ch.number), source: 'mangadex' };
    if (ch.title) rec['title'] = ch.title;
    if (ch.pages) rec['pages'] = ch.pages;
    if (ch.volume !== undefined) rec['volume'] = String(ch.volume);
    // MangaDex publishAt (captured as ChapterDataItem.releaseDate) is the most
    // reliable per-chapter date source — AniList + ComicVine rarely ship it.
    if (ch.releaseDate) rec['releaseDate'] = ch.releaseDate;
    byNumber.set(ch.number, rec);
  }
  // Overlay ComicVine (higher priority)
  for (const ch of comicvineChapters) {
    const num = parseFloat(String(ch['chapterNumber'] ?? '0'));
    if (!Number.isFinite(num) || num <= 0) continue;
    const existing = byNumber.get(num);
    if (existing) {
      // ComicVine wins on title/volume, but keep MangaDex pages if ComicVine lacks them
      const merged = { ...existing, ...ch };
      if (!merged['pages'] && existing['pages']) merged['pages'] = existing['pages'];
      byNumber.set(num, merged);
    } else {
      byNumber.set(num, ch);
    }
  }
  return [...byNumber.values()].sort((a, b) =>
    parseFloat(String(a['chapterNumber'] ?? '0')) - parseFloat(String(b['chapterNumber'] ?? '0'))
  );
}

function extractComicVineChapters(
  comicvine: ComicVineDirectResult | null,
): Array<Record<string, unknown>> {
  if (!comicvine) return [];

  const sorted = [...comicvine.issues].sort((a, b) => {
    const numA = parseInt(a.issue_number ?? '0', 10);
    const numB = parseInt(b.issue_number ?? '0', 10);
    return numA - numB;
  });

  let globalChapterNum = 1;
  const chapters: Array<Record<string, unknown>> = [];

  for (const issue of sorted) {
    const volNum = parseInt(issue.issue_number ?? '0', 10);
    if (isNaN(volNum) || volNum <= 0) continue;

    const issueChapters = buildChaptersFromIssue(issue.description, volNum, globalChapterNum);
    chapters.push(...issueChapters);
    globalChapterNum += issueChapters.length;
  }

  return chapters;
}

/** Parse chapter titles from a single ComicVine issue description.
 *
 * When the parser extracted a real "Chapter N:" number from the description
 * (`hasRealNumber=true`), use it as the canonical chapterNumber so rows merge
 * correctly with MangaDex/AniList chapters of the same number. Fall back to
 * the running global index only for title-only entries (no explicit number).
 *
 * Pre-fix behaviour bloated long-running series like One Piece (~2030 ComicVine
 * issues × 1 parsed chapter each → chapter rows numbered 1-2030 instead of
 * the real 1-1140).
 */
function buildChaptersFromIssue(
  description: string | undefined | null,
  volNum: number,
  startNum: number,
): Array<Record<string, unknown>> {
  const parsed = parseChaptersFromDescription(description);
  return parsed.map((ch, idx) => ({
    chapterNumber: String(ch.hasRealNumber ? ch.chapterNumber : startNum + idx),
    title: ch.title,
    volume: String(volNum),
    source: 'comicvine',
  }));
}

// ============================================================================
// Kitsu Supplements
// ============================================================================

/**
 * Kitsu supplements: ageRating (Kitsu's strongest field), alt-title union,
 * synopsis fallback when AniList/MangaDex both lack one, and defensive
 * cover/chapter/volume/format/publisher fallbacks when AniList missing.
 * Never overrides AniList values that are already populated.
 */
// eslint-disable-next-line complexity -- Flat list of 9 independent fallbacks; splitting per-field scatters related guard logic without reducing total branching.
function buildKitsuMetadataSupplements(
  metadata: Record<string, unknown>,
  kitsu: KitsuDirectResult | null,
): Record<string, unknown> {
  if (!kitsu) return {};
  const supplements: Record<string, unknown> = {};

  if (!metadata['ageRating'] && kitsu.ageRating) {
    supplements['ageRating'] = kitsu.ageRating;
  }
  if (!metadata['ageRatingGuide'] && kitsu.ageRatingGuide) {
    supplements['ageRatingGuide'] = kitsu.ageRatingGuide;
  }

  const existingDesc = metadata['description'];
  const existingLen = typeof existingDesc === 'string' ? existingDesc.trim().length : 0;
  if (existingLen < 80 && kitsu.synopsis && kitsu.synopsis.trim().length >= 80) {
    supplements['description'] = kitsu.synopsis.trim();
  }

  if (kitsu.alternativeTitles.length > 0) {
    const existing = Array.isArray(metadata['alternativeTitles']) ? metadata['alternativeTitles'] as string[] : [];
    const existingLower = new Set(existing.map(t => t.toLowerCase()));
    const newTitles = kitsu.alternativeTitles.filter(t => !existingLower.has(t.toLowerCase()));
    if (newTitles.length > 0) {
      supplements['alternativeTitles'] = [...existing, ...newTitles];
    }
  }

  // Cover fallback when AniList missing — Kitsu posterImage is the canonical
  // poster, comparable in quality to AniList's cover.
  if (!metadata['coverImage'] && kitsu.posterImageUrl) {
    supplements['coverImage'] = kitsu.posterImageUrl;
  }
  if (!metadata['covers'] && kitsu.posterImageUrl) {
    supplements['covers'] = { large: kitsu.posterImageUrl, medium: kitsu.posterImageUrl };
  }
  // Banner fallback — Kitsu's coverImage is a wide banner-shaped asset.
  if (!metadata['bannerImage'] && kitsu.coverImageUrl) {
    supplements['bannerImage'] = kitsu.coverImageUrl;
  }

  // Numeric fallbacks — only when AniList provided no value AND Kitsu has > 0
  // (Kitsu sometimes returns 0 for unknown counts).
  //
  // Phase 0: persister now reads `metadata['chapters']`/`metadata['volumes']`
  // first (with legacy `chapterCount`/`volumeCount` fallback). Single key write.
  if (metadata['chapters'] === undefined && kitsu.chapterCount && kitsu.chapterCount > 0) {
    supplements['chapters'] = kitsu.chapterCount;
  }
  if (metadata['volumes'] === undefined && kitsu.volumeCount && kitsu.volumeCount > 0) {
    supplements['volumes'] = kitsu.volumeCount;
  }

  // Format / publisher fallbacks
  if (!metadata['format'] && kitsu.subtype) {
    supplements['format'] = kitsu.subtype.toUpperCase();
  }
  if (!metadata['publisher'] && kitsu.serialization) {
    supplements['publisher'] = kitsu.serialization;
  }

  return supplements;
}
