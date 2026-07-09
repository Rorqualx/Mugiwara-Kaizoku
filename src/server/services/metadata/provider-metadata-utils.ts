/**
 * Canonical helpers for the `Manga.providerMetadata` JSON blob.
 *
 * `providerMetadata` is a Prisma Json column that in practice deserializes to a
 * keyed object (`{ anilist: { providerId, ... }, mangadex: { ... }, ... }`) but
 * has historically also been stored double-serialized as a JSON string. Parsing
 * and per-section id extraction had accreted ~10 near-identical copies across
 * the server (structural lesson #3). This is their single home — server-side.
 *
 * Client-side copies (`src/hooks`, `src/components`) intentionally stay separate:
 * they must not pull the server `logger`/import graph into the browser bundle,
 * and one carries a double-decode variant. This module is server-only.
 *
 * NOTE: the AniList pin reader `extractBoundAniListId` in
 * `enrichment-pipeline/phase-provider-fetch.ts` is deliberately NOT folded in —
 * it is string-only (ignores numeric ids) by design and lives in the sensitive
 * binding-loop path; `readProviderId` here coerces numeric ids, so the two are
 * intentionally distinct.
 */

/**
 * Parse a `providerMetadata` value into a keyed object. Accepts a JSON string
 * (double-serialized), a plain object, or anything else. Never throws — malformed
 * or non-object input yields `{}`.
 */
export function parseProviderMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

/**
 * Read the `<provider>` section object from a parsed providerMetadata map, or
 * `null` when it is absent or not an object.
 */
export function getProviderSection(
  pm: Record<string, unknown>,
  provider: string,
): Record<string, unknown> | null {
  const entry = pm[provider];
  return typeof entry === 'object' && entry !== null && !Array.isArray(entry)
    ? (entry as Record<string, unknown>)
    : null;
}

/**
 * Read `providerMetadata.<provider>.providerId` from a PARSED map as a non-empty
 * string, coercing a finite numeric id via `String()`. Returns `null` when
 * absent/empty. Callers that hold the raw (possibly-string) blob should use
 * {@link extractBoundProviderId}.
 */
export function readProviderId(pm: Record<string, unknown>, provider: string): string | null {
  const section = getProviderSection(pm, provider);
  if (section === null) return null;
  const pid = section['providerId'];
  if (typeof pid === 'string' && pid.length > 0) return pid;
  if (typeof pid === 'number' && Number.isFinite(pid)) return String(pid);
  return null;
}

/**
 * Read the bound `providerId` for `<provider>` directly from a raw
 * providerMetadata value (string or object) — {@link parseProviderMetadata}
 * then {@link readProviderId}.
 */
export function extractBoundProviderId(raw: unknown, provider: string): string | null {
  return readProviderId(parseProviderMetadata(raw), provider);
}
