/**
 * @jest-environment node
 *
 * iter-IC6 tests — `loadConversionConfig` default flip + `shouldDeleteSource`
 * kill-switch override semantics. Pure-logic tests; no fs / unrar mocks
 * needed because we never invoke `convertToCbz` here.
 */

import { loadConversionConfig, shouldDeleteSource } from '@/server/services/packImport/archive-converter';
import type { ConversionConfig } from '@/server/services/packImport/archive-converter';
import type { PrismaClient } from '@prisma/client';

interface ConfigRow { key: string; value: string; }

function makeMockPrisma(rows: ConfigRow[]): PrismaClient {
  return {
    config: {
      findMany: async (_args: unknown): Promise<ConfigRow[]> => rows,
    },
  } as unknown as PrismaClient;
}

describe('loadConversionConfig — default flip + preserveSource', () => {
  it('defaults deleteSource to true when key is absent (post-IC6 flip)', async () => {
    const cfg = await loadConversionConfig(makeMockPrisma([]));
    expect(cfg.deleteSource).toBe(true);
    expect(cfg.preserveSource).toBe(false);
  });

  it('respects an explicit conversion.deleteSource = "false"', async () => {
    const cfg = await loadConversionConfig(makeMockPrisma([
      { key: 'conversion.deleteSource', value: 'false' },
    ]));
    expect(cfg.deleteSource).toBe(false);
  });

  it('treats any non-"false" string as deleteSource=true (defensive)', async () => {
    const cfg = await loadConversionConfig(makeMockPrisma([
      { key: 'conversion.deleteSource', value: 'true' },
    ]));
    expect(cfg.deleteSource).toBe(true);
  });

  it('reads conversion.preserveSource as kill-switch', async () => {
    const cfg = await loadConversionConfig(makeMockPrisma([
      { key: 'conversion.preserveSource', value: 'true' },
    ]));
    expect(cfg.preserveSource).toBe(true);
    // Default deleteSource still true; preserveSource overrides downstream.
    expect(cfg.deleteSource).toBe(true);
  });

  it('preserveSource only activates on exact "true"', async () => {
    const cfg = await loadConversionConfig(makeMockPrisma([
      { key: 'conversion.preserveSource', value: '1' },
    ]));
    expect(cfg.preserveSource).toBe(false);
  });
});

describe('shouldDeleteSource — kill-switch resolution', () => {
  const base: ConversionConfig = {
    autoConvert: true,
    defaultFormat: 'cbz',
    deleteSource: true,
    preserveSource: false,
    compressionLevel: 6,
  };

  it('returns true for the new default config (delete=true, preserve=false)', () => {
    expect(shouldDeleteSource(base)).toBe(true);
  });

  it('preserveSource=true forces no-deletion regardless of deleteSource', () => {
    expect(shouldDeleteSource({ ...base, preserveSource: true })).toBe(false);
    expect(shouldDeleteSource({ ...base, deleteSource: false, preserveSource: true })).toBe(false);
  });

  it('returns false when deleteSource is explicitly false (legacy behavior)', () => {
    expect(shouldDeleteSource({ ...base, deleteSource: false })).toBe(false);
  });
});
