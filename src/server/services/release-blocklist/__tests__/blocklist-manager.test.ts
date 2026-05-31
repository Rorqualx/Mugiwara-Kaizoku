/**
 * Regression test for the release-blocklist write path.
 *
 * The jobs-page "Cancel & Blocklist" action previously fell on the floor
 * because the tRPC router sent a flat shape while blocklist-manager
 * validates the nested `input.release`. This test pins the contract so
 * any future flattening of the shape fails loudly.
 *
 * Fix 1.1 extension: the manager now normalizes `releaseHash` to the
 * canonical BTIH on write so it matches what the dispatcher's lookup
 * extracts from the resolved download URL — keeping the two sides in
 * sync is what makes hash-based blocking actually gate retriggers.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { blockRelease } from '../blocklist-manager';
import { ReleaseBlocklistReason } from '../types';

import type { AddReleaseBlocklistInput } from '../types';
import type { PrismaClient } from '@prisma/client';

interface MockedPrisma {
  releaseBlocklist: { create: jest.Mock };
}

function buildMockPrisma(): MockedPrisma {
  const create = jest.fn() as jest.Mock;
  create.mockImplementation(() => Promise.resolve({ id: 'mock-id' }));
  return { releaseBlocklist: { create } };
}

describe('blockRelease', () => {
  let mocked: MockedPrisma;

  beforeEach(() => {
    mocked = buildMockPrisma();
  });

  it('persists a row when given a nested `release` identifier and normalizes a magnet-URL releaseHash to its BTIH', async () => {
    // Fix 1.1: defensive write-side normalization. The UI's
    // Cancel & Blocklist used to pass the full magnet URI as releaseHash;
    // the dispatcher's lookup-side extracts the BTIH from the resolved
    // downloadUrl, so the two never matched. Manager normalizes now.
    const input: AddReleaseBlocklistInput = {
      release: {
        releaseTitle: 'Akira Failing in Love v01-02 (2026) (Digital) (Rillant)',
        releaseHash: 'magnet:?xt=urn:btih:92f673a0a573cfd2fd117b22574e7d2147da71bd&dn=foo',
        mangaId: 80,
        source: 'torrent',
      },
      reason: ReleaseBlocklistReason.USER_PREFERENCE,
      reasonDetails: 'Blocked from Jobs page via cancel-and-blocklist',
    };

    const result = await blockRelease(mocked as unknown as PrismaClient, input, 'user-1');

    expect(result.status).toBe('success');
    expect(mocked.releaseBlocklist.create).toHaveBeenCalledTimes(1);
    const args = mocked.releaseBlocklist.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data['title']).toBe(input.release.releaseTitle);
    // Normalized to the canonical BTIH the dispatcher will look up.
    expect(args.data['hash']).toBe('92f673a0a573cfd2fd117b22574e7d2147da71bd');
    expect(args.data['mangaId']).toBe(80);
    expect(args.data['source']).toBe('torrent');
    expect(args.data['reason']).toBe(ReleaseBlocklistReason.USER_PREFERENCE);
    expect(args.data['isActive']).toBe(true);
    expect(args.data['autoBlocked']).toBe(false);
  });

  it('stores null hash for non-magnet release sources (no signature ever matches the dispatcher lookup)', async () => {
    // Usenet / DDL releases don't have a BTIH. Pre-Fix 1.1 the auto-block
    // path base64-truncated the URL into the hash column, but that
    // signature never matched the dispatcher's lookup either, so storing
    // it was pure noise. Now the column is just null and title/group/
    // pattern matching is the only gate (which is what was running anyway).
    const input: AddReleaseBlocklistInput = {
      release: {
        releaseTitle: '[0v3r] Boarding School Juliet v01-08',
        releaseHash: 'https://example.com/release.nzb',
        mangaId: 49,
      },
      reason: ReleaseBlocklistReason.USER_PREFERENCE,
    };

    const result = await blockRelease(mocked as unknown as PrismaClient, input, 'user-1');

    expect(result.status).toBe('success');
    const args = mocked.releaseBlocklist.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(args.data['hash']).toBeNull();
  });

  it('rejects a flat shape (router-bug regression)', async () => {
    // What the router used to send: top-level fields, no nested `release`.
    // Manager must reject so a silent drop never recurs.
    const flat = {
      releaseTitle: 'Some Release',
      reason: ReleaseBlocklistReason.USER_PREFERENCE,
      mangaId: 80,
    } as unknown as AddReleaseBlocklistInput;

    const result = await blockRelease(mocked as unknown as PrismaClient, flat, 'user-1');

    expect(result.status).toBe('error');
    expect(mocked.releaseBlocklist.create).not.toHaveBeenCalled();
  });
});
