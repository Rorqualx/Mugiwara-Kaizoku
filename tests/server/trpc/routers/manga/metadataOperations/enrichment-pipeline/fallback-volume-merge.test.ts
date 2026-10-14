/**
 * @jest-environment node
 *
 * The MediaWiki fallback's volume map must not replace a usable adaptive map.
 * Found refreshing SPY x FAMILY in production: the adaptive parser left
 * chapters 128-141 out of any volume (not yet collected), so its map held 127
 * entries against the fallback's 142; the fallback replaced it and filed 0 and
 * 120-141 under a volume 18 that does not exist.
 */

import { describe, it, expect } from '@jest/globals';

import { fallbackVolumesToApply } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/fandom-mediawiki-fallback/volume-merge';

function range(from: number, to: number, volume: number): Record<number, number> {
  const map: Record<number, number> = {};
  for (let n = from; n <= to; n++) map[n] = volume;
  return map;
}

describe('fallbackVolumesToApply', () => {
  const adaptive = { ...range(1, 5, 1), ...range(6, 11, 2), ...range(12, 17, 3), ...range(119, 127, 17) };
  const seen = new Set([...Object.keys(adaptive).map(Number), ...Array.from({ length: 14 }, (_, i) => 128 + i)]);

  it('leaves a usable adaptive map alone and files nothing the adaptive parser left unassigned', () => {
    const fallback = { ...range(1, 5, 1), ...range(6, 11, 2), ...range(12, 17, 3), ...range(120, 141, 18), 0: 18 };
    const apply = fallbackVolumesToApply(adaptive, fallback, seen);
    expect(apply).toEqual({});
  });

  it('fills chapters the adaptive parser never listed', () => {
    expect(fallbackVolumesToApply(adaptive, { 18: 3, 19: 3 }, seen)).toEqual({ 18: 3, 19: 3 });
    // ...but only into volumes the adaptive map has.
    expect(fallbackVolumesToApply(adaptive, { 0: 18 }, seen)).toEqual({});
  });

  it('replaces an empty or collapsed adaptive map when the fallback has as many entries', () => {
    const fallback = { ...range(1, 9, 1), ...range(10, 18, 2), ...range(19, 27, 3), ...range(28, 36, 4), ...range(37, 45, 5), ...range(46, 54, 6) };
    expect(fallbackVolumesToApply({}, fallback, new Set())).toEqual(fallback);
    // Every chapter under one volume: the adaptive parse took a whole table for it.
    const collapsed = range(1, 54, 6);
    expect(fallbackVolumesToApply(collapsed, fallback, new Set(Object.keys(collapsed).map(Number)))).toEqual(fallback);
  });
});
