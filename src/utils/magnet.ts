/**
 * BitTorrent magnet-URI helpers.
 *
 * Lives in `src/utils/` (no server-only deps) so both the server
 * dispatcher (`prowlarr-handler`) and the browser UI (`active.tsx`'s
 * Cancel & Blocklist action) can use the same normalization. Keeping
 * those two sides in sync is the whole point of Fix 1.1 — when they
 * disagreed, hash-based blocking was silently dead code.
 */

/**
 * Extract the BitTorrent v1 infohash (BTIH) from a magnet URI.
 *
 * Accepts both hex (40 chars) and base32 (32 chars) forms; the v1
 * prefix `urn:btih:` is the only one we look for — `urn:btmh:` (v2)
 * isn't supported by any indexer the dispatcher currently uses, and
 * a v1+v2 hybrid magnet lists `btih` first so this catches it. Hex
 * is lowercased so a case mismatch can't bypass a stored block.
 *
 * Returns `undefined` for non-magnet URLs (Usenet `.nzb`, DDL `https://`,
 * empty string) so callers can decide whether to store nothing or fall
 * back to a different signature.
 */
const MAGNET_BTIH_PATTERN = /xt=urn:btih:([a-f0-9]{40}|[a-z2-7]{32})/i;

export function extractBtihFromMagnet(url: string): string | undefined {
  if (!url.startsWith('magnet:')) return undefined;
  const match = MAGNET_BTIH_PATTERN.exec(url);
  return match?.[1]?.toLowerCase();
}

/**
 * Normalize an arbitrary "release hash" input into the canonical form
 * the dispatcher's blocklist lookup will use. The lookup-side extracts
 * BTIH from the resolved download URL; the write-side has historically
 * stored either the full magnet URL (UI Cancel & Blocklist) or a
 * base64-truncated URL (auto-block) — neither matches the BTIH at
 * lookup time, leaving hash-based gating dead.
 *
 *   - magnet URI         → extracted BTIH (40-char lowercase hex / 32-char base32)
 *   - empty / null / undefined → undefined
 *   - anything else (HTTPS Usenet/DDL URL, raw hash, etc.) → undefined
 *
 * Callers pass the result straight into `hash` on the blocklist row.
 * Non-magnet release sources end up with `hash = null`; title / group /
 * pattern matching still gates retriggers for those.
 */
export function normalizeReleaseHashForStorage(input: string | null | undefined): string | undefined {
  if (input === null || input === undefined) return undefined;
  if (input.length === 0) return undefined;
  return extractBtihFromMagnet(input);
}
