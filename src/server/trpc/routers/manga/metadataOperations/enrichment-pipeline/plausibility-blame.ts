/**
 * Decide whether an implausible stored count is the anchor binding's fault.
 *
 * The plausibility check flags a manga when its stored volume/chapter count is
 * far below the non-anchor consensus. That is the signature of a wrong AniList
 * binding only when the anchor actually supplied the count. When another
 * provider did (e.g. a stale MangaUpdates `latest_chapter` on a series whose
 * AniList count is null), rejecting the AniList id would durably unbind a
 * correct entity and filter it out of the next search.
 */

/** Providers whose count comes from the AniList binding (MAL is fetched via AniList's idMal). */
const ANCHOR_SUPPLIERS: ReadonlySet<string> = new Set(['anilist', 'mal']);

/** Read the provider that supplied `field` from a `metadataProvenance` object. */
export function readFieldSupplier(provenance: unknown, field: string): string | null {
  if (provenance === null || typeof provenance !== 'object') return null;
  const entry = (provenance as Record<string, unknown>)[field];
  if (typeof entry === 'string' && entry.length > 0) return entry;
  if (entry !== null && typeof entry === 'object') {
    const provider = (entry as Record<string, unknown>)['provider'];
    if (typeof provider === 'string' && provider.length > 0) return provider;
  }
  return null;
}

/**
 * True when the AniList binding should be rejected for an implausible `field`.
 * Unknown provenance keeps the historical behaviour (blame the anchor): rows
 * enriched before per-field provenance existed took their counts from AniList.
 */
export function shouldRejectAnchorBinding(provenance: unknown, field: string): boolean {
  const supplier = readFieldSupplier(provenance, field);
  return supplier === null || ANCHOR_SUPPLIERS.has(supplier);
}
