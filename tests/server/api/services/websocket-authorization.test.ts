/**
 * @jest-environment node
 *
 * Audit #7 — WebSocket authorization: channel-type matching is
 * case-insensitive, user channels are owner-only, and resource-channel
 * publish is gated on a live API key (no phantom `permission` model).
 */

const apiKeyFindFirstMock = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    apiKey: {
      findFirst: (...args: unknown[]) => apiKeyFindFirstMock(...args),
    },
  },
}));

import { WebSocketAuthorizationService } from '@/server/api/services/WebSocketAuthorizationService';

import type { WebSocketClient } from '@/types/api/v1/websocket';

function makeClient(userId?: string): WebSocketClient {
  return {
    id: 'conn-1',
    userId,
    channels: new Set<string>(),
    socket: {},
    lastActivity: new Date(),
  } as unknown as WebSocketClient;
}

const service = new WebSocketAuthorizationService();

beforeEach(() => {
  apiKeyFindFirstMock.mockReset();
});

describe('canSubscribe', () => {
  it('allows public channels for anyone', () => {
    expect(service.canSubscribe(makeClient(), 'public:updates')).toBe(true);
  });

  it('allows own user channel regardless of prefix casing', () => {
    const client = makeClient('u1');
    expect(service.canSubscribe(client, 'user:u1')).toBe(true);
    expect(service.canSubscribe(client, 'USER:u1')).toBe(true);
  });

  it('denies another user’s channel', () => {
    expect(service.canSubscribe(makeClient('u1'), 'user:u2')).toBe(false);
  });

  it('allows manga/library channels only for authenticated clients', () => {
    expect(service.canSubscribe(makeClient('u1'), 'manga:42')).toBe(true);
    expect(service.canSubscribe(makeClient(), 'manga:42')).toBe(false);
    expect(service.canSubscribe(makeClient(), 'library:scan:progress')).toBe(true);
  });

  it('denies unknown channel types', () => {
    expect(service.canSubscribe(makeClient('u1'), 'admin:everything')).toBe(false);
  });
});

describe('canSubscribeBatch', () => {
  it('matches canSubscribe per channel', () => {
    const client = makeClient('u1');
    const results = service.canSubscribeBatch(client, [
      'public:updates',
      'USER:u1',
      'user:u2',
      'manga:42',
      'bogus:thing',
    ]);
    expect(results.get('public:updates')).toBe(true);
    expect(results.get('USER:u1')).toBe(true);
    expect(results.get('user:u2')).toBe(false);
    expect(results.get('manga:42')).toBe(true);
    expect(results.get('bogus:thing')).toBe(false);
  });
});

describe('canPublish', () => {
  it('denies public channels (read-only)', async () => {
    await expect(service.canPublish(makeClient('u1'), 'public:updates')).resolves.toBe(false);
  });

  it('allows publishing to own user channel in either casing', async () => {
    const client = makeClient('u1');
    await expect(service.canPublish(client, 'user:u1')).resolves.toBe(true);
    await expect(service.canPublish(client, 'USER:u1')).resolves.toBe(true);
    await expect(service.canPublish(client, 'user:u2')).resolves.toBe(false);
  });

  it('gates resource channels on a live API key', async () => {
    apiKeyFindFirstMock.mockResolvedValue({ id: 'k1' });
    await expect(service.canPublish(makeClient('u1'), 'manga:42')).resolves.toBe(true);

    apiKeyFindFirstMock.mockResolvedValue(null);
    await expect(service.canPublish(makeClient('u1'), 'library:scan')).resolves.toBe(false);
  });

  it('queries only enabled, unexpired keys for the user', async () => {
    apiKeyFindFirstMock.mockResolvedValue({ id: 'k1' });
    await service.canPublish(makeClient('u1'), 'manga:42');
    const where = (apiKeyFindFirstMock.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where['userId']).toBe('u1');
    expect(where['enabled']).toBe(true);
    expect(where['OR']).toBeDefined();
  });

  it('denies resource publish for unauthenticated clients without touching the DB', async () => {
    await expect(service.canPublish(makeClient(), 'manga:42')).resolves.toBe(false);
    expect(apiKeyFindFirstMock).not.toHaveBeenCalled();
  });
});
