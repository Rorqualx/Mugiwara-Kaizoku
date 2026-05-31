/**
 * Regression test for the release-blocklist write path.
 *
 * The jobs-page "Cancel & Blocklist" action previously fell on the floor
 * because the tRPC router sent a flat shape while blocklist-manager
 * validates the nested `input.release`. This test pins the contract so
 * any future flattening of the shape fails loudly.
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

  it('persists a row when given a nested `release` identifier', async () => {
    const input: AddReleaseBlocklistInput = {
      release: {
        releaseTitle: 'Akira Failing in Love v01-02 (2026) (Digital) (Rillant)',
        releaseHash: 'magnet:?xt=urn:btih:92f673a0a573cfd2fd117b22574e7d2147da71bd',
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
    expect(args.data['hash']).toBe(input.release.releaseHash);
    expect(args.data['mangaId']).toBe(80);
    expect(args.data['source']).toBe('torrent');
    expect(args.data['reason']).toBe(ReleaseBlocklistReason.USER_PREFERENCE);
    expect(args.data['isActive']).toBe(true);
    expect(args.data['autoBlocked']).toBe(false);
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
