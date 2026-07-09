/**
 * Provider registry — the single source of truth for per-provider FACTS.
 *
 * Before this file, provider knowledge was scattered across ≥5 independent
 * redeclarations (the `SourceName` union, the Prisma `MetadataProvider` enum,
 * `PROVIDER_DEFAULTS`, `MIN_BIND_SCORE`, `PROVIDER_NAME_MAP`), plus the anchor
 * set `{anilist, mal}` defined 3× and `matchConfidence` inlined as magic
 * literals at each claim-push site. This module consolidates all of that into
 * one row per provider; every former site now reads from here.
 *
 * This is a PURE-DATA module: it imports nothing at runtime (only a type-only
 * `MetadataField`), so both server code and client components can import it
 * without crossing the server/client boundary. The values here are transcribed
 * VERBATIM from their former homes — no behavior change. The weight values in
 * particular are gate-tuned (`scripts/surveys/metadata-accuracy/gate.ts`);
 * re-derive and re-gate before changing any of them.
 *
 * `SourceName` is DERIVED from this table's keys (`keyof typeof
 * PROVIDER_REGISTRY`) and re-exported from `source-priority-config.ts` for
 * backward compatibility, so it is never redeclared again.
 */

// Type-only import — erased at build, so this stays client-safe (no server
// runtime pulled into the client bundle). The reverse re-export of `SourceName`
// from source-priority-config makes this a type-only cycle, which is safe.
import type { MetadataField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

/** Everything the engine and UI need to know about one metadata provider. */
export interface ProviderEntry {
  /**
   * Anchor providers are the bound entities (anilist/mal). Guards and the
   * plausibility detector exclude them from "independent witness" consensus.
   * (Was: `ANCHOR_SOURCES` in select-numeric, `PLAUSIBILITY_ANCHORS` in
   * plausibility-check, `anchorSources` in metadata-persister.)
   */
  anchor: boolean;
  /**
   * Confidence a provider's claims are pushed with in `buildClaimsForShadow`.
   * Multiplied by authority weight in the selectors. (Was: the inline literals
   * in the `push*Claim` helpers.) fandom/wikipedia do not emit selector claims
   * (they feed the chapter/volume pipeline), so their value is currently unused.
   */
  matchConfidence: number;
  /** Base authority for any field without an override. (Was `PROVIDER_BASE_WEIGHT`.) */
  baseWeight: number;
  /**
   * Per-field authority overrides (provider-keyed inversion of the former
   * field-keyed `FIELD_AUTHORITY_OVERRIDES`). When absent for a field, the
   * base weight applies.
   */
  fieldWeights?: Partial<Record<MetadataField, number>>;
  /** Default on/off when no `{provider}.enabled` config row exists. (Was `PROVIDER_DEFAULTS`.) */
  enabledDefault: boolean;
  /** Minimum matcher score to keep an established binding. (Was `MIN_BIND_SCORE`.) */
  bindMin: number;
  /** Human-readable display name. (Was `PROVIDER_LABELS` — only covered 3/8.) */
  label: string;
  /** Mantine color for provenance badges. (Was `PROVIDER_COLORS` — only covered 3/8.) */
  color: string;
}

/**
 * The 8 currently-wired metadata providers. Values transcribed verbatim from:
 * authority.ts (baseWeight/fieldWeights), phase-provider-fetch.ts push helpers
 * (matchConfidence) + PROVIDER_DEFAULTS (enabledDefault), freshness-check.ts
 * (bindMin), MetadataProvenance/utils.ts (label/color).
 */
export const PROVIDER_REGISTRY = {
  anilist: {
    anchor: true,
    matchConfidence: 0.95,
    baseWeight: 0.95,
    fieldWeights: {
      chapters: 0.95,
      volumes: 0.95,
      status: 0.82,
      rating: 0.95,
      themes: 0.90,
      countryOfOrigin: 0.95,
    },
    enabledDefault: true,
    bindMin: 0.70,
    label: 'AniList',
    color: 'blue',
  },
  mangadex: {
    anchor: false,
    matchConfidence: 0.95,
    baseWeight: 0.96,
    fieldWeights: {
      chapters: 0.93,
      volumes: 0.88,
      status: 0.40,
      contentRating: 0.96,
      publicationDemographic: 0.96,
      themes: 0.93,
    },
    enabledDefault: true,
    bindMin: 0.70,
    label: 'MangaDex',
    color: 'orange',
  },
  mal: {
    anchor: true,
    matchConfidence: 0.92,
    baseWeight: 0.92,
    fieldWeights: {
      chapters: 0.92,
      volumes: 0.92,
      status: 0.95,
      rating: 0.92,
      publicationDemographic: 0.80,
      themes: 0.85,
    },
    enabledDefault: false,
    bindMin: 0.65,
    label: 'MyAnimeList',
    color: 'indigo',
  },
  mangaupdates: {
    anchor: false,
    matchConfidence: 0.92,
    baseWeight: 0.95,
    fieldWeights: {
      chapters: 0.88,
      volumes: 0.90,
      status: 0.60,
      rating: 0.88,
    },
    enabledDefault: true,
    bindMin: 0.60,
    label: 'MangaUpdates',
    color: 'teal',
  },
  kitsu: {
    anchor: false,
    matchConfidence: 0.85,
    baseWeight: 0.56,
    fieldWeights: {
      chapters: 0.50,
      volumes: 0.50,
      rating: 0.60,
    },
    enabledDefault: false,
    bindMin: 0.55,
    label: 'Kitsu',
    color: 'pink',
  },
  comicvine: {
    anchor: false,
    matchConfidence: 0.85,
    baseWeight: 0.70,
    enabledDefault: false,
    bindMin: 0.55,
    label: 'ComicVine',
    color: 'red',
  },
  fandom: {
    anchor: false,
    matchConfidence: 0.85, // unused: fandom emits no selector claims
    baseWeight: 0.87,
    enabledDefault: true,
    bindMin: 0.55,
    label: 'Fandom',
    color: 'green',
  },
  wikipedia: {
    anchor: false,
    matchConfidence: 0.85, // unused: wikipedia emits no selector claims
    baseWeight: 0.90,
    enabledDefault: true,
    bindMin: 0.55,
    label: 'Wikipedia',
    color: 'gray',
  },
} satisfies Record<string, ProviderEntry>;

/** Provider identifier union — DERIVED from the registry, never redeclared. */
export type SourceName = keyof typeof PROVIDER_REGISTRY;

/** All wired provider identifiers, in registry (declaration) order. */
export const ALL_PROVIDERS = Object.keys(PROVIDER_REGISTRY) as SourceName[];

/** Anchor providers (the bound entities, excluded from independent consensus). */
export const ANCHOR_PROVIDERS: SourceName[] = ALL_PROVIDERS.filter(
  (p) => PROVIDER_REGISTRY[p].anchor,
);

/**
 * Is this provider an anchor? Lenient on input (accepts any string) so the
 * three former call sites — one typed `SourceName`, two typed `string` — can
 * all delegate here; unknown strings return false.
 */
export function isAnchor(provider: string): boolean {
  return provider in PROVIDER_REGISTRY && PROVIDER_REGISTRY[provider as SourceName].anchor;
}

/** Confidence a provider's selector claims are pushed with. */
export function matchConfidenceFor(provider: SourceName): number {
  return PROVIDER_REGISTRY[provider].matchConfidence;
}

/**
 * Effective authority weight for a (field, provider) pair: the per-field
 * override if present, else the provider's base weight.
 */
export function resolveWeight(field: MetadataField, provider: SourceName): number {
  // Widen to ProviderEntry: the `satisfies` union keeps `fieldWeights` narrow
  // (absent on providers that have no overrides), so read it through the interface.
  const entry: ProviderEntry = PROVIDER_REGISTRY[provider];
  const override = entry.fieldWeights?.[field];
  if (typeof override === 'number') return override;
  return entry.baseWeight;
}

/** Minimum matcher score required to keep an established binding. */
export function bindMinFor(provider: SourceName): number {
  return PROVIDER_REGISTRY[provider].bindMin;
}

/** Default enabled state when no `{provider}.enabled` config row exists. */
export function enabledDefaultFor(provider: SourceName): boolean {
  return PROVIDER_REGISTRY[provider].enabledDefault;
}

/**
 * Display label for a provider. Lenient — unknown strings fall back to the raw
 * value (matches the former `getProviderLabel` contract).
 */
export function providerLabel(provider: string): string {
  return provider in PROVIDER_REGISTRY ? PROVIDER_REGISTRY[provider as SourceName].label : provider;
}

/**
 * Provenance-badge color for a provider. Lenient — unknown/undefined falls back
 * to 'gray' (matches the former `getProviderColor` default).
 */
export function providerColor(provider: string | undefined): string {
  if (provider && provider in PROVIDER_REGISTRY) {
    return PROVIDER_REGISTRY[provider as SourceName].color;
  }
  return 'gray';
}
