/**
 * Per-provider binding directives for the provider-fetch phase.
 *
 * A manual bind is stored as `Manga.providerMetadata.<provider> =
 * { providerId, manual: true, boundAt }` and a user unbind as the sentinel
 * `{ manual: true, providerId: null, intent: 'unbound' }`. The pipeline used
 * to honour those only for ComicVine, so a manual MangaDex / MangaUpdates /
 * Kitsu bind was overwritten by the next title search. These readers turn the
 * stored section into one of four states the fetchers act on.
 *
 * Only `manual === true` entries count: an id the pipeline bound itself must
 * not lock out a better candidate on the next run.
 *
 * Pure: no I/O, so every id format can be unit-tested.
 */
import { bindMinFor } from '@/lib/metadata/provider-registry';

import { isManuallyUnboundFromMetadata, type SentinelProvider } from '../manual-binding-sentinel';

export type ProviderPin<T> =
  /** No manual entry — run the matcher. */
  | { kind: 'none' }
  /** The user unbound this provider — do not fetch or bind it at all. */
  | { kind: 'unbound' }
  /** Fetch this entity by id and skip the matcher. */
  | { kind: 'pinned'; id: T; raw: string }
  /** A manual entry whose id cannot be fetched by id — run the matcher, and say why. */
  | { kind: 'unusable'; raw: string; reason: string };

/** What a fetcher needs to respect the user's binding decisions. */
export interface ProviderDirective<T> {
  pin: ProviderPin<T>;
  /** Ids the matcher must never pick (`ProviderBinding` rejections). */
  rejectedIds: ReadonlySet<string>;
  /**
   * The id an earlier run bound by itself (not manual, not rejected). The
   * matcher still runs first; this is only what to fall back to when the
   * search now finds nothing, so a bound title keeps its provider data.
   */
  boundId?: T;
}

export interface MangaUpdatesPinId {
  /** Numeric series id the API is keyed by. */
  seriesId: number;
  /** The base36 slug the id was decoded from; null when a numeric id was stored. */
  slug: string | null;
}

const MANGADEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const ALL_DIGITS = /^[1-9]\d*$/u;
/** MangaUpdates slugs are short lowercase base36; ten characters stays inside a safe integer. */
const MANGAUPDATES_SLUG = /^[0-9a-z]{1,10}$/u;

/** Trimmed manual `providerId` for a provider, or null when the entry is absent or not manual. */
function readManualRawId(providerMetadata: unknown, provider: string): string | null {
  if (providerMetadata === null || typeof providerMetadata !== 'object' || Array.isArray(providerMetadata)) return null;
  const entry = (providerMetadata as Record<string, unknown>)[provider];
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const section = entry as Record<string, unknown>;
  if (section['manual'] !== true) return null;
  const pid = section['providerId'];
  if (typeof pid === 'number' && Number.isFinite(pid)) return String(pid);
  if (typeof pid !== 'string') return null;
  const trimmed = pid.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type ParsedId<T> = { ok: true; id: T } | { ok: false; reason: string };

/**
 * Shared reader: sentinel first (an unbind outranks any id left in the
 * section), then the manual id, parsed by the provider's own id format.
 */
function readPin<T>(
  providerMetadata: unknown,
  provider: SentinelProvider,
  parse: (raw: string) => ParsedId<T>,
): ProviderPin<T> {
  if (isManuallyUnboundFromMetadata(providerMetadata, provider)) return { kind: 'unbound' };
  const raw = readManualRawId(providerMetadata, provider);
  if (raw === null) return { kind: 'none' };
  const parsed = parse(raw);
  return parsed.ok ? { kind: 'pinned', id: parsed.id, raw } : { kind: 'unusable', raw, reason: parsed.reason };
}

/** MangaDex ids are UUIDs; the API rejects uppercase. */
export function readMangaDexPin(providerMetadata: unknown): ProviderPin<string> {
  return readPin<string>(providerMetadata, 'mangadex', (raw) => {
    const lower = raw.toLowerCase();
    return MANGADEX_UUID.test(lower) ? { ok: true, id: lower } : { ok: false, reason: 'not a MangaDex UUID' };
  });
}

/**
 * Kitsu's client only has `/manga/{id}`, which takes the numeric id. The bind
 * UI also accepts a slug; that cannot be fetched by id, so it falls back to
 * the matcher.
 */
export function readKitsuPin(providerMetadata: unknown): ProviderPin<string> {
  return readPin<string>(providerMetadata, 'kitsu', (raw) => (
    ALL_DIGITS.test(raw)
      ? { ok: true, id: raw }
      : { ok: false, reason: 'Kitsu slug — only a numeric id can be fetched by id' }
  ));
}

/**
 * MangaUpdates: the API is keyed by a numeric series id, the website (and so
 * the bind UI) by a slug. The slug is that id written in base36 — "tt2niag" is
 * 64884662872 — which held for all 70 stored (id, slug) pairs in the library.
 * An all-digit value is taken as the numeric id (the UI's "legacy numeric"
 * rule in `provider-bind-config.ts`). The fetcher re-checks a decoded slug
 * against the slug in the returned series URL before trusting it.
 */
export function readMangaUpdatesPin(providerMetadata: unknown): ProviderPin<MangaUpdatesPinId> {
  return readPin<MangaUpdatesPinId>(providerMetadata, 'mangaupdates', (raw) => {
    if (ALL_DIGITS.test(raw)) {
      const seriesId = Number(raw);
      return Number.isSafeInteger(seriesId)
        ? { ok: true, id: { seriesId, slug: null } }
        : { ok: false, reason: 'numeric id out of range' };
    }
    const slug = raw.toLowerCase();
    if (!MANGAUPDATES_SLUG.test(slug)) return { ok: false, reason: 'neither a numeric id nor a base36 slug' };
    const seriesId = parseInt(slug, 36);
    return Number.isSafeInteger(seriesId) && seriesId > 0
      ? { ok: true, id: { seriesId, slug } }
      : { ok: false, reason: 'slug does not decode to a series id' };
  });
}

/**
 * ComicVine volume id. The bind UI stores either `50244` or `4050-50244`
 * (4050 is ComicVine's volume type prefix); both mean volume 50244.
 */
export function readComicVinePin(providerMetadata: unknown): ProviderPin<number> {
  return readPin<number>(providerMetadata, 'comicvine', (raw) => {
    const match = /^(?:\d+-)?(\d+)$/u.exec(raw);
    const id = match?.[1] ? parseInt(match[1], 10) : NaN;
    return Number.isSafeInteger(id) && id > 0 ? { ok: true, id } : { ok: false, reason: 'not a ComicVine volume id' };
  });
}

/**
 * ComicVine volume id from an automatic binding, unless it was rejected.
 * "One Piece (Official Colored)" is bound to a volume the title search no
 * longer returns; without this the refresh treated it as unmatched and
 * rebuilt its volume ranges from nothing.
 */
export function readComicVineBoundId(providerMetadata: unknown, rejectedIds: ReadonlySet<string>): number | undefined {
  if (providerMetadata === null || typeof providerMetadata !== 'object' || Array.isArray(providerMetadata)) return undefined;
  const entry = (providerMetadata as Record<string, unknown>)['comicvine'];
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
  const section = entry as Record<string, unknown>;
  if (section['manual'] === true) return undefined;
  const pid = section['providerId'];
  const raw = typeof pid === 'number' ? String(pid) : typeof pid === 'string' ? pid.trim() : '';
  const match = /^(?:\d+-)?(\d+)$/u.exec(raw);
  const id = match?.[1] ? parseInt(match[1], 10) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0 || rejectedIds.has(String(id))) return undefined;
  return id;
}

/** Candidates left after removing every rejected id. */
export function dropRejected<T>(
  candidates: readonly T[],
  idOf: (candidate: T) => string,
  rejectedIds: ReadonlySet<string> | undefined,
): T[] {
  if (!rejectedIds || rejectedIds.size === 0) return [...candidates];
  return candidates.filter((candidate) => !rejectedIds.has(idOf(candidate)));
}

/**
 * Whether the matcher's pick may be bound once rejected candidates were taken
 * out of the running.
 *
 * With its best candidate rejected the matcher falls to the runner-up, which
 * can be a different series that merely shares a word with the title
 * (MangaUpdates rebound a rejected title at 0.55). When a rejection actually
 * removed a search hit, the replacement has to reach the provider's bind
 * threshold; otherwise the provider is left unbound.
 */
export function mayBindAfterRejection(
  provider: 'mangadex' | 'mangaupdates' | 'kitsu',
  score: number,
  rejectedSkipped: number,
): boolean {
  return rejectedSkipped === 0 || score >= bindMinFor(provider);
}

export interface ProviderDirectives {
  mangadex: ProviderDirective<string>;
  mangaupdates: ProviderDirective<MangaUpdatesPinId>;
  kitsu: ProviderDirective<string>;
  comicvine: ProviderDirective<number>;
  /**
   * MAL has no matcher (it is fetched by the id AniList / MangaDex link to),
   * so there is nothing to pin or reject — only the unbind to respect.
   */
  malUnbound: boolean;
}

function comicVineDirective(providerMetadata: unknown, rejectedIds: ReadonlySet<string>): ProviderDirective<number> {
  const boundId = readComicVineBoundId(providerMetadata, rejectedIds);
  return { pin: readComicVinePin(providerMetadata), rejectedIds, ...(boundId !== undefined ? { boundId } : {}) };
}

/** Binding directives for every provider, from one loaded `providerMetadata` and the rejection lookup. */
export function buildProviderDirectives(
  providerMetadata: unknown,
  rejectedIdsFor: (provider: string) => ReadonlySet<string>,
): ProviderDirectives {
  return {
    mangadex: { pin: readMangaDexPin(providerMetadata), rejectedIds: rejectedIdsFor('mangadex') },
    mangaupdates: { pin: readMangaUpdatesPin(providerMetadata), rejectedIds: rejectedIdsFor('mangaupdates') },
    kitsu: { pin: readKitsuPin(providerMetadata), rejectedIds: rejectedIdsFor('kitsu') },
    comicvine: comicVineDirective(providerMetadata, rejectedIdsFor('comicvine')),
    malUnbound: isManuallyUnboundFromMetadata(providerMetadata, 'mal'),
  };
}

/**
 * True when the second-wave verify / retry step must leave this provider's
 * first-wave result alone: the user unbound it (stay null), or the result is
 * the manually pinned entity (a re-search would replace the user's choice).
 * A pin whose fetch failed fell back to the matcher, so it is verified as usual.
 */
export function skipsSecondWave(
  directive: ProviderDirective<unknown>,
  firstWaveResult: { manualPin?: boolean } | null,
): boolean {
  return directive.pin.kind === 'unbound' || firstWaveResult?.manualPin === true;
}
