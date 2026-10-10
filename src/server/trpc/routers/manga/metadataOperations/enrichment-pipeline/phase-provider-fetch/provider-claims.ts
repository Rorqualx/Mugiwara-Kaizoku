/**
 * Selector claim builders: what each provider asserts, per field.
 *
 * Pure — no database, no network — so the selector's inputs can be unit-tested
 * and replayed offline. `phase-provider-fetch.ts` calls `buildClaimsForShadow`
 * on every enrichment.
 *
 * Status claims for MAL, Kitsu and MangaUpdates are added HERE and not in the
 * shared `build*MetadataSupplements` helpers on purpose: the legacy
 * Object.assign chain in `enrichment-result-builder.ts` calls those helpers
 * too and would copy a provider's raw status string straight over
 * `metadata.status`.
 *
 * @module enrichment-pipeline/phase-provider-fetch/provider-claims
 */

import { matchConfidenceFor } from '@/lib/metadata/provider-registry';
import type { AniListMangaDetails } from '@/server/services/anilist/service';
import { aniListClaimFields, type ProviderClaim } from '@/server/services/metadata/selectors/collect-candidates';

import { buildMALMetadataSupplements } from './mal-supplements';
import { buildMangaUpdatesMetadataSupplements, type MangaUpdatesDirectResult } from './mangaupdates-fetch';

import type { KitsuDirectResult } from './kitsu-fetch';
import type { MALDirectResult } from './mal-fetch';

/** The slice of each provider's fetch result the claim builders read. */
export interface ClaimInputs {
  anilist: { details: AniListMangaDetails } | null;
  mangadex: {
    status: string;
    description: string | undefined;
    contentRating?: string | undefined;
    publicationDemographic?: string | undefined;
  } | null;
  mangaupdates: MangaUpdatesDirectResult | null;
  mal: MALDirectResult | null;
  kitsu: KitsuDirectResult | null;
  comicvine: { publisherName: string | undefined } | null;
}

export function buildClaimsForShadow(inputs: ClaimInputs): ProviderClaim[] {
  const claims: ProviderClaim[] = [];
  pushAniListClaim(inputs.anilist, claims);
  pushMangaDexClaim(inputs.mangadex, claims);
  pushMangaUpdatesClaim(inputs.mangaupdates, inputs.comicvine, claims);
  pushMALClaim(inputs.mal, claims);
  pushKitsuClaim(inputs.kitsu, claims);
  pushComicVinePublisherClaim(inputs.comicvine, claims);
  return claims;
}

export function pushAniListClaim(anilist: ClaimInputs['anilist'], claims: ProviderClaim[]): void {
  if (!anilist) return;
  claims.push({ provider: 'anilist', matchConfidence: matchConfidenceFor('anilist'), fields: aniListClaimFields(anilist.details) });
}

export function pushMangaDexClaim(mangadex: ClaimInputs['mangadex'], claims: ProviderClaim[]): void {
  if (!mangadex) return;
  const fields: Record<string, unknown> = { status: mangadex.status };
  if (mangadex.description) fields['summary'] = mangadex.description;
  if (mangadex.contentRating) fields['contentRating'] = mangadex.contentRating;
  if (mangadex.publicationDemographic) fields['publicationDemographic'] = mangadex.publicationDemographic;
  claims.push({ provider: 'mangadex', matchConfidence: matchConfidenceFor('mangadex'), fields });
}

const MU_STATE_PATTERN = /\b(ongoing|completed?|hiatus|discontinued|cancell?ed)\b/giu;

const MU_STATE_TO_STATUS: Readonly<Record<string, string>> = {
  ongoing: 'ONGOING',
  complete: 'COMPLETED',
  completed: 'COMPLETED',
  hiatus: 'HIATUS',
  discontinued: 'CANCELLED',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
};

/**
 * Reduce MangaUpdates' status to a publication state, or null when it cannot
 * be read with confidence.
 *
 * The `completed` flag is authoritative when set. Otherwise `status` is free
 * text — "86 Chapters (Ongoing)", "29 Volumes (Discontinued)", or several
 * paragraphs covering separate editions — so it only counts when every state
 * word in it says the same thing. "27 Volumes (Ongoing)" followed by
 * "3 Volumes (Complete)" for a deluxe edition names two states and abstains.
 */
export function mapMangaUpdatesStatus(status: string, completed: boolean): string | null {
  if (completed) return 'COMPLETED';
  const states = new Set<string>();
  for (const match of status.matchAll(MU_STATE_PATTERN)) {
    const mapped = MU_STATE_TO_STATUS[(match[1] ?? '').toLowerCase()];
    if (mapped) states.add(mapped);
  }
  if (states.size !== 1) return null;
  const [only] = states;
  return only ?? null;
}

export function pushMangaUpdatesClaim(
  mangaupdates: MangaUpdatesDirectResult | null,
  comicvine: ClaimInputs['comicvine'],
  claims: ProviderClaim[],
): void {
  if (!mangaupdates) return;
  const fields = buildMangaUpdatesMetadataSupplements({}, mangaupdates, comicvine?.publisherName);
  const status = mapMangaUpdatesStatus(mangaupdates.status, mangaupdates.completed);
  if (status !== null) fields['status'] = status;
  claims.push({ provider: 'mangaupdates', matchConfidence: matchConfidenceFor('mangaupdates'), fields });
}

export function pushMALClaim(mal: MALDirectResult | null, claims: ProviderClaim[]): void {
  if (!mal) return;
  const fields = buildMALMetadataSupplements({}, mal);
  // Jikan's value arrives mapped to AniList spelling, with 'UNKNOWN' for
  // anything unmapped — which is not a claim.
  if (mal.status && mal.status !== 'UNKNOWN') fields['status'] = mal.status;
  claims.push({ provider: 'mal', matchConfidence: matchConfidenceFor('mal'), fields });
}

export function pushKitsuClaim(kitsu: KitsuDirectResult | null, claims: ProviderClaim[]): void {
  if (!kitsu) return;
  const fields: Record<string, unknown> = {};
  if (kitsu.ageRating) fields['contentRating'] = kitsu.ageRating;
  if (kitsu.synopsis) fields['summary'] = kitsu.synopsis;
  if (kitsu.alternativeTitles.length > 0) fields['synonyms'] = kitsu.alternativeTitles;
  if (kitsu.subtype) fields['format'] = kitsu.subtype.toUpperCase();
  if (kitsu.posterImageUrl) fields['cover'] = kitsu.posterImageUrl;
  if (kitsu.chapterCount && kitsu.chapterCount > 0) fields['chapters'] = kitsu.chapterCount;
  if (kitsu.volumeCount && kitsu.volumeCount > 0) fields['volumes'] = kitsu.volumeCount;
  // Raw Kitsu vocabulary (current/finished/tba/unreleased/upcoming); the
  // categorical selector maps it and abstains on `tba`.
  if (kitsu.status) fields['status'] = kitsu.status;
  claims.push({ provider: 'kitsu', matchConfidence: matchConfidenceFor('kitsu'), fields });
}

export function pushComicVinePublisherClaim(comicvine: ClaimInputs['comicvine'], claims: ProviderClaim[]): void {
  if (!comicvine?.publisherName) return;
  claims.push({
    provider: 'comicvine',
    matchConfidence: matchConfidenceFor('comicvine'),
    fields: { publishers: [comicvine.publisherName] },
  });
}
