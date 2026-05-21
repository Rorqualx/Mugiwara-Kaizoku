/**
 * Side-channel for the iter-A0 audit (download-pipeline persistent-gap loop).
 *
 * Collects Prowlarr release titles whose coverage couldn't be parsed by
 * `parseReleaseCoverage` so the harness can persist them as a regression
 * corpus for iter-A's parser hardening. Production-noop unless
 * `recordOpaqueRelease` is called from the adapter; the harness drains via
 * `drainOpaqueReleases` per-manga.
 *
 * Single global Map is fine — the harness runs sequentially (one manga at
 * a time), so cross-manga contamination isn't possible. Production paths
 * call `searchProwlarr` without the optional `mangaId`, so nothing is
 * recorded outside the harness.
 */

export interface OpaqueRelease {
  mangaId: number;
  releaseTitle: string;
  score: number;
  indexerName: string;
}

const buffer = new Map<number, OpaqueRelease[]>();

export function recordOpaqueRelease(entry: OpaqueRelease): void {
  const list = buffer.get(entry.mangaId);
  if (list) list.push(entry);
  else buffer.set(entry.mangaId, [entry]);
}

export function drainOpaqueReleases(mangaId: number): OpaqueRelease[] {
  const list = buffer.get(mangaId) ?? [];
  buffer.delete(mangaId);
  return list;
}
