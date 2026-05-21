/**
 * @jest-environment node
 *
 * stale-torrent-job-reconciler pure-helper tests.
 *
 * The reconciler itself touches Prisma + the download client, but
 * `parseResult` and `clientLostTorrent` are pure functions that
 * decide whether to fire the mutation path. These cover the truth
 * table.
 */

import { parseResult, clientLostTorrent } from '@/server/queue/modules/stale-torrent-job-reconciler';

describe('parseResult', () => {
  it('valid JSON object → returns it', () => {
    expect(parseResult('{"downloadId":"104","clientType":"transmission"}'))
      .toEqual({ downloadId: '104', clientType: 'transmission' });
  });

  it('empty string → null', () => {
    expect(parseResult('')).toBeNull();
  });

  it('null input → null', () => {
    expect(parseResult(null)).toBeNull();
  });

  it('invalid JSON → null (does not throw)', () => {
    expect(parseResult('{not json')).toBeNull();
  });

  it('JSON null → null', () => {
    expect(parseResult('null')).toBeNull();
  });

  it('JSON primitive (string) → null (not a JobResult object)', () => {
    expect(parseResult('"hello"')).toBeNull();
  });
});

describe('clientLostTorrent', () => {
  it('error result with "not found" message → true', () => {
    expect(clientLostTorrent({ status: 'error', error: new Error('Torrent not found') })).toBe(true);
  });

  it('error result with "404" → true', () => {
    expect(clientLostTorrent({ status: 'error', error: new Error('HTTP 404') })).toBe(true);
  });

  it('error result with "no such torrent" → true', () => {
    expect(clientLostTorrent({ status: 'error', error: new Error('No such torrent in transmission') })).toBe(true);
  });

  it('error result with network/transient error → false (we do not assume lost)', () => {
    expect(clientLostTorrent({ status: 'error', error: new Error('ECONNREFUSED') })).toBe(false);
  });

  it('error result with string (not Error) "not found" → true', () => {
    expect(clientLostTorrent({ status: 'error', error: 'torrent not found' })).toBe(true);
  });

  it('success with null data → true (client returned empty)', () => {
    expect(clientLostTorrent({ status: 'success', data: null })).toBe(true);
  });

  it('success with undefined data → true', () => {
    expect(clientLostTorrent({ status: 'success', data: undefined })).toBe(true);
  });

  it('success with double-wrapped null (data.data === null) → true', () => {
    expect(clientLostTorrent({ status: 'success', data: { data: null } })).toBe(true);
  });

  it('success with real torrent payload → false (healthy)', () => {
    const payload = { id: 104, name: 'Lookism', percentDone: 0.5, status: 4 };
    expect(clientLostTorrent({ status: 'success', data: payload })).toBe(false);
  });

  it('success with double-wrapped real torrent payload → false', () => {
    const payload = { data: { id: 104, name: 'Lookism', percentDone: 0.5 } };
    expect(clientLostTorrent({ status: 'success', data: payload })).toBe(false);
  });

  it('non-object inputs → false (defensive)', () => {
    expect(clientLostTorrent(null)).toBe(false);
    expect(clientLostTorrent(undefined)).toBe(false);
    expect(clientLostTorrent('string')).toBe(false);
    expect(clientLostTorrent(42)).toBe(false);
  });

  it('loading status → false (still in progress)', () => {
    expect(clientLostTorrent({ status: 'loading' })).toBe(false);
  });
});
