/**
 * @jest-environment node
 */
import { describe, it, expect } from '@jest/globals';

import { gateChapterCount } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/gate-chapter-count';

describe('gateChapterCount — the chapter count volume ranges are clamped to', () => {
  // Why this exists: Wikipedia resolved Steel Ball Run to the umbrella JoJo
  // article and reported 1 chapter. min(1, 95) clamped the gate to 1, so 23 of
  // MangaDex's 24 volume ranges were dropped as "beyond the last chapter".
  it('ignores a source count far below the trusted ceiling', () => {
    expect(gateChapterCount(1, 95)).toBe(95);
    expect(gateChapterCount(40, 95)).toBe(95);
  });

  it('keeps the smaller of two plausible counts', () => {
    expect(gateChapterCount(141, 139)).toBe(139);
    expect(gateChapterCount(90, 95)).toBe(90);
  });

  it('uses the ceiling when the sources give no count', () => {
    expect(gateChapterCount(null, 95)).toBe(95);
    expect(gateChapterCount(0, 95)).toBe(95);
  });
});
